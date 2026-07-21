/**
 * Advisory rules engine.
 *
 * Two decisions from one forecast:
 *
 *   Grain drying — is there a run of consecutive days dry and sunny enough
 *   to bring maize below the moisture level at which Aspergillus produces
 *   aflatoxin?
 *
 *   Spraying — is there an hour to apply after which no washing rain falls
 *   inside the product's rainfast period?
 *
 * Thresholds are sourced (see SOURCES) and surfaced in the UI so a user can
 * audit a verdict rather than trust it.
 *
 * Data constraints, verified against the live free tier:
 *   - No humidity field exists, so drying effectiveness uses weathercode as
 *     a sunshine proxy (see lib/weathercode.ts).
 *   - Wind exists only as a current observation, never as a forecast, so it
 *     cannot enter per-hour spray scoring. It is reported separately as a
 *     pre-application check.
 *   - hourly covers 48h and begins at 00:00 today, so a 24h lookahead runs
 *     off the end almost immediately. buildPrecipTimeline() extends it with
 *     daily totals.
 */

import type { DayPoint, HourPoint, Place } from "./types";
import { describeCode } from "./weathercode";
import { DEFAULT_CROP, type CropProfile } from "./crops";
import { isSprayableHour } from "./solar";

export const SOURCES = {
  aflatoxin: {
    label: "Maize drying and safe storage moisture (FAO)",
    // Corrected 2026-07-20. An earlier version of this note stated "above 13%
    // Aspergillus proliferates" — that conflates a storage-safety target with
    // the biological growth threshold, which is considerably higher. Keeping
    // the distinction matters: the whole premise of this tool is that a claim
    // can be checked against the source printed beside it.
    note: "Maize is commonly harvested at 18–25% moisture and must be dried for storage. Fungal growth largely halts below about 12–13% moisture, so ~13.5% is the usual storage target — deliberately below the level at which Aspergillus grows and produces aflatoxin. Rain during drying lets partially dried grain reabsorb moisture, undoing progress already made.",
    url: "https://www.fao.org/4/x5036e/x5036e0s.htm",
  },
  rainfast: {
    label: "Pesticide rainfastness",
    note: "Loss of efficacy is greatest when rain falls soon after application and diminishes as the deposit dries and is absorbed. At 24 hours most products tolerate roughly 25mm; around 50mm removes enough residue to force a reapplication.",
    url: "https://sprayers101.com/rainfastness-pesticide/",
  },
  sprayDrift: {
    label: "Spray drift and wind",
    note: "Very light wind risks temperature inversion and suspended fine droplets; strong wind carries product off-target. Extension guidance favours a light, steady breeze of roughly 3–15 km/h.",
    url: "https://ipm.missouri.edu/meg/index.cfm?ID=468",
  },
} as const;

export const THRESHOLDS = {
  drying: {
    /** A day counts as dry below this much rainfall. */
    dryDayMaxPrecipMm: 1.0,
    /** Consecutive dry days needed for a usable drying run. */
    minRunDays: 3,
    /** Temperature at which drying is considered fully effective. */
    goodTempC: 25,
    /** Below this, drying is negligible regardless of sunshine. */
    floorTempC: 15,
  },
  spray: {
    /** Hours of rain-free weather required after application. */
    rainfastHours: 24,
    /** Rain above this inside the rainfast window forces reapplication. */
    washoffMm: 25,
    minWindKph: 3,
    maxWindKph: 15,
    minTempC: 10,
    maxTempC: 30,
  },
} as const;

export type Verdict = "good" | "marginal" | "poor";

export interface Evidence {
  label: string;
  value: string;
  ok: boolean;
}

export interface DryingWindow {
  startDate: string;
  endDate: string;
  days: number;
  verdict: Verdict;
  score: number;
  /** Does this run reach the minimum length needed to finish drying? */
  sufficient: boolean;
  evidence: Evidence[];
}

export interface SprayWindow {
  time: string;
  verdict: Verdict;
  score: number;
  /** Raw rainfall total across the rainfast window. Shown to the user. */
  rainNext24hMm: number;
  /** Time-weighted washoff — what actually drives the score. */
  effectiveWashMm: number;
  /** True when the rainfast lookahead was partly estimated from daily totals. */
  estimated: boolean;
  evidence: Evidence[];
}

export interface WindCheck {
  windKph: number;
  ok: boolean;
  note: string;
}

function verdictFromScore(score: number): Verdict {
  if (score >= 70) return "good";
  if (score >= 40) return "marginal";
  return "poor";
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Is this day dry enough to spread grain?
 *
 * Decided on measured rainfall alone, not on the weather code. A day can be
 * coded "light drizzle" while recording 0.3mm — a passing sprinkle, not a
 * reason to leave the harvest in the store. Using the code as a veto here
 * discards otherwise usable runs; it belongs in the *quality* term below.
 */
function isDryDay(day: DayPoint): boolean {
  return day.precipMm <= THRESHOLDS.drying.dryDayMaxPrecipMm;
}

/**
 * Score a day's drying power, 0–100.
 *
 * Warmth and sunshine separate a technically-dry day from one that actually
 * pulls moisture out of grain. A day that logged trace rain is treated as no
 * better than overcast — damp air, weak drying — rather than as a washout.
 */
function scoreDryingDay(day: DayPoint, crop: CropProfile): number {
  if (!isDryDay(day)) return 0;

  const info = describeCode(day.code);
  // A wet-coded day that stayed under the rainfall threshold was damp, not
  // rained on. Floor it at roughly "overcast" instead of near-zero.
  const dryingFactor =
    info.wet && day.precipMm > 0
      ? Math.max(info.dryingFactor, 0.35)
      : info.dryingFactor;

  const warmth = clamp(
    (day.tempMaxC - crop.floorTempC) / (crop.goodTempC - crop.floorTempC),
    0,
    1,
  );

  return Math.round(100 * (0.55 * warmth + 0.45 * dryingFactor));
}

/**
 * Find runs of consecutive dry days.
 *
 * Every run is returned, including those shorter than `minRunDays`, each
 * flagged `sufficient`. Reporting the near-misses matters: "the longest dry
 * spell is two days, and you need three" is actionable, where an empty
 * result reads as a broken page.
 */
export function findDryingWindows(
  days: DayPoint[],
  crop: CropProfile = DEFAULT_CROP,
): DryingWindow[] {
  const t = THRESHOLDS.drying;
  const minRunDays = crop.minRunDays;
  const windows: DryingWindow[] = [];

  let runStart = -1;
  const flush = (endExclusive: number) => {
    if (runStart < 0) return;
    const run = days.slice(runStart, endExclusive);

    const scores = run.map((d) => scoreDryingDay(d, crop));
    const score = Math.round(scores.reduce((a, b) => a + b, 0) / run.length);
    const maxTemp = Math.max(...run.map((d) => d.tempMaxC));
    const totalRain = run.reduce((a, d) => a + d.precipMm, 0);
    const sunniest = run
      .map((d) => describeCode(d.code))
      .sort((a, b) => b.dryingFactor - a.dryingFactor)[0];
    const meanSun =
      run.reduce((a, d) => a + describeCode(d.code).dryingFactor, 0) /
      run.length;
    const sufficient = run.length >= minRunDays;

    windows.push({
      startDate: run[0].date,
      endDate: run[run.length - 1].date,
      days: run.length,
      // A run too short to finish drying is never a "go", however sunny.
      score: sufficient ? score : Math.min(score, 39),
      verdict: sufficient ? verdictFromScore(score) : "poor",
      sufficient,
      evidence: [
        {
          label: "Consecutive dry days",
          value: `${run.length} of ${minRunDays} needed`,
          ok: sufficient,
        },
        {
          label: "Rain across window",
          value: `${totalRain.toFixed(1)} mm`,
          ok: totalRain <= t.dryDayMaxPrecipMm * run.length,
        },
        {
          label: "Peak temperature",
          value: `${maxTemp.toFixed(0)} °C`,
          ok: maxTemp >= crop.goodTempC,
        },
        {
          label: "Best conditions",
          value: sunniest.label,
          ok: meanSun >= 0.6,
        },
      ],
    });
    runStart = -1;
  };

  days.forEach((day, i) => {
    if (isDryDay(day)) {
      if (runStart < 0) runStart = i;
    } else {
      flush(i);
    }
  });
  flush(days.length);

  // Usable windows first, then the best near-miss.
  return windows.sort((a, b) => {
    if (a.sufficient !== b.sufficient) return a.sufficient ? -1 : 1;
    if (a.days !== b.days && !a.sufficient) return b.days - a.days;
    return b.score - a.score;
  });
}

interface TimelinePoint {
  time: Date;
  precipMm: number;
  /** True when this point was interpolated from a daily total. */
  estimated: boolean;
}

/**
 * Build an hourly precipitation timeline spanning the whole forecast.
 *
 * The API gives 48 hours of hourly data but 7 days of daily data. Scoring a
 * 24-hour rainfast window off the hourly series alone would leave only a
 * handful of usable candidate hours, so days beyond the hourly horizon are
 * spread evenly across their 24 hours and flagged `estimated`.
 *
 * Even spreading is crude — real rain is bursty — but for the question being
 * asked ("does *any* washing rain fall in this window?") the daily total is
 * the load-bearing number, and the flag keeps the estimate visible.
 */
function buildPrecipTimeline(
  hours: HourPoint[],
  days: DayPoint[],
): TimelinePoint[] {
  const points: TimelinePoint[] = hours.map((h) => ({
    time: new Date(h.time),
    precipMm: h.precipMm,
    estimated: false,
  }));

  const lastHourly = points.length > 0 ? points[points.length - 1].time : null;

  for (const day of days) {
    const dayStart = new Date(`${day.date}T00:00`);
    for (let h = 0; h < 24; h++) {
      const t = new Date(dayStart.getTime() + h * 3_600_000);
      if (lastHourly && t <= lastHourly) continue; // hourly data wins
      points.push({
        time: t,
        precipMm: day.precipMm / 24,
        estimated: true,
      });
    }
  }

  return points.sort((a, b) => a.time.getTime() - b.time.getTime());
}

/**
 * Time-weighted washoff.
 *
 * The cited guidance is explicit that *when* rain falls matters more than how
 * much: a deposit is most vulnerable immediately after application and becomes
 * progressively rainfast as it dries and is absorbed, until by roughly 24
 * hours most products tolerate ~25mm without losing efficacy.
 *
 * An earlier version summed rainfall across the window with no time term,
 * which scored 20mm one hour after application about the same as 20mm at
 * hour 23 — contradicting the source displayed beside the verdict in the UI.
 *
 * Vulnerability decays linearly from 1.0 at the moment of application to 0 at
 * `rainfastHours`. Linear is a simplification of what is really a drying curve,
 * but it captures the ordering the source cares about and keeps the model
 * legible enough to argue with, which matters more here than false precision.
 */
function weightedWashoff(points: TimelinePoint[], appliedAt: Date): number {
  const t = THRESHOLDS.spray;
  return points.reduce((sum, p) => {
    const hoursAfter = (p.time.getTime() - appliedAt.getTime()) / 3_600_000;
    const vulnerability = clamp(1 - hoursAfter / t.rainfastHours, 0, 1);
    return sum + p.precipMm * vulnerability;
  }, 0);
}

/**
 * Rank spray windows.
 *
 * Only hours from now onward are considered — the API's hourly series starts
 * at midnight, so a large part of it is already in the past.
 */
export function findSprayWindows(
  hours: HourPoint[],
  days: DayPoint[],
  now: Date = new Date(),
  crop: CropProfile = DEFAULT_CROP,
  place?: Place,
): SprayWindow[] {
  const t = THRESHOLDS.spray;
  const timeline = buildPrecipTimeline(hours, days);
  const windows: SprayWindow[] = [];

  // The last instant we have any precipitation data for. An hour can only be
  // scored if its entire rainfast window falls at or before this — otherwise
  // unobserved hours are silently counted as zero rain, which turns "we don't
  // know" into a confident recommendation.
  const timelineEnd =
    timeline.length > 0 ? timeline[timeline.length - 1].time : null;

  for (const h of hours) {
    const at = new Date(h.time);
    if (at <= now) continue;
    if (h.precipMm > 0.2 || describeCode(h.code).wet) continue;

    // Daylight gate. Without a location we cannot compute it, so the check is
    // skipped; with one, drop hours outside the sprayable part of the day so
    // the scorer can never recommend a rainfast but pitch-dark 03:00 slot. The
    // hour is read lexically from the offset-less local timestamp rather than
    // via Date, whose parse would apply the server's timezone.
    if (place) {
      const localHour = Number(h.time.slice(11, 13)) + Number(h.time.slice(14, 16)) / 60;
      const dayDate = new Date(`${h.time.slice(0, 10)}T00:00`);
      if (!isSprayableHour(place.lat, place.lon, localHour, dayDate)) continue;
    }

    const windowEnd = new Date(at.getTime() + t.rainfastHours * 3_600_000);
    if (!timelineEnd || timelineEnd < windowEnd) continue;

    const inWindow = timeline.filter((p) => p.time > at && p.time <= windowEnd);
    if (inWindow.length === 0) continue;

    const rain24 = inWindow.reduce((sum, p) => sum + p.precipMm, 0);
    const effectiveWashMm = weightedWashoff(inWindow, at);
    const estimated = inWindow.some((p) => p.estimated);
    const tempOk =
      h.tempC >= crop.sprayMinTempC && h.tempC <= crop.sprayMaxTempC;

    // Rain after application dominates: perfect temperature is worthless if
    // the product washes off before it works. Scoring uses the time-weighted
    // figure, not the raw total — see weightedWashoff().
    const rainScore = clamp(1 - effectiveWashMm / t.washoffMm, 0, 1);
    const score = Math.round(100 * (0.8 * rainScore + 0.2 * (tempOk ? 1 : 0.3)));

    windows.push({
      time: h.time,
      score,
      verdict: verdictFromScore(score),
      rainNext24hMm: rain24,
      effectiveWashMm,
      estimated,
      evidence: [
        {
          label: `Rain in next ${t.rainfastHours}h`,
          value: `${rain24.toFixed(1)} mm${estimated ? " (est.)" : ""}`,
          ok: rain24 < t.washoffMm,
        },
        {
          label: "Washing effect (time-weighted)",
          value: `${effectiveWashMm.toFixed(1)} mm`,
          ok: effectiveWashMm < t.washoffMm,
        },
        {
          label: "Temperature at application",
          value: `${h.tempC.toFixed(0)} °C`,
          ok: tempOk,
        },
        {
          label: "Conditions",
          value: describeCode(h.code).label,
          ok: !describeCode(h.code).wet,
        },
      ],
    });
  }

  return windows.sort((a, b) => b.score - a.score);
}

/** Best spray window per calendar day, so the UI shows a spread of options. */
export function bestSprayWindowPerDay(
  hours: HourPoint[],
  days: DayPoint[],
  now?: Date,
  crop: CropProfile = DEFAULT_CROP,
  place?: Place,
): SprayWindow[] {
  const byDay = new Map<string, SprayWindow>();

  for (const w of findSprayWindows(hours, days, now, crop, place)) {
    const day = w.time.slice(0, 10);
    const existing = byDay.get(day);
    if (!existing || w.score > existing.score) byDay.set(day, w);
  }

  return [...byDay.values()].sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * The one-line answer to "what do I do today?"
 *
 * The two advisory cards each answer a question well, but neither answers the
 * question a farmer actually arrives with. Without this, the user has to read
 * both cards and infer the conclusion — which is exactly the cognitive work
 * the product exists to remove.
 */
export interface Headline {
  /** English text — the API contract and the fallback. */
  text: string;
  /** Translation key + params so the client can render a localized version. */
  key: string;
  params: Record<string, string>;
}

export function todayHeadline(
  drying: DryingWindow | null,
  spray: SprayWindow | null,
  today: string,
): Headline {
  const dryingStartsToday = drying?.startDate === today;
  const sprayIsToday = spray?.time.slice(0, 10) === today && spray.verdict !== "poor";

  if (dryingStartsToday && sprayIsToday) {
    return {
      text: "Spread grain to dry today, and spraying is viable — check wind before you go.",
      key: "hl.dryAndSpray",
      params: {},
    };
  }
  if (dryingStartsToday) {
    return { text: "Good drying starts today. Spread the harvest.", key: "hl.dryToday", params: {} };
  }
  if (sprayIsToday) {
    return { text: "No drying window today, but spraying is viable.", key: "hl.sprayToday", params: {} };
  }
  if (drying) {
    return {
      text: `Nothing to do today. The next drying window opens ${drying.startDate}.`,
      key: "hl.nextDry",
      params: { date: drying.startDate },
    };
  }
  if (spray && spray.verdict !== "poor") {
    const d = spray.time.slice(0, 10);
    return {
      text: `Nothing to do today. Next viable spray window is ${d}.`,
      key: "hl.nextSpray",
      params: { date: d },
    };
  }
  return {
    text: "Nothing to do today, and nothing viable in the 7-day outlook. Keep the harvest covered.",
    key: "hl.nothing",
    params: {},
  };
}

/**
 * Wind check from the current observation.
 *
 * The API provides no wind forecast, only a current reading, so this cannot
 * inform *when* to spray. It is surfaced as a go/no-go check to perform at
 * the moment of application rather than folded into the scoring, which would
 * imply a forecast we do not have.
 */
export function currentWindCheck(windKph: number): WindCheck {
  const t = THRESHOLDS.spray;
  if (windKph < t.minWindKph) {
    return {
      windKph,
      ok: false,
      note: "Too still — fine droplets can hang and drift on an inversion.",
    };
  }
  if (windKph > t.maxWindKph) {
    return {
      windKph,
      ok: false,
      note: "Too windy — high risk of off-target drift.",
    };
  }
  return {
    windKph,
    ok: true,
    note: "Light steady breeze, within the recommended range.",
  };
}
