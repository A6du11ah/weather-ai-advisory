/**
 * Advisory assembly.
 *
 * The single place a Forecast becomes the advisory payload the UI consumes.
 * Both the live request route and the database-backed station pages call this,
 * so the two paths cannot drift apart — a bug fixed here is fixed everywhere,
 * and the diff engine compares like against like.
 *
 * Pure: no fetching, no I/O, no clock reads except the `now` the caller passes.
 * That is what lets the same function serve a live request and re-derive an
 * advisory from a stored snapshot without any special-casing.
 */

import {
  bestSprayWindowPerDay,
  currentWindCheck,
  findDryingWindows,
  SOURCES,
  todayHeadline,
  type DryingWindow,
  type SprayWindow,
  type WindCheck,
} from "./rules";
import { findCrop, type CropProfile } from "./crops";
import {
  fieldWorkWindow,
  frostWatch,
  heatStress,
  type FrostWatch,
  type HeatWatch,
  type WorkWindow,
} from "./conditions";
import type { AdvisorySnapshotLite } from "./diff";
import type { CurrentPoint, DayPoint, Forecast, Place } from "./types";

interface SourceRef {
  label: string;
  note: string;
  url: string;
}

export interface AdvisoryPayload {
  place: Place;
  placeName: string;
  stationId: string;
  crop: {
    id: string;
    name: string;
    note: string;
    minRunDays: number;
    storageMoisturePct: number;
  };
  headline: string;
  /** Translation key + params for the headline; the client localizes from these. */
  headlineKey: string;
  headlineParams: Record<string, string>;
  current: CurrentPoint;
  days: DayPoint[];
  aiSummary: string | null;
  advisories: {
    drying: {
      best: DryingWindow | null;
      closest: DryingWindow | null;
      alternatives: DryingWindow[];
      minRunDays: number;
      source: SourceRef;
    };
    spray: {
      best: SprayWindow | null;
      byDay: SprayWindow[];
      windCheck: WindCheck;
      sources: SourceRef[];
    };
  };
  /** Additional temperature/rain-only watches beyond the two headline decisions. */
  conditions: {
    frost: FrostWatch | null;
    heat: HeatWatch | null;
    work: WorkWindow | null;
  };
}

/**
 * Build the full advisory payload for a forecast, crop, and location name.
 *
 * `now` is injected rather than read from the clock so that re-deriving an
 * advisory from a stored snapshot is deterministic and testable.
 */
export function buildAdvisory(opts: {
  forecast: Forecast;
  stationId: string;
  placeName: string;
  cropId?: string | null;
  now?: Date;
}): AdvisoryPayload {
  const { forecast, stationId, placeName } = opts;
  const crop: CropProfile = findCrop(opts.cropId);

  const dryingRuns = findDryingWindows(forecast.days, crop);
  const bestDrying = dryingRuns.find((w) => w.sufficient) ?? null;
  const spray = bestSprayWindowPerDay(
    forecast.hours,
    forecast.days,
    opts.now,
    crop,
    forecast.place,
  );
  const bestSpray = spray.find((w) => w.verdict === "good") ?? spray[0] ?? null;

  // "Today" is the forecast's own first day, not the server date — the server
  // runs in UTC and the stations span five time zones.
  const today = forecast.days[0]?.date ?? "";
  const headline = todayHeadline(bestDrying, bestSpray, today);

  return {
    place: forecast.place,
    placeName,
    stationId,
    crop: {
      id: crop.id,
      name: crop.name,
      note: crop.note,
      minRunDays: crop.minRunDays,
      storageMoisturePct: crop.storageMoisturePct,
    },
    headline: headline.text,
    headlineKey: headline.key,
    headlineParams: headline.params,
    current: forecast.current,
    days: forecast.days,
    aiSummary: forecast.aiSummary,
    advisories: {
      drying: {
        best: bestDrying,
        closest: bestDrying ? null : (dryingRuns[0] ?? null),
        alternatives: dryingRuns
          .filter((w) => w.sufficient && w !== bestDrying)
          .slice(0, 2),
        minRunDays: crop.minRunDays,
        source: SOURCES.aflatoxin,
      },
      spray: {
        best: bestSpray,
        byDay: spray,
        windCheck: currentWindCheck(forecast.current.windKph),
        sources: [SOURCES.rainfast, SOURCES.sprayDrift],
      },
    },
    conditions: {
      frost: frostWatch(forecast.days, crop),
      heat: heatStress(forecast.days, crop),
      work: fieldWorkWindow(forecast.days),
    },
  };
}

/**
 * Reduce a full payload to the minimal shape the diff engine compares.
 *
 * Kept deliberately small: the diff cares only about the headline windows and
 * their verdicts, not the evidence rows, so comparing full payloads would make
 * trivial numeric jitter look like a change.
 */
export function toSnapshotLite(payload: AdvisoryPayload): AdvisorySnapshotLite {
  const d = payload.advisories.drying.best;
  const s = payload.advisories.spray.best;
  return {
    drying: d
      ? {
          startDate: d.startDate,
          endDate: d.endDate,
          days: d.days,
          verdict: d.verdict,
          sufficient: d.sufficient,
        }
      : null,
    spray: s
      ? { time: s.time, verdict: s.verdict, rainNext24hMm: s.rainNext24hMm }
      : null,
  };
}
