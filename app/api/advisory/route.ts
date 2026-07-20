/**
 * Advisory endpoint.
 *
 * Resolves a forecast (from the snapshot store when available, otherwise live),
 * assembles the advisory via the shared builder, and — when a prior day's
 * snapshot exists — reports what changed since yesterday. The API key never
 * leaves the server.
 */

import type { NextRequest } from "next/server";
import { fetchUsage } from "@/lib/weatherai";
import * as cache from "@/lib/cache";
import { matchPreset, PRESETS } from "@/lib/places";
import { buildAdvisory, toSnapshotLite } from "@/lib/advisory";
import {
  resolveForecast,
  resolvePreviousForecast,
} from "@/lib/forecast-source";
import { diffAdvisories } from "@/lib/diff";
import { getMonthlyUsage } from "@/lib/db/snapshots";
import type { Usage } from "@/lib/types";
import type { WeatherAIError } from "@/lib/weatherai";

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
  const cropId = sp.get("crop");

  let resolved;
  try {
    resolved = await resolveForecast(place, { withAi });
  } catch (err) {
    const e = err as WeatherAIError;
    return Response.json(
      { error: e.message ?? "Unexpected error", retryable: e.retryable ?? false },
      { status: e.status ?? 500 },
    );
  }

  const payload = buildAdvisory({
    forecast: resolved.forecast,
    stationId: place.id,
    placeName: place.name,
    cropId,
  });

  // Day-over-day change, when a prior snapshot exists. Same crop on both sides
  // so a change reflects the weather moving, not the user switching crops.
  const previousForecast = await resolvePreviousForecast(
    place.id,
    resolved.localDate,
  );
  const changes = previousForecast
    ? diffAdvisories(
        toSnapshotLite(
          buildAdvisory({
            forecast: previousForecast,
            stationId: place.id,
            placeName: place.name,
            cropId,
          }),
        ),
        toSnapshotLite(payload),
        resolved.localDate,
      )
    : [];

  const usage = await resolveUsage();

  return Response.json(
    {
      ...payload,
      changes,
      meta: {
        fetchedAt: resolved.forecast.fetchedAt,
        origin: resolved.origin,
        stale: resolved.origin === "stale",
        ageHours: resolved.ageHours,
        usage,
      },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=21600",
      },
    },
  );
}

/**
 * Usage for the footer. Prefers the local ledger (free) over an upstream call,
 * and must never break the page.
 */
async function resolveUsage(): Promise<Usage | null> {
  const ledgerUsed = await getMonthlyUsage();
  if (ledgerUsed !== null) {
    return {
      plan: "free",
      used: ledgerUsed,
      limit: 1000,
      remaining: Math.max(0, 1000 - ledgerUsed),
      unlimited: false,
    };
  }

  const cachedUsage = cache.getFresh<Usage>("usage");
  if (cachedUsage) return cachedUsage;
  try {
    const usage = await fetchUsage();
    cache.set("usage", usage, cache.TTL.usage);
    return usage;
  } catch {
    return cache.getStale<Usage>("usage")?.value ?? null;
  }
}
