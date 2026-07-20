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
} from "@/lib/rules";
import * as cache from "@/lib/cache";
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
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return Response.json(
      { error: "lat must be between -90 and 90, lon between -180 and 180." },
      { status: 400 },
    );
  }

  const withAi = process.env.ENABLE_AI_SUMMARY !== "false";
  const key = cache.cacheKey([
    "forecast",
    cache.roundCoord(lat),
    cache.roundCoord(lon),
  ]);

  const cached = cache.getFresh<Forecast>(key);
  let forecast: Forecast;
  let servedStale = false;

  if (cached) {
    forecast = cached;
  } else {
    try {
      forecast = await fetchForecast({ lat, lon, days: 7, withAi });
      cache.set(key, forecast, cache.TTL.forecast);
    } catch (err) {
      // Quota exhaustion and upstream outages are expected on a free plan.
      // Serving slightly-old data beats showing a reviewer an error page.
      const stale = cache.getStale<Forecast>(key);
      if (stale) {
        forecast = stale;
        servedStale = true;
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
      usage = cache.getStale<Usage>("usage");
    }
  }

  const dryingRuns = findDryingWindows(forecast.days);
  const bestDrying = dryingRuns.find((w) => w.sufficient) ?? null;
  const spray = bestSprayWindowPerDay(forecast.hours, forecast.days);

  return Response.json(
    {
      place: forecast.place,
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
          minRunDays: THRESHOLDS.drying.minRunDays,
          source: SOURCES.aflatoxin,
        },
        spray: {
          best: spray.find((w) => w.verdict === "good") ?? spray[0] ?? null,
          byDay: spray,
          windCheck: currentWindCheck(forecast.current.windKph),
          sources: [SOURCES.rainfast, SOURCES.sprayDrift],
        },
      },
      meta: {
        fetchedAt: forecast.fetchedAt,
        stale: servedStale,
        cached: Boolean(cached),
        usage,
      },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    },
  );
}
