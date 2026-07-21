/**
 * Server-rendered station page.
 *
 * A real, indexable, forwardable URL per location — /s/bomet, /s/ames — rather
 * than a single client-fetched page. The research on how these advisories
 * actually spread (screenshots forwarded into WhatsApp groups) makes the
 * shareable-link surface the realistic distribution channel, so each one gets
 * its own page and its own Open Graph card carrying the verdict.
 *
 * Rendered on the server from the snapshot store, so it costs no API quota and
 * the verdict is present in the initial HTML for crawlers and link unfurlers.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findPreset, PRESETS } from "@/lib/places";
import { CROPS, findCrop } from "@/lib/crops";
import { buildAdvisory, toSnapshotLite } from "@/lib/advisory";
import {
  resolveForecast,
  resolvePreviousForecast,
} from "@/lib/forecast-source";
import { diffAdvisories } from "@/lib/diff";
import StationView from "./station-view";

// Pre-render all known stations; unknown slugs 404.
export function generateStaticParams() {
  return PRESETS.map((p) => ({ station: p.id }));
}

// Snapshots refresh a few times a day; revalidate the page on that cadence.
export const revalidate = 3600;

type Params = Promise<{ station: string }>;
type Search = Promise<{ crop?: string }>;

export async function generateMetadata(props: {
  params: Params;
  searchParams: Search;
}): Promise<Metadata> {
  const { station } = await props.params;
  const preset = findPreset(station);
  if (!preset) return { title: "Unknown location — Seasonwise" };

  const title = `${preset.name} — Seasonwise`;
  const description = `Grain drying and spray advisories for ${preset.name}, ${preset.country}.`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function StationPage(props: {
  params: Params;
  searchParams: Search;
}) {
  const { station } = await props.params;
  const { crop: cropParam } = await props.searchParams;
  const preset = findPreset(station);
  if (!preset) notFound();

  const withAi = process.env.ENABLE_AI_SUMMARY !== "false";
  const crop = findCrop(cropParam);

  let resolved;
  try {
    resolved = await resolveForecast(preset, { withAi });
  } catch {
    // If even a live fetch fails and no snapshot exists, show the shell with an
    // error rather than a 500 — the client view can retry.
    return (
      <StationView
        station={{ id: preset.id, name: preset.name, country: preset.country }}
        crops={CROPS.map((c) => ({ id: c.id, name: c.name }))}
        activeCropId={crop.id}
        payload={null}
        changes={[]}
        meta={null}
      />
    );
  }

  const payload = buildAdvisory({
    forecast: resolved.forecast,
    stationId: preset.id,
    placeName: preset.name,
    cropId: crop.id,
  });

  const previousForecast = await resolvePreviousForecast(
    preset.id,
    resolved.localDate,
  );
  const changes = previousForecast
    ? diffAdvisories(
        toSnapshotLite(
          buildAdvisory({
            forecast: previousForecast,
            stationId: preset.id,
            placeName: preset.name,
            cropId: crop.id,
          }),
        ),
        toSnapshotLite(payload),
        resolved.localDate,
      )
    : [];

  return (
    <StationView
      station={{ id: preset.id, name: preset.name, country: preset.country }}
      crops={CROPS.map((c) => ({ id: c.id, name: c.name }))}
      activeCropId={crop.id}
      payload={payload}
      changes={changes}
      meta={{ origin: resolved.origin, ageHours: resolved.ageHours }}
    />
  );
}
