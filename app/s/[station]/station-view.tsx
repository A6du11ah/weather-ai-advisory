"use client";

import Link from "next/link";
import { PRESETS } from "@/lib/places";
import { CROPS } from "@/lib/crops";
import type { AdvisoryPayload } from "@/lib/advisory";
import type { AdvisoryChange } from "@/lib/diff";
import type { ForecastOrigin } from "@/lib/forecast-source";
import { AdvisoryBody } from "@/app/_components/advisory-body";
import { ChipRow } from "@/app/_components/controls";

/**
 * Station page shell.
 *
 * The payload is rendered on the server for a fast, crawlable first paint. This
 * client wrapper adds navigation: switching crop or location is a link to
 * another server-rendered URL, so every state has its own shareable address and
 * nothing re-fetches on the client. Crop switching costs no API call because
 * the server re-scores an already-stored snapshot.
 */
export default function StationView({
  station,
  activeCropId,
  payload,
  changes,
  meta,
}: {
  station: { id: string; name: string; country: string };
  crops: { id: string; name: string }[];
  activeCropId: string;
  payload: AdvisoryPayload | null;
  changes: AdvisoryChange[];
  meta: { origin: ForecastOrigin; ageHours: number | null } | null;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <header>
        <Link
          href="/"
          className="text-sm text-muted underline-offset-2 hover:underline"
        >
          ← All locations
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          {station.name}
          <span className="ml-2 text-lg font-normal text-muted">
            {station.country}
          </span>
        </h1>
      </header>

      <div className="mt-6 space-y-4">
        <ChipRow
          legend="Location"
          items={PRESETS.map((p) => ({ id: p.id, label: p.name, sublabel: p.country }))}
          activeId={station.id}
          hrefFor={(id) => `/s/${id}?crop=${activeCropId}`}
        />
        <ChipRow
          legend="Crop"
          items={CROPS.map((c) => ({ id: c.id, label: c.name }))}
          activeId={activeCropId}
          hrefFor={(id) => `/s/${station.id}?crop=${id}`}
        />
      </div>

      <div className="mt-6">
        {payload ? (
          <AdvisoryBody
            payload={payload}
            changes={changes}
            meta={<MetaFooter meta={meta} />}
          />
        ) : (
          <div
            role="alert"
            className="rounded-xl border border-border bg-poor-bg p-5 text-poor"
          >
            <p className="font-medium">Advisory unavailable</p>
            <p className="mt-1 text-sm opacity-90">
              No forecast is stored for this location yet, and the upstream
              service could not be reached. Try again shortly.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function MetaFooter({
  meta,
}: {
  meta: { origin: ForecastOrigin; ageHours: number | null } | null;
}) {
  if (!meta) return null;
  const originLabel: Record<ForecastOrigin, string> = {
    snapshot: "from stored snapshot",
    cache: "cached",
    live: "fetched live",
    stale: "upstream unavailable — last known forecast",
  };
  return (
    <footer className="rounded-xl border border-border bg-surface px-5 py-4 text-xs text-muted">
      <p>
        {originLabel[meta.origin]}
        {meta.ageHours !== null && ` · ${meta.ageHours}h old`}
      </p>
      <p className="mt-2 leading-relaxed">
        Advisory only. Thresholds are general extension guidance shown above so
        they can be checked against local practice and product labels, which
        take precedence.
      </p>
    </footer>
  );
}
