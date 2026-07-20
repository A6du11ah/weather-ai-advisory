/**
 * Advisory endpoint.
 *
 * Proxies WeatherAI so the API key stays server-side, caches responses to
 * protect a 1,000-request monthly quota, runs the rules engine, and returns
 * advisories together with the evidence behind them.
 */

import type { NextRequest } from "next/server";
import { fetchForecast, fetchUsage, WeatherAIError } from "@/lib/weatherai";
import {
  bestSprayWindowPerDay,
  currentWindCheck,
  findDryingWindows,
  SOURCES,
  THRESHOLDS,
  todayHeadline,
} from "@/lib/rules";
import * as cache from "@/lib/cache";
import { matchPreset, PRESETS } from "@/lib/places";
import { findCrop } from "@/lib/crops";
import type { Forecast, Usage } from "@/lib/types";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lon = Number(sp.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json(
      { error: "lat and lon are required and must be numbers." },
      { status: 400 },
    );
  }

  // Only allowlisted locations are fetchable. Coordinate rounding alone does
  // not bound quota — a caller sweeping latitudes mints a new cache key every
  // 0.1°, turning a public URL into a way to drain the monthly allowance.
  const place = matchPreset(lat, lon);
  if (!place) {
    return Response.json(
      {
        error:
          "Unknown location. This deployment serves a fixed set of demo locations to stay within a 1,000 request/month API quota.",
        available: PRESETS.map((p) => ({
          id: p.id,
          name: p.name,
          lat: p.lat,
          lon: p.lon,
        })),
      },
      { status: 400 },
    );
  }

  const withAi = process.env.ENABLE_AI_SUMMARY !== "false";
  const key = cache.cacheKey(["forecast", place.id]);

  const cached = cache.getFresh<Forecast>(key);
  let forecast: Forecast;
  let staleAgeSeconds: number | null = null;

  if (cached) {
    forecast = cached;
  } else {
    try {
      forecast = await fetchForecast({
        lat: place.lat,
        lon: place.lon,
        days: 7,
        withAi,
      });
      cache.set(key, forecast, cache.TTL.forecast);
    } catch (err) {
      // Quota exhaustion and upstream outages are expected on a free plan.
      // Serving slightly-old data beats showing a reviewer an error page —
      // but only while it is still recent enough to be about the future.
      const stale = cache.getStale<Forecast>(key);
      if (stale) {
        forecast = stale.value;
        staleAgeSeconds = stale.ageSeconds;
      } else {
        const e = err as WeatherAIError;
        return Response.json(
          {
            error: e.message ?? "Unexpected error",
            retryable: e.retryable ?? false,
          },
          { status: e.status ?? 500 },
        );
      }
    }
  }

  // Usage is a separate, cheap call and must never break the page.
  let usage: Usage | null = cache.getFresh<Usage>("usage");
  if (!usage) {
    try {
      usage = await fetchUsage();
      cache.set("usage", usage, cache.TTL.usage);
    } catch {
      usage = cache.getStale<Usage>("usage")?.value ?? null;
    }
  }

  // Crop only re-scores the same payload — it never triggers another fetch,
  // which is what makes it affordable personalisation on the free tier.
  const crop = findCrop(sp.get("crop"));

  const dryingRuns = findDryingWindows(forecast.days, crop);
  const bestDrying = dryingRuns.find((w) => w.sufficient) ?? null;
  const spray = bestSprayWindowPerDay(
    forecast.hours,
    forecast.days,
    undefined,
    crop,
  );
  const bestSpray = spray.find((w) => w.verdict === "good") ?? spray[0] ?? null;

  // "Today" per the forecast's own first day, not the server clock — the
  // server runs in UTC and the locations span five time zones.
  const today = forecast.days[0]?.date ?? "";

  return Response.json(
    {
      place: forecast.place,
      placeName: place.name,
      crop: {
        id: crop.id,
        name: crop.name,
        note: crop.note,
        minRunDays: crop.minRunDays,
        storageMoisturePct: crop.storageMoisturePct,
      },
      headline: todayHeadline(bestDrying, bestSpray, today),
      current: forecast.current,
      days: forecast.days,
      aiSummary: forecast.aiSummary,
      advisories: {
        drying: {
          best: bestDrying,
          /** Longest dry spell found when none is long enough to be usable. */
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
      meta: {
        fetchedAt: forecast.fetchedAt,
        stale: staleAgeSeconds !== null,
        staleHours:
          staleAgeSeconds === null
            ? null
            : Math.round((staleAgeSeconds / 3600) * 10) / 10,
        cached: Boolean(cached),
        usage,
      },
    },
    {
      headers: {
        // Longer than before, and matched to the 6h upstream TTL so the edge
        // does not force origin work the origin would only serve from cache.
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=21600",
      },
    },
  );
}
