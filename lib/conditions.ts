/**
 * Additional weather-driven watches, all honest with the temperature + rain
 * data the forecast provides — no humidity-based guesses.
 *
 *   Frost / cold watch  — overnight lows at or below a crop's cold threshold.
 *   Heat stress         — daytime highs above a crop's heat threshold.
 *   Field-work window   — the next run of consecutive dry days to get in the
 *                         field (harvest, cutting, access).
 *
 * These broaden the app beyond the two headline decisions without pretending
 * to precision the data cannot support.
 */

import type { DayPoint } from "./types";
import type { CropProfile } from "./crops";

export interface FrostWatch {
  date: string;
  minC: number;
  /** Days from the forecast's first day until this night. */
  leadDays: number;
  severity: "frost" | "near";
}

export interface HeatWatch {
  /** First day at or above the heat threshold. */
  date: string;
  maxC: number;
  leadDays: number;
  /** How many days in the window breach the threshold. */
  count: number;
}

export interface WorkWindow {
  startDate: string;
  endDate: string;
  days: number;
}

const DRY_MM = 1.0;

/**
 * The nearest upcoming night at or near the crop's cold threshold.
 *
 * "frost" when at/below the threshold, "near" within 2°C above it — a heads-up
 * before it becomes damage. Returns null when nothing in the window is cold.
 */
export function frostWatch(days: DayPoint[], crop: CropProfile): FrostWatch | null {
  for (let i = 0; i < days.length; i++) {
    const min = days[i].tempMinC;
    if (min <= crop.frostThresholdC) {
      return { date: days[i].date, minC: min, leadDays: i, severity: "frost" };
    }
    if (min <= crop.frostThresholdC + 2) {
      return { date: days[i].date, minC: min, leadDays: i, severity: "near" };
    }
  }
  return null;
}

/**
 * The nearest upcoming day at or above the crop's heat threshold, plus a count
 * of how many days in the window breach it.
 */
export function heatStress(days: DayPoint[], crop: CropProfile): HeatWatch | null {
  let result: HeatWatch | null = null;
  let count = 0;
  days.forEach((d, i) => {
    if (d.tempMaxC >= crop.heatThresholdC) {
      count += 1;
      if (!result) result = { date: d.date, maxC: d.tempMaxC, leadDays: i, count: 0 };
    }
  });
  if (result) (result as HeatWatch).count = count;
  return result;
}

/**
 * The next run of consecutive dry days (≤1mm) at least 2 days long — a window
 * to harvest or otherwise work the field. Distinct from grain drying, which is
 * about temperature and sunshine quality; this is simply "is the ground dry
 * enough to get in."
 */
export function fieldWorkWindow(days: DayPoint[]): WorkWindow | null {
  let start = -1;
  for (let i = 0; i <= days.length; i++) {
    const dry = i < days.length && days[i].precipMm <= DRY_MM;
    if (dry && start < 0) start = i;
    if (!dry && start >= 0) {
      const len = i - start;
      if (len >= 2) {
        return { startDate: days[start].date, endDate: days[i - 1].date, days: len };
      }
      start = -1;
    }
  }
  return null;
}
