/**
 * Forecast acquisition strategy.
 *
 * Resolves a station's forecast from the best available source and reports
 * where it came from, so the UI can be honest about freshness. Priority:
 *
 *   1. A stored snapshot from the database, if one is configured and present.
 *      Costs no API quota — this is the whole point of the cron inversion.
 *   2. The in-memory cache, for deployments with no database.
 *   3. A live upstream fetch, cached on the way out.
 *   4. A bounded-stale in-memory copy, if the fetch fails.
 *
 * With a database configured and the cron job running, the request path never
 * reaches step 3, so public traffic cannot exhaust the quota.
 */

import { fetchForecast, WeatherAIError } from "./weatherai";
import * as cache from "./cache";
import { getLatestSnapshot, getPreviousSnapshot } from "./db/snapshots";
import { isDbConfigured } from "./db/client";
import type { Preset } from "./places";
import type { Forecast } from "./types";

export type ForecastOrigin = "snapshot" | "cache" | "live" | "stale";

export interface ResolvedForecast {
  forecast: Forecast;
  origin: ForecastOrigin;
  /** Age of the forecast in hours, when it is not freshly live. */
  ageHours: number | null;
  /** The forecast's own first day, used to find the prior snapshot for diffing. */
  localDate: string;
}

function hoursSince(iso: string): number {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 3_600_000);
}

/**
 * Resolve the current forecast for a station, preferring stored data.
 */
export async function resolveForecast(
  station: Preset,
  opts: { withAi: boolean },
): Promise<ResolvedForecast> {
  if (isDbConfigured()) {
    const row = await getLatestSnapshot(station.id);
    if (row) {
      return {
        forecast: row.forecast,
        origin: "snapshot",
        ageHours: Math.round(hoursSince(row.fetchedAt.toISOString()) * 10) / 10,
        localDate: row.localDate,
      };
    }
    // No snapshot yet (first deploy, cron not yet run): fall through to a live
    // fetch so the page is never empty while the store warms up.
  }

  const key = cache.cacheKey(["forecast", station.id]);
  const cached = cache.getFresh<Forecast>(key);
  if (cached) {
    return {
      forecast: cached,
      origin: "cache",
      ageHours: null,
      localDate: cached.days[0]?.date ?? "",
    };
  }

  try {
    const forecast = await fetchForecast({
      lat: station.lat,
      lon: station.lon,
      days: 7,
      withAi: opts.withAi,
    });
    cache.set(key, forecast, cache.TTL.forecast);
    return {
      forecast,
      origin: "live",
      ageHours: null,
      localDate: forecast.days[0]?.date ?? "",
    };
  } catch (err) {
    const stale = cache.getStale<Forecast>(key);
    if (stale) {
      return {
        forecast: stale.value,
        origin: "stale",
        ageHours: Math.round((stale.ageSeconds / 3600) * 10) / 10,
        localDate: stale.value.days[0]?.date ?? "",
      };
    }
    throw err instanceof WeatherAIError
      ? err
      : new WeatherAIError(String(err), 500, false);
  }
}

/**
 * The snapshot from a day before `localDate`, for day-over-day diffing.
 * Returns null when no database is configured or no earlier snapshot exists.
 */
export async function resolvePreviousForecast(
  stationId: string,
  localDate: string,
): Promise<Forecast | null> {
  if (!isDbConfigured()) return null;
  const row = await getPreviousSnapshot(stationId, localDate);
  return row?.forecast ?? null;
}

/**
 * Resolve a forecast for an arbitrary field location.
 *
 * Unlike the preset stations, user fields are not gated by `matchPreset` and
 * are not pre-fetched by cron — they are cached by rounded coordinate and
 * fetched live on a miss. Access is bounded elsewhere (a farm holds at most a
 * handful of fields), which is the scalability trade this feature accepts.
 */
export async function resolveForecastByCoords(
  lat: number,
  lon: number,
  opts: { withAi: boolean },
): Promise<ResolvedForecast> {
  const key = cache.cacheKey([
    "field",
    cache.roundCoord(lat),
    cache.roundCoord(lon),
  ]);

  const cached = cache.getFresh<Forecast>(key);
  if (cached) {
    return {
      forecast: cached,
      origin: "cache",
      ageHours: null,
      localDate: cached.days[0]?.date ?? "",
    };
  }

  try {
    const forecast = await fetchForecast({ lat, lon, days: 7, withAi: opts.withAi });
    cache.set(key, forecast, cache.TTL.forecast);
    return {
      forecast,
      origin: "live",
      ageHours: null,
      localDate: forecast.days[0]?.date ?? "",
    };
  } catch (err) {
    const stale = cache.getStale<Forecast>(key);
    if (stale) {
      return {
        forecast: stale.value,
        origin: "stale",
        ageHours: Math.round((stale.ageSeconds / 3600) * 10) / 10,
        localDate: stale.value.days[0]?.date ?? "",
      };
    }
    throw err instanceof WeatherAIError
      ? err
      : new WeatherAIError(String(err), 500, false);
  }
}
