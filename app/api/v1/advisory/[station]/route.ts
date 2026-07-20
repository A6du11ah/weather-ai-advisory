/**
 * Versioned public advisory contract.
 *
 * The README argues this product's real shape is a component a WeatherAI B2B
 * customer embeds, not a consumer app. That argument is empty unless a third
 * party can actually call it, so this is the stable, documented surface: a
 * versioned path, a fixed response schema (see /api/v1/openapi.json), and CORS
 * enabled so a browser client on another origin can consume it.
 *
 * It intentionally exposes only what an integrator needs — the verdicts, the
 * windows, the evidence, the day-over-day change — and omits the internal meta
 * (cache origin, quota ledger) that the first-party UI uses.
 */

import type { NextRequest } from "next/server";
import { findPreset, PRESETS } from "@/lib/places";
import { findCrop } from "@/lib/crops";
import { buildAdvisory, toSnapshotLite } from "@/lib/advisory";
import {
  resolveForecast,
  resolvePreviousForecast,
} from "@/lib/forecast-source";
import { diffAdvisories } from "@/lib/diff";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ station: string }> },
) {
  const { station } = await ctx.params;
  const preset = findPreset(station);
  if (!preset) {
    return Response.json(
      {
        error: "unknown_station",
        message: `No station "${station}".`,
        stations: PRESETS.map((p) => p.id),
      },
      { status: 404, headers: CORS },
    );
  }

  const crop = findCrop(request.nextUrl.searchParams.get("crop"));
  const withAi = process.env.ENABLE_AI_SUMMARY !== "false";

  let resolved;
  try {
    resolved = await resolveForecast(preset, { withAi });
  } catch {
    return Response.json(
      { error: "upstream_unavailable", message: "No forecast available for this station." },
      { status: 503, headers: CORS },
    );
  }

  const payload = buildAdvisory({
    forecast: resolved.forecast,
    stationId: preset.id,
    placeName: preset.name,
    cropId: crop.id,
  });

  const prev = await resolvePreviousForecast(preset.id, resolved.localDate);
  const changes = prev
    ? diffAdvisories(
        toSnapshotLite(
          buildAdvisory({
            forecast: prev,
            stationId: preset.id,
            placeName: preset.name,
            cropId: crop.id,
          }),
        ),
        toSnapshotLite(payload),
        resolved.localDate,
      )
    : [];

  const drying = payload.advisories.drying.best;
  const spray = payload.advisories.spray.best;

  // A deliberately flat, stable shape. Internal window objects carry fields an
  // integrator does not need; this projects only the contract surface.
  const body = {
    apiVersion: "1.0",
    station: { id: preset.id, name: preset.name, country: preset.country, lat: preset.lat, lon: preset.lon },
    crop: { id: payload.crop.id, name: payload.crop.name },
    generatedAt: new Date().toISOString(),
    forecastAt: resolved.forecast.fetchedAt,
    headline: payload.headline,
    drying: drying
      ? {
          verdict: drying.verdict,
          startDate: drying.startDate,
          endDate: drying.endDate,
          days: drying.days,
          score: drying.score,
        }
      : { verdict: "poor", startDate: null, endDate: null, days: 0, score: 0 },
    spray: spray
      ? {
          verdict: spray.verdict,
          time: spray.time,
          score: spray.score,
          rainNext24hMm: Number(spray.rainNext24hMm.toFixed(1)),
          effectiveWashMm: Number(spray.effectiveWashMm.toFixed(1)),
        }
      : { verdict: "poor", time: null, score: 0, rainNext24hMm: null, effectiveWashMm: null },
    changes: changes.map((c) => ({ kind: c.kind, summary: c.summary })),
  };

  return Response.json(body, {
    status: 200,
    headers: {
      ...CORS,
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=21600",
    },
  });
}
