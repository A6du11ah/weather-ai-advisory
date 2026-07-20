import type { Metadata } from "next";
import { SiteHeader } from "@/app/_components/site-header";
import { SiteFooter } from "@/app/_components/site-footer";
import { PRESETS } from "@/lib/places";

export const metadata: Metadata = {
  title: "Developers — Field Window API",
  description:
    "A versioned, CORS-enabled advisory API. Fetch drying and spray verdicts for a station as JSON, described by OpenAPI.",
};

export default function Developers() {
  const example = `GET /api/v1/advisory/${PRESETS[0].id}?crop=maize`;
  const sample = `{
  "apiVersion": "1.0",
  "station": { "id": "${PRESETS[0].id}", "name": "${PRESETS[0].name}", "country": "${PRESETS[0].country}" },
  "crop": { "id": "maize", "name": "Maize" },
  "headline": "Nothing to do today. The next drying window opens 2026-07-25.",
  "drying": { "verdict": "poor", "startDate": null, "days": 0, "score": 0 },
  "spray":  { "verdict": "good", "time": "2026-07-21T09:00", "score": 88 },
  "changes": []
}`;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-14">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Build on the advisory
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-body">
          The same engine that powers the app is exposed as a versioned,
          CORS-enabled JSON API — a reference for the co-ops, lenders, and input
          suppliers who would embed this advice in their own product.
        </p>

        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold text-foreground">Endpoint</h2>
          <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-muted p-4 font-mono text-sm text-foreground">
            {example}
          </pre>
          <p className="mt-2 text-sm text-ink-body">
            Stations: {PRESETS.map((p) => p.id).join(", ")}. Optional{" "}
            <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-xs">crop</code>{" "}
            query parameter re-scores the same forecast.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold text-foreground">Response</h2>
          <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-muted p-4 font-mono text-xs leading-relaxed text-foreground">
            {sample}
          </pre>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold text-foreground">Spec</h2>
          <p className="mt-2 text-ink-body">
            The full contract is described by OpenAPI 3:
          </p>
          <a
            href="/api/v1/openapi.json"
            className="mt-3 inline-flex min-h-[48px] items-center rounded-xl bg-brand px-6 text-sm font-semibold text-on-brand hover:opacity-90"
          >
            Open the OpenAPI spec →
          </a>
        </section>

        <p className="mt-10 text-sm text-muted">
          Reads are served from cached snapshots, so calling the API costs no
          upstream weather quota. Rate limits and authentication would be added
          before a production launch.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
