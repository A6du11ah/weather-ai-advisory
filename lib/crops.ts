/**
 * Crop profiles.
 *
 * The advisory thresholds are not universal — a maize cob and a coffee cherry
 * do not dry at the same rate, and a crop sprayed close to harvest carries a
 * residue constraint that one sprayed at vegetative stage does not.
 *
 * Selecting a crop costs nothing in API quota: the same forecast payload is
 * re-scored client-side against different thresholds. That makes it the
 * cheapest real personalisation available on the free tier.
 *
 * Figures are drawn from extension guidance and are deliberately conservative.
 * They are shown in the UI so a user with better local knowledge can see what
 * the tool assumed and disagree with it.
 */

export interface CropProfile {
  id: string;
  name: string;
  /** Consecutive dry days needed to finish field drying. */
  minRunDays: number;
  /** Target storage moisture, percent — displayed, not computed against. */
  storageMoisturePct: number;
  /** Temperature below which drying is negligible. */
  floorTempC: number;
  /** Temperature at which drying is considered fully effective. */
  goodTempC: number;
  /** Lower bound for safe spray application. */
  sprayMinTempC: number;
  /** Upper bound — above this, evaporation and volatilisation losses rise. */
  sprayMaxTempC: number;
  /** One-line note shown under the selector. */
  note: string;
}

export const CROPS: CropProfile[] = [
  {
    id: "maize",
    name: "Maize",
    minRunDays: 3,
    storageMoisturePct: 13.5,
    floorTempC: 15,
    goodTempC: 25,
    sprayMinTempC: 10,
    sprayMaxTempC: 30,
    note: "Field drying from ~20% to a 13.5% storage target. Aflatoxin risk rises if partly dried grain is re-wetted.",
  },
  {
    id: "rice",
    name: "Rice (paddy)",
    minRunDays: 3,
    storageMoisturePct: 14,
    floorTempC: 18,
    goodTempC: 28,
    sprayMinTempC: 12,
    sprayMaxTempC: 32,
    note: "Dries to ~14%. Rapid drying in high heat causes kernel fissuring, so very hot days are not strictly better.",
  },
  {
    id: "wheat",
    name: "Wheat",
    minRunDays: 2,
    storageMoisturePct: 13,
    floorTempC: 12,
    goodTempC: 22,
    sprayMinTempC: 8,
    sprayMaxTempC: 28,
    note: "Dries faster than maize; a 2-day window is often enough. Target ~13% for storage.",
  },
  {
    id: "coffee",
    name: "Coffee (parchment)",
    minRunDays: 5,
    storageMoisturePct: 11,
    floorTempC: 18,
    goodTempC: 28,
    sprayMinTempC: 12,
    sprayMaxTempC: 30,
    note: "Slow sun-drying on beds to ~11%. Needs a long settled spell; interrupted drying causes mould and off-flavours.",
  },
  {
    id: "groundnut",
    name: "Groundnut",
    minRunDays: 4,
    storageMoisturePct: 8,
    floorTempC: 16,
    goodTempC: 27,
    sprayMinTempC: 10,
    sprayMaxTempC: 30,
    note: "Dries to ~8%. Highly aflatoxin-prone — re-wetting during drying is the main contamination pathway.",
  },
];

export const DEFAULT_CROP = CROPS[0];

export function findCrop(id: string | null | undefined): CropProfile {
  return CROPS.find((c) => c.id === id) ?? DEFAULT_CROP;
}
