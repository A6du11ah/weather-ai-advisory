/**
 * Crop growth-stage model.
 *
 * Given a planting date, place a crop on a coarse calendar of stages and
 * estimate how far it is from harvest. This is what lets the advisory say
 * something about *this field* rather than about the weather in general —
 * "flowering, heat-sensitive" or "two weeks to harvest, line up a drying
 * window" instead of a bare forecast.
 *
 * The stage boundaries are days-after-planting, deliberately simple. Real
 * phenology tracks growing-degree-days, which needs a temperature history the
 * free API tier does not provide. Days-after-planting is a defensible
 * approximation for a first product and is labelled as an estimate in the UI,
 * so a user with better local knowledge can see the assumption and discount
 * it. Figures are typical durations from extension crop calendars, rounded.
 */

export interface Stage {
  key: string;
  label: string;
  /** Day-after-planting this stage begins. */
  startDay: number;
  /** Short agronomic note for the stage. */
  note: string;
}

export interface CropCalendar {
  cropId: string;
  /** Typical days from planting to harvest maturity. */
  daysToHarvest: number;
  stages: Stage[];
  /**
   * Pre-harvest interval, days: the minimum a label typically requires between
   * the last spray and harvest. A conservative placeholder — real PHI is
   * product-specific and printed on the label, which always governs.
   */
  preHarvestIntervalDays: number;
}

// Durations are typical field-crop calendars; they vary widely by variety,
// latitude, and season, so they are approximations, not guarantees.
const CALENDARS: Record<string, CropCalendar> = {
  maize: {
    cropId: "maize",
    daysToHarvest: 120,
    preHarvestIntervalDays: 21,
    stages: [
      { key: "emergence", label: "Emergence", startDay: 0, note: "Seedlings establishing; weeds compete hardest now." },
      { key: "vegetative", label: "Vegetative", startDay: 20, note: "Rapid leaf growth; top-dressing nitrogen window." },
      { key: "flowering", label: "Tasselling / silking", startDay: 60, note: "Most heat- and drought-sensitive stage; protect against stress." },
      { key: "grainfill", label: "Grain fill", startDay: 80, note: "Kernels filling; moisture matters for final yield." },
      { key: "maturity", label: "Maturity / drydown", startDay: 110, note: "Grain drying in the field toward harvest moisture." },
    ],
  },
  rice: {
    cropId: "rice",
    daysToHarvest: 130,
    preHarvestIntervalDays: 21,
    stages: [
      { key: "seedling", label: "Seedling", startDay: 0, note: "Establishment; keep the paddy shallow and warm." },
      { key: "tillering", label: "Tillering", startDay: 25, note: "Tiller production; the main nitrogen-demand window." },
      { key: "panicle", label: "Panicle / flowering", startDay: 65, note: "Cold- and heat-sensitive; avoid stress at flowering." },
      { key: "ripening", label: "Ripening", startDay: 95, note: "Grain filling and drying down before harvest." },
    ],
  },
  wheat: {
    cropId: "wheat",
    daysToHarvest: 120,
    preHarvestIntervalDays: 21,
    stages: [
      { key: "tillering", label: "Tillering", startDay: 0, note: "Establishment and tillering." },
      { key: "stemext", label: "Stem extension", startDay: 45, note: "Rapid growth; key nitrogen and disease-watch window." },
      { key: "heading", label: "Heading / flowering", startDay: 70, note: "Flowering; the critical yield-setting stage." },
      { key: "ripening", label: "Ripening", startDay: 95, note: "Grain drying toward harvest." },
    ],
  },
  coffee: {
    cropId: "coffee",
    daysToHarvest: 240,
    preHarvestIntervalDays: 30,
    stages: [
      { key: "flowering", label: "Flowering", startDay: 0, note: "Blossom; rain timing sets the fruiting cycle." },
      { key: "expansion", label: "Berry expansion", startDay: 60, note: "Cherries sizing; steady moisture needed." },
      { key: "filling", label: "Bean filling", startDay: 150, note: "Beans developing inside the cherry." },
      { key: "ripening", label: "Ripening", startDay: 210, note: "Cherries colouring to red; selective picking begins." },
    ],
  },
  groundnut: {
    cropId: "groundnut",
    daysToHarvest: 110,
    preHarvestIntervalDays: 21,
    stages: [
      { key: "emergence", label: "Emergence", startDay: 0, note: "Seedlings establishing." },
      { key: "flowering", label: "Flowering / pegging", startDay: 30, note: "Pegs entering the soil; keep it moist, avoid disturbance." },
      { key: "podfill", label: "Pod fill", startDay: 60, note: "Pods and kernels developing." },
      { key: "maturity", label: "Maturity", startDay: 95, note: "Drying down; timely lifting limits aflatoxin risk." },
    ],
  },
};

export interface GrowthState {
  hasCalendar: boolean;
  stage: Stage | null;
  daysAfterPlanting: number | null;
  daysToHarvest: number | null;
  /** Estimated harvest date, ISO, when planting date is known. */
  estimatedHarvest: string | null;
  preHarvestIntervalDays: number | null;
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(`${fromISO.slice(0, 10)}T00:00:00Z`).getTime();
  const b = new Date(`${toISO.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Where is this crop today?
 *
 * `today` is the field's local calendar date (the forecast's first day), kept
 * an explicit argument so the result is deterministic and testable. With no
 * planting date the calendar cannot be placed, and `hasCalendar` is false.
 */
export function growthState(
  cropId: string,
  plantingDate: string | null,
  today: string,
): GrowthState {
  const cal = CALENDARS[cropId];
  if (!cal || !plantingDate) {
    return {
      hasCalendar: false,
      stage: null,
      daysAfterPlanting: null,
      daysToHarvest: null,
      estimatedHarvest: null,
      preHarvestIntervalDays: cal?.preHarvestIntervalDays ?? null,
    };
  }

  const dap = daysBetween(plantingDate, today);
  const stage =
    [...cal.stages].reverse().find((s) => dap >= s.startDay) ?? cal.stages[0];

  return {
    hasCalendar: true,
    stage,
    daysAfterPlanting: dap,
    daysToHarvest: cal.daysToHarvest - dap,
    estimatedHarvest: addDays(plantingDate, cal.daysToHarvest),
    preHarvestIntervalDays: cal.preHarvestIntervalDays,
  };
}

export function hasCalendar(cropId: string): boolean {
  return cropId in CALENDARS;
}
