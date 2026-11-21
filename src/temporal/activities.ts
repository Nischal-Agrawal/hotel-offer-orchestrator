import { SupplierHotelOffer, HotelOffer } from '../domain/types.js';
import { env } from '../config/env.js';
import { redisService } from '../services/redis.service.js';
import { logger } from '../utils/logger.js';

/**
 * Fetches hotel listings for a given city from Supplier A.
 */
export async function fetchSupplierAHotels(city: string): Promise<SupplierHotelOffer[]> {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    const { supplierState } = await import('../suppliers/supplierState.js');
    const state = supplierState.getStatus('supplierA');
    if (!state.healthy) {
      throw new Error('Supplier A temporarily unavailable');
    }
    const { SUPPLIER_A_HOTELS } = await import('../suppliers/mockData.js');
    return SUPPLIER_A_HOTELS.filter((h) => h.city.toLowerCase() === city.toLowerCase());
  }

  const url = `${env.SUPPLIER_BASE_URL}/supplierA/hotels?city=${encodeURIComponent(city)}`;
  logger.info({ url, city }, 'Activity: Fetching from Supplier A');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Supplier A returned HTTP ${response.status}: ${await response.text()}`);
    }
    const data = (await response.json()) as SupplierHotelOffer[];
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchSupplierBHotels(city: string): Promise<SupplierHotelOffer[]> {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    const { supplierState } = await import('../suppliers/supplierState.js');
    const state = supplierState.getStatus('supplierB');
    if (!state.healthy) {
      throw new Error('Supplier B temporarily unavailable');
    }
    const { SUPPLIER_B_HOTELS } = await import('../suppliers/mockData.js');
    return SUPPLIER_B_HOTELS.filter((h) => h.city.toLowerCase() === city.toLowerCase());
  }

  const url = `${env.SUPPLIER_BASE_URL}/supplierB/hotels?city=${encodeURIComponent(city)}`;
  logger.info({ url, city }, 'Activity: Fetching from Supplier B');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Supplier B returned HTTP ${response.status}: ${await response.text()}`);
    }
    const data = (await response.json()) as SupplierHotelOffer[];
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Activity to persist deduplicated hotel offers in Redis (ZSET + HASH + metadata).
 */
export async function cacheHotelOffersInRedis(
  city: string,
  offers: HotelOffer[],
  degradedSuppliers: string[]
): Promise<void> {
  logger.info({ city, offerCount: offers.length, degradedSuppliers }, 'Activity: Caching in Redis');
  await redisService.cacheOffers(city, offers, degradedSuppliers);
}
