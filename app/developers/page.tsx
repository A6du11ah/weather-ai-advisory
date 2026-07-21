import type { Metadata } from "next";
import { SiteHeader } from "@/app/_components/site-header";
import { SiteFooter } from "@/app/_components/site-footer";
import { PageIntro } from "@/app/_components/page-intro";
import { PRESETS } from "@/lib/places";
import { CROPS } from "@/lib/crops";

export const metadata: Metadata = {
  title: "Developers — Seasonwise API",
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
        <PageIntro titleKey="dev.title" introKey="dev.intro" />

        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold text-foreground">Endpoint</h2>
          <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-muted p-4 font-mono text-sm text-foreground">
            {example}
          </pre>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold text-foreground">Parameters</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-4 font-semibold">Name</th>
                  <th className="py-2 pr-4 font-semibold">In</th>
                  <th className="py-2 pr-4 font-semibold">Required</th>
                  <th className="py-2 font-semibold">Values</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                <tr className="border-b border-border/60">
                  <td className="py-2 pr-4">station</td>
                  <td className="py-2 pr-4 text-muted">path</td>
                  <td className="py-2 pr-4 text-poor">yes</td>
                  <td className="py-2 text-ink-body">{PRESETS.map((p) => p.id).join(", ")}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">crop</td>
                  <td className="py-2 pr-4 text-muted">query</td>
                  <td className="py-2 pr-4 text-muted">no</td>
                  <td className="py-2 text-ink-body">{CROPS.map((c) => c.id).join(", ")} (default maize)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold text-foreground">Example response</h2>
          <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-muted p-4 font-mono text-xs leading-relaxed text-foreground">
            {sample}
          </pre>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold text-foreground">Response fields</h2>
          <dl className="mt-3 divide-y divide-border/60 text-sm">
            {[
              ["apiVersion", "string", "Contract version, currently 1.0."],
              ["station", "object", "id, name, country, lat, lon."],
              ["crop", "object", "id and display name of the crop scored."],
              ["headline", "string", "The single what-to-do-today sentence."],
              ["drying", "object", "verdict (good/marginal/poor), startDate, endDate, days, score."],
              ["spray", "object", "verdict, time, score, rainNext24hMm, effectiveWashMm."],
              ["changes", "array", "Day-over-day changes: {kind, summary}, empty if none."],
            ].map(([field, type, desc]) => (
              <div key={field} className="grid grid-cols-[8rem_5rem_1fr] gap-3 py-2.5">
                <dt className="font-mono text-foreground">{field}</dt>
                <dd className="font-mono text-muted">{type}</dd>
                <dd className="text-ink-body">{desc}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold text-foreground">Machine-readable spec</h2>
          <p className="mt-2 text-ink-body">
            This page is the quick reference. For a full, browsable reference —
            every schema, field, and example, rendered from the live OpenAPI 3
            contract — open the interactive API reference. The raw JSON is there
            too, for code generation and tooling.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a
              href="/developers/reference"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] items-center rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand hover:opacity-90"
            >
              Interactive API reference ↗
            </a>
            <a
              href="/api/v1/openapi.json"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] items-center rounded-xl border border-border bg-surface px-4 text-sm font-medium text-muted hover:bg-surface-muted"
            >
              Download openapi.json
            </a>
          </div>
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
