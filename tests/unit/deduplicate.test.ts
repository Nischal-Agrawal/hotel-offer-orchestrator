import { describe, it, expect } from 'vitest';
import { deduplicateHotelOffers, normalizeHotelName, TaggedOffer } from '../../src/domain/deduplicate.js';

describe('normalizeHotelName', () => {
  it('should trim, lowercase, remove punctuation, and collapse multiple spaces', () => {
    expect(normalizeHotelName('  The   Oberoi, New Delhi!  ')).toBe('the oberoi new delhi');
    expect(normalizeHotelName('HOLTIN-HOTELS')).toBe('holtin hotels');
    expect(normalizeHotelName('Radison\tBlu')).toBe('radison blu');
  });
});

describe('deduplicateHotelOffers', () => {
  it('should select cheaper price when hotel appears in both suppliers', () => {
    const tagged: TaggedOffer[] = [
      {
        offer: { hotelId: 'a1', name: 'Holtin', price: 6000, city: 'delhi', commissionPct: 10 },
        supplierName: 'Supplier A',
      },
      {
        offer: { hotelId: 'b1', name: 'Holtin', price: 5340, city: 'delhi', commissionPct: 20 },
        supplierName: 'Supplier B',
      },
    ];

    const result = deduplicateHotelOffers(tagged);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'Holtin',
      price: 5340,
      supplier: 'Supplier B',
      commissionPct: 20,
    });
  });

  it('should select Supplier A when Supplier A has lower price', () => {
    const tagged: TaggedOffer[] = [
      {
        offer: { hotelId: 'a2', name: 'Radison', price: 5900, city: 'delhi', commissionPct: 13 },
        supplierName: 'Supplier A',
      },
      {
        offer: { hotelId: 'b2', name: 'Radison', price: 6450, city: 'delhi', commissionPct: 15 },
        supplierName: 'Supplier B',
      },
    ];

    const result = deduplicateHotelOffers(tagged);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'Radison',
      price: 5900,
      supplier: 'Supplier A',
      commissionPct: 13,
    });
  });

  it('should break price ties using higher commissionPct', () => {
    const tagged: TaggedOffer[] = [
      {
        offer: { hotelId: 'a3', name: 'Taj Palace', price: 8500, city: 'delhi', commissionPct: 12 },
        supplierName: 'Supplier A',
      },
      {
        offer: { hotelId: 'b3', name: 'Taj Palace', price: 8500, city: 'delhi', commissionPct: 18 },
        supplierName: 'Supplier B',
      },
    ];

    const result = deduplicateHotelOffers(tagged);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'Taj Palace',
      price: 8500,
      supplier: 'Supplier B',
      commissionPct: 18,
    });
  });

  it('should break price and commission ties alphabetically by supplier name', () => {
    const tagged: TaggedOffer[] = [
      {
        offer: { hotelId: 'b4', name: 'Grand Hotel', price: 5000, city: 'delhi', commissionPct: 15 },
        supplierName: 'Supplier B',
      },
      {
        offer: { hotelId: 'a4', name: 'Grand Hotel', price: 5000, city: 'delhi', commissionPct: 15 },
        supplierName: 'Supplier A',
      },
    ];

    const result = deduplicateHotelOffers(tagged);
    expect(result).toHaveLength(1);
    expect(result[0].supplier).toBe('Supplier A');
  });

  it('should normalize case, punctuation, and whitespace during deduplication', () => {
    const tagged: TaggedOffer[] = [
      {
        offer: { hotelId: 'a5', name: 'The Oberoi, New Delhi', price: 12000, city: 'delhi', commissionPct: 15 },
        supplierName: 'Supplier A',
      },
      {
        offer: { hotelId: 'b5', name: '  the   oberoi  new delhi ', price: 11500, city: 'delhi', commissionPct: 16 },
        supplierName: 'Supplier B',
      },
    ];

    const result = deduplicateHotelOffers(tagged);
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(11500);
    expect(result[0].supplier).toBe('Supplier B');
  });

  it('should preserve exclusive hotels from either supplier', () => {
    const tagged: TaggedOffer[] = [
      {
        offer: { hotelId: 'a6', name: 'Leela Ambience', price: 7200, city: 'delhi', commissionPct: 14 },
        supplierName: 'Supplier A',
      },
      {
        offer: { hotelId: 'b6', name: 'ITC Maurya', price: 9100, city: 'delhi', commissionPct: 17 },
        supplierName: 'Supplier B',
      },
    ];

    const result = deduplicateHotelOffers(tagged);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name)).toEqual(['Leela Ambience', 'ITC Maurya']);
  });

  it('should sort final offers ascending by price, then name', () => {
    const tagged: TaggedOffer[] = [
      {
        offer: { hotelId: '1', name: 'Hotel C', price: 9000, city: 'delhi', commissionPct: 10 },
        supplierName: 'Supplier A',
      },
      {
        offer: { hotelId: '2', name: 'Hotel A', price: 3000, city: 'delhi', commissionPct: 10 },
        supplierName: 'Supplier A',
      },
      {
        offer: { hotelId: '3', name: 'Hotel B', price: 3000, city: 'delhi', commissionPct: 10 },
        supplierName: 'Supplier B',
      },
    ];

    const result = deduplicateHotelOffers(tagged);
    expect(result.map((r) => r.name)).toEqual(['Hotel A', 'Hotel B', 'Hotel C']);
    expect(result.map((r) => r.price)).toEqual([3000, 3000, 9000]);
  });

  it('should return empty array when input is empty', () => {
    expect(deduplicateHotelOffers([])).toEqual([]);
  });
});
