import { Redis } from 'ioredis';
import RedisMock from 'ioredis-mock';
import { env } from '../config/env.js';
import { HotelOffer, CacheMeta, PriceFilterOptions, DependencyHealth } from '../domain/types.js';
import { normalizeHotelName } from '../domain/deduplicate.js';
import { logger } from '../utils/logger.js';

const FILTER_LUA_SCRIPT = `
local priceKey = KEYS[1]
local dataKey = KEYS[2]
local minScore = ARGV[1]
local maxScore = ARGV[2]
local offset = ARGV[3]
local count = ARGV[4]

local members
if offset and count and offset ~= '' and count ~= '' then
    members = redis.call('ZRANGEBYSCORE', priceKey, minScore, maxScore, 'LIMIT', tonumber(offset), tonumber(count))
else
    members = redis.call('ZRANGEBYSCORE', priceKey, minScore, maxScore)
end

if #members == 0 then
    return {}
end

return redis.call('HMGET', dataKey, unpack(members))
`;

export class RedisService {
  private client: Redis;
  private isConnected = false;

  constructor(customClient?: Redis) {
    if (customClient) {
      this.client = customClient;
      this.isConnected = true;
    } else if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      this.client = new RedisMock() as unknown as Redis;
      this.isConnected = true;
    } else {
      this.client = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
          if (times > 3) return null;
          return Math.min(times * 100, 1000);
        },
        lazyConnect: true,
        enableOfflineQueue: false,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Connected to Redis');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        logger.error({ err }, 'Redis connection error');
      });
    }
  }

  public isReady(): boolean {
    return this.isConnected;
  }

  public async connect(): Promise<void> {
    try {
      if (this.client.status === 'wait') {
        const connectPromise = this.client.connect();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Redis connection timeout')), 800)
        );
        await Promise.race([connectPromise, timeoutPromise]);
      }
    } catch (err) {
      logger.warn({ err }, 'Could not connect to external Redis; initializing in-memory Redis fallback');
      try {
        this.client.disconnect();
      } catch {
        // ignore
      }
      try {
        const RedisMock = (await import('ioredis-mock')).default;
        this.client = new RedisMock() as unknown as Redis;
        this.isConnected = true;
        logger.info('In-memory Redis engine initialized successfully for standalone mode');
      } catch (mockErr) {
        logger.error({ mockErr }, 'Failed to initialize in-memory Redis fallback');
      }
    }
  }

  public getClient(): Redis {
    return this.client;
  }

  private pricesKey(city: string): string {
    return `hotels:prices:${city.trim().toLowerCase()}`;
  }

  private dataKey(city: string): string {
    return `hotels:data:${city.trim().toLowerCase()}`;
  }

  private metaKey(city: string): string {
    return `hotels:meta:${city.trim().toLowerCase()}`;
  }

  /**
   * Checks if cache exists for the specified city.
   */
  public async getCacheMeta(city: string): Promise<CacheMeta | null> {
    const key = this.metaKey(city);
    const raw = await this.client.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CacheMeta;
    } catch {
      return null;
    }
  }

  /**
   * Atomically writes offers to Redis:
   * - Sorted set: hotels:prices:{city} (score = price, member = canonical key)
   * - Hash: hotels:data:{city} (field = canonical key, value = JSON string)
   * - String: hotels:meta:{city} (cachedAt, count, degradedSuppliers)
   */
  public async cacheOffers(
    city: string,
    offers: HotelOffer[],
    degradedSuppliers: string[]
  ): Promise<void> {
    const pKey = this.pricesKey(city);
    const dKey = this.dataKey(city);
    const mKey = this.metaKey(city);
    const ttl = env.REDIS_TTL_SECONDS;

    const meta: CacheMeta = {
      cachedAt: Date.now(),
      count: offers.length,
      degradedSuppliers,
    };

    const multi = this.client.multi();

    // Clean existing keys
    multi.del(pKey);
    multi.del(dKey);

    if (offers.length > 0) {
      // ZADD arguments: score, member, score, member...
      const zaddArgs: (string | number)[] = [pKey];
      const hsetFields: Record<string, string> = {};

      for (const offer of offers) {
        const canonicalKey = normalizeHotelName(offer.name);
        zaddArgs.push(offer.price, canonicalKey);
        hsetFields[canonicalKey] = JSON.stringify(offer);
      }

      multi.zadd(...(zaddArgs as [string, ...number[]]));
      multi.hset(dKey, hsetFields);
      multi.expire(pKey, ttl);
      multi.expire(dKey, ttl);
    }

    multi.set(mKey, JSON.stringify(meta), 'EX', ttl);

    const results = await multi.exec();
    if (!results) {
      throw new Error('Redis transaction failed during cacheOffers');
    }

    for (const [err] of results) {
      if (err) throw err;
    }
  }

  /**
   * Queries offers from Redis, applying price range filters directly inside Redis
   * via an atomic Lua script (or fallback to atomic pipeline).
   */
  public async getFilteredOffers(
    city: string,
    filters: PriceFilterOptions = {}
  ): Promise<HotelOffer[]> {
    const pKey = this.pricesKey(city);
    const dKey = this.dataKey(city);

    const minScore = filters.minPrice !== undefined ? String(filters.minPrice) : '-inf';
    const maxScore = filters.maxPrice !== undefined ? String(filters.maxPrice) : '+inf';
    const offsetArg = filters.offset !== undefined ? String(filters.offset) : '';
    const limitArg = filters.limit !== undefined ? String(filters.limit) : '';

    try {
      // Execute Lua script directly inside Redis for maximum performance and atomicity
      const rawResults = (await this.client.eval(
        FILTER_LUA_SCRIPT,
        2,
        pKey,
        dKey,
        minScore,
        maxScore,
        offsetArg,
        limitArg
      )) as (string | null)[];

      if (!rawResults || rawResults.length === 0) {
        return [];
      }

      const offers: HotelOffer[] = [];
      for (const item of rawResults) {
        if (item) {
          offers.push(JSON.parse(item) as HotelOffer);
        }
      }
      return offers;
    } catch (luaErr) {
      logger.warn({ luaErr }, 'Lua execution failed, falling back to ZRANGEBYSCORE + HMGET');
      // Pipeline fallback
      let members: string[];
      if (filters.offset !== undefined && filters.limit !== undefined) {
        members = await this.client.zrangebyscore(
          pKey,
          minScore,
          maxScore,
          'LIMIT',
          filters.offset,
          filters.limit
        );
      } else {
        members = await this.client.zrangebyscore(pKey, minScore, maxScore);
      }
      if (!members || members.length === 0) {
        return [];
      }

      const rawItems = await this.client.hmget(dKey, ...members);
      const offers: HotelOffer[] = [];
      for (const item of rawItems) {
        if (item) {
          offers.push(JSON.parse(item) as HotelOffer);
        }
      }
      return offers;
    }
  }

  /**
   * Deep health check probing Redis responsiveness and latency.
   */
  public async checkHealth(): Promise<DependencyHealth> {
    const start = Date.now();
    try {
      const pong = await this.client.ping();
      const latencyMs = Date.now() - start;
      if (pong === 'PONG') {
        return { status: 'up', latencyMs };
      }
      return { status: 'down', latencyMs, error: `Unexpected ping response: ${pong}` };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { status: 'down', latencyMs, error: errorMsg };
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}

export const redisService = new RedisService();
