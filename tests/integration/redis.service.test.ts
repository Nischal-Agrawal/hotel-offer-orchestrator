import { describe, it, expect, beforeEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import { RedisService } from '../../src/services/redis.service.js';
import { HotelOffer } from '../../src/domain/types.js';

describe('RedisService Integration Tests (with mock/in-memory Redis)', () => {
  let redisMock: InstanceType<typeof RedisMock>;
  let service: RedisService;

  const sampleOffers: HotelOffer[] = [
    { name: 'Holtin', price: 5340, supplier: 'Supplier B', commissionPct: 20 },
    { name: 'Radison', price: 5900, supplier: 'Supplier A', commissionPct: 13 },
    { name: 'Leela Ambience', price: 7200, supplier: 'Supplier A', commissionPct: 14 },
    { name: 'Taj Palace', price: 8500, supplier: 'Supplier B', commissionPct: 18 },
  ];

  beforeEach(() => {
    redisMock = new RedisMock();
    service = new RedisService(redisMock as unknown as import('ioredis').Redis);
  });

  it('should return null when cache metadata is missing', async () => {
    const meta = await service.getCacheMeta('unknowncity');
    expect(meta).toBeNull();
  });

  it('should cache offers into Sorted Set, Hash, and Metadata String', async () => {
    await service.cacheOffers('delhi', sampleOffers, []);

    const meta = await service.getCacheMeta('delhi');
    expect(meta).not.toBeNull();
    expect(meta?.count).toBe(4);
    expect(meta?.degradedSuppliers).toEqual([]);

    const zsetMembers = await redisMock.zrange('hotels:prices:delhi', 0, -1);
    expect(zsetMembers).toHaveLength(4);
    expect(zsetMembers).toContain('holtin');
    expect(zsetMembers).toContain('radison');

    const holtinJson = await redisMock.hget('hotels:data:delhi', 'holtin');
    expect(holtinJson).not.toBeNull();
    const parsed = JSON.parse(holtinJson!);
    expect(parsed.price).toBe(5340);
  });

  it('should filter offers by price range (minPrice and maxPrice)', async () => {
    await service.cacheOffers('delhi', sampleOffers, []);

    const filtered = await service.getFilteredOffers('delhi', {
      minPrice: 5000,
      maxPrice: 6000,
    });

    expect(filtered).toHaveLength(2);
    expect(filtered.map((h) => h.name)).toEqual(['Holtin', 'Radison']);
    expect(filtered.every((h) => h.price >= 5000 && h.price <= 6000)).toBe(true);
  });

  it('should support pagination (limit and offset) in Redis range queries', async () => {
    await service.cacheOffers('delhi', sampleOffers, []);

    const page1 = await service.getFilteredOffers('delhi', { limit: 2, offset: 0 });
    expect(page1).toHaveLength(2);
    expect(page1[0].name).toBe('Holtin');
    expect(page1[1].name).toBe('Radison');

    const page2 = await service.getFilteredOffers('delhi', { limit: 2, offset: 2 });
    expect(page2).toHaveLength(2);
    expect(page2[0].name).toBe('Leela Ambience');
    expect(page2[1].name).toBe('Taj Palace');
  });

  it('should filter offers with minPrice only', async () => {
    await service.cacheOffers('delhi', sampleOffers, []);

    const filtered = await service.getFilteredOffers('delhi', { minPrice: 7000 });
    expect(filtered).toHaveLength(2);
    expect(filtered.map((h) => h.name)).toEqual(['Leela Ambience', 'Taj Palace']);
  });

  it('should filter offers with maxPrice only', async () => {
    await service.cacheOffers('delhi', sampleOffers, []);

    const filtered = await service.getFilteredOffers('delhi', { maxPrice: 5500 });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Holtin');
  });

  it('should handle caching 0 offers cleanly without failing', async () => {
    await service.cacheOffers('atlantis', [], []);

    const meta = await service.getCacheMeta('atlantis');
    expect(meta).not.toBeNull();
    expect(meta?.count).toBe(0);

    const offers = await service.getFilteredOffers('atlantis');
    expect(offers).toEqual([]);
  });

  it('should report healthy on ping', async () => {
    const health = await service.checkHealth();
    expect(health.status).toBe('up');
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
