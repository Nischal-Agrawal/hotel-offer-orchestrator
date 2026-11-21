import { SupplierHotelOffer } from '../domain/types.js';

/**
 * Deterministic mock datasets for Supplier A and Supplier B.
 * Designed to satisfy every business requirement and test case:
 * 1. Holtin: Supplier A (6000, 10%), Supplier B (5340, 20%) -> Supplier B wins on lower price.
 * 2. Radison: Supplier A (5900, 13%), Supplier B (6450, 15%) -> Supplier A wins on lower price.
 * 3. Taj Palace: Equal price (8500), Supplier A (12%), Supplier B (18%) -> Supplier B wins on higher commission.
 * 4. The Oberoi: Whitespace / case normalization test ("The Oberoi" vs "the oberoi ").
 * 5. Exclusive hotels: Leela Ambience (only in A), ITC Maurya (only in B).
 * 6. Multi-city isolation (Mumbai dataset).
 */
export const SUPPLIER_A_HOTELS: SupplierHotelOffer[] = [
  {
    hotelId: 'a1',
    name: 'Holtin',
    price: 6000,
    city: 'delhi',
    commissionPct: 10,
  },
  {
    hotelId: 'a2',
    name: 'Radison',
    price: 5900,
    city: 'delhi',
    commissionPct: 13,
  },
  {
    hotelId: 'a3',
    name: 'Taj Palace',
    price: 8500,
    city: 'delhi',
    commissionPct: 12,
  },
  {
    hotelId: 'a4',
    name: 'The Oberoi',
    price: 12000,
    city: 'delhi',
    commissionPct: 15,
  },
  {
    hotelId: 'a5',
    name: 'Leela Ambience',
    price: 7200,
    city: 'delhi',
    commissionPct: 14,
  },
  // Mumbai hotels
  {
    hotelId: 'a6',
    name: 'Trident Nariman Point',
    price: 9500,
    city: 'mumbai',
    commissionPct: 12,
  },
  {
    hotelId: 'a7',
    name: 'Taj Lands End',
    price: 11000,
    city: 'mumbai',
    commissionPct: 10,
  },
  {
    hotelId: 'a8',
    name: 'Grand Hyatt Mumbai',
    price: 8200,
    city: 'mumbai',
    commissionPct: 15,
  },
];

export const SUPPLIER_B_HOTELS: SupplierHotelOffer[] = [
  {
    hotelId: 'b1',
    name: 'Holtin',
    price: 5340,
    city: 'delhi',
    commissionPct: 20,
  },
  {
    hotelId: 'b2',
    name: 'Radison',
    price: 6450,
    city: 'delhi',
    commissionPct: 15,
  },
  {
    hotelId: 'b3',
    name: 'Taj Palace',
    price: 8500,
    city: 'delhi',
    commissionPct: 18,
  },
  {
    hotelId: 'b4',
    name: 'the oberoi ',
    price: 11500,
    city: 'delhi',
    commissionPct: 16,
  },
  {
    hotelId: 'b5',
    name: 'ITC Maurya',
    price: 9100,
    city: 'delhi',
    commissionPct: 17,
  },
  // Mumbai hotels
  {
    hotelId: 'b6',
    name: 'Trident Nariman Point',
    price: 9200,
    city: 'mumbai',
    commissionPct: 14,
  },
  {
    hotelId: 'b7',
    name: 'Taj Lands End',
    price: 11500,
    city: 'mumbai',
    commissionPct: 18,
  },
  {
    hotelId: 'b8',
    name: 'JW Marriott Juhu',
    price: 10500,
    city: 'mumbai',
    commissionPct: 16,
  },
];
