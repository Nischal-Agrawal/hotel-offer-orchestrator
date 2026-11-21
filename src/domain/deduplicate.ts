import { SupplierHotelOffer, HotelOffer } from './types.js';

/**
 * Normalizes a hotel name for deterministic canonical matching:
 * trims, lowercases, removes punctuation, and collapses internal whitespace.
 * Handles variations like "The Oberoi, New Delhi" vs "the oberoi".
 */
export function normalizeHotelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export interface TaggedOffer {
  offer: SupplierHotelOffer;
  supplierName: string;
}

/**
 * Pure deduplication engine:
 * 1. Groups offers by normalized hotel name.
 * 2. Compares duplicate offers:
 *    - Lower price wins.
 *    - If prices are equal: higher commissionPct wins (better platform margin).
 *    - If still equal: deterministic alphabetical sort by supplier name.
 * 3. Returns final deduplicated list sorted ascending by price, then hotel name.
 */
export function deduplicateHotelOffers(taggedOffers: TaggedOffer[]): HotelOffer[] {
  const bestOffersByNormalizedName = new Map<string, HotelOffer>();

  for (const { offer, supplierName } of taggedOffers) {
    const key = normalizeHotelName(offer.name);
    const candidate: HotelOffer = {
      name: offer.name.trim().replace(/\s+/g, ' '),
      price: offer.price,
      supplier: supplierName,
      commissionPct: offer.commissionPct,
    };

    const existing = bestOffersByNormalizedName.get(key);

    if (!existing) {
      bestOffersByNormalizedName.set(key, candidate);
      continue;
    }

    // Comparison rules:
    // 1. Lower price wins
    if (candidate.price < existing.price) {
      bestOffersByNormalizedName.set(key, candidate);
    } else if (candidate.price === existing.price) {
      // 2. Higher commissionPct wins
      if (candidate.commissionPct > existing.commissionPct) {
        bestOffersByNormalizedName.set(key, candidate);
      } else if (candidate.commissionPct === existing.commissionPct) {
        // 3. Alphabetical tie-breaker by supplier name
        if (candidate.supplier.localeCompare(existing.supplier) < 0) {
          bestOffersByNormalizedName.set(key, candidate);
        }
      }
    }
  }

  // Sort final offers ascending by price, then alphabetically by name
  return Array.from(bestOffersByNormalizedName.values()).sort((a, b) => {
    if (a.price !== b.price) {
      return a.price - b.price;
    }
    return a.name.localeCompare(b.name);
  });
}
