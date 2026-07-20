/**
 * Scheduled forecast refresh.
 *
 * This is the only code path that spends API quota. It fetches each station's
 * forecast, stores a snapshot, and returns. Page loads then read from Postgres
 * and cost nothing upstream — the inversion that lets the site serve traffic
 * without the request path touching the quota.
 *
 * Driven by GitHub Actions rather than Vercel Cron, because Vercel's Hobby
 * plan caps cron at one run per day and this wants a few. The endpoint is
 * guarded by a shared secret so only the scheduler can trigger a spend.
 */

import type { NextRequest } from "next/server";
import { PRESETS } from "@/lib/places";
import { fetchForecast } from "@/lib/weatherai";
import { getDb } from "@/lib/db/client";
import { reserveQuota, saveSnapshot } from "@/lib/db/snapshots";

// Each run fetches one forecast per station. Keep the ceiling below the real
// 1,000 so /v1/usage checks and manual testing retain headroom, and so a
// runaway schedule cannot consume the entire month.
const MONTHLY_CEILING = 900;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET is not configured on this deployment." },
      { status: 503 },
    );
  }

  // Accept the secret as a bearer token (GitHub Actions) or ?key= (manual).
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const provided = bearer ?? request.nextUrl.searchParams.get("key");
  if (provided !== secret) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!getDb()) {
    return Response.json(
      { error: "DATABASE_URL is not configured; nothing to refresh into." },
      { status: 503 },
    );
  }

  const withAi = process.env.ENABLE_AI_SUMMARY !== "false";

  // Reserve the whole batch up front. If it will not fit under the ceiling,
  // refuse before spending a single call rather than fetching partway and
  // stopping mid-run.
  const allowed = await reserveQuota(PRESETS.length, MONTHLY_CEILING);
  if (!allowed) {
    return Response.json(
      {
        refreshed: 0,
        skipped: "monthly quota ceiling reached; refresh deferred",
      },
      { status: 200 },
    );
  }

  const results: { station: string; ok: boolean; error?: string }[] = [];

  for (const station of PRESETS) {
    try {
      const forecast = await fetchForecast({
        lat: station.lat,
        lon: station.lon,
        days: 7,
        withAi,
      });
      await saveSnapshot(station.id, forecast);
      results.push({ station: station.id, ok: true });
    } catch (err) {
      // One station failing must not abort the others. It keeps its previous
      // snapshot and the next run retries.
      results.push({
        station: station.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const refreshed = results.filter((r) => r.ok).length;
  return Response.json(
    { refreshed, total: PRESETS.length, results, at: new Date().toISOString() },
    { status: 200 },
  );
}
