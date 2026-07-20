/**
 * Shared advisory presentation.
 *
 * Both the client home view (which fetches) and the server station pages
 * (which render from the snapshot store) use these components, so the two
 * surfaces cannot diverge visually or in their treatment of a verdict.
 *
 * Verdict is never carried by colour alone — each state also has a word and a
 * distinct glyph, so it survives greyscale, sunlight on a cheap screen, and
 * colour-vision deficiency.
 */

import type { DayPoint } from "@/lib/types";
import type { Evidence, Verdict } from "@/lib/rules";
import type { AdvisoryChange } from "@/lib/diff";
import { describeCode } from "@/lib/weathercode";

export interface SourceRef {
  label: string;
  note: string;
  url: string;
}

export const VERDICT: Record<
  Verdict,
  { label: string; glyph: string; chip: string; bar: string }
> = {
  good: { label: "Go", glyph: "✓", chip: "bg-good-bg text-good border-good/30", bar: "bg-good" },
  marginal: { label: "Marginal", glyph: "!", chip: "bg-marginal-bg text-marginal border-marginal/30", bar: "bg-marginal" },
  poor: { label: "Avoid", glyph: "✕", chip: "bg-poor-bg text-poor border-poor/30", bar: "bg-poor" },
};

export function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function fmtDayTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    hour: "numeric",
  });
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const v = VERDICT[verdict];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${v.chip}`}
    >
      <span aria-hidden="true">{v.glyph}</span>
      {v.label}
    </span>
  );
}

export function EvidenceList({ items }: { items: Evidence[] }) {
  if (items.length === 0) return null;
  return (
    <dl className="mt-5 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
      {items.map((e) => (
        <div
          key={e.label}
          className="flex items-baseline justify-between gap-3 border-b border-border pb-2"
        >
          <dt className="text-sm text-muted">{e.label}</dt>
          <dd className="flex items-center gap-2 font-mono text-sm tabular-nums">
            {e.value}
            <span className={e.ok ? "text-good" : "text-poor"}>
              <span aria-hidden="true">{e.ok ? "✓" : "✕"}</span>
              <span className="sr-only">
                {e.ok ? "meets threshold" : "outside threshold"}
              </span>
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SourceNote({ sources }: { sources: SourceRef[] }) {
  if (sources.length === 0) return null;
  return (
    <details className="group mt-5 text-sm">
      <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
        Why these thresholds?
      </summary>
      <div className="space-y-3 pb-1">
        {sources.map((s) => (
          <p key={s.url} className="leading-relaxed text-muted">
            {s.note}{" "}
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              {s.label}
            </a>
          </p>
        ))}
      </div>
    </details>
  );
}

export function AdvisoryCard({
  title,
  question,
  headline,
  verdict,
  evidence,
  sources,
  children,
}: {
  title: string;
  question: string;
  headline: string;
  verdict: Verdict;
  evidence: Evidence[];
  sources: SourceRef[];
  children?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className={`h-1 w-full ${VERDICT[verdict].bar}`} aria-hidden="true" />
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="mt-0.5 text-sm text-muted">{question}</p>
          </div>
          <VerdictBadge verdict={verdict} />
        </div>
        <p className="mt-4 text-xl font-semibold leading-snug text-balance sm:text-2xl">
          {headline}
        </p>
        <EvidenceList items={evidence} />
        {children}
        <SourceNote sources={sources} />
      </div>
    </section>
  );
}

/**
 * Day-over-day changes. Rendered above the cards when a prior snapshot exists,
 * because a retraction ("the Thursday window is gone") is more urgent than the
 * standing advisory it modifies.
 */
export function ChangesBanner({ changes }: { changes: AdvisoryChange[] }) {
  if (changes.length === 0) return null;
  const urgent = changes.some((c) => c.kind === "retracted" || c.kind === "degraded");
  return (
    <section
      aria-live="polite"
      className={`rounded-xl border p-4 sm:p-5 ${
        urgent ? "border-marginal/40 bg-marginal-bg" : "border-border bg-surface"
      }`}
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Since yesterday
      </h2>
      <ul className="mt-2 space-y-2">
        {changes.map((c, i) => (
          <li key={i} className="text-sm">
            <span className="font-medium">{c.summary}</span>
            {c.detail && <span className="text-muted"> {c.detail}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ForecastStrip({ days }: { days: DayPoint[] }) {
  const maxRain = Math.max(1, ...days.map((d) => d.precipMm));
  return (
    <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="text-base font-semibold">7-day outlook</h2>
      <div className="mt-4 -mx-1 overflow-x-auto px-1 pb-1">
        <ul className="flex min-w-max gap-2">
          {days.map((d) => (
            <li
              key={d.date}
              className="flex w-28 flex-col items-center gap-2 rounded-lg bg-surface-muted p-3"
            >
              <span className="text-xs font-medium text-muted">{fmtDate(d.date)}</span>
              <span className="font-mono text-sm tabular-nums">
                {d.tempMaxC.toFixed(0)}° / {d.tempMinC.toFixed(0)}°
              </span>
              <div className="flex h-14 w-full items-end justify-center">
                <div
                  className={`w-4 rounded-t ${d.precipMm > 0 ? "bg-poor" : "bg-good"}`}
                  style={{
                    height: `${Math.max(3, (d.precipMm / maxRain) * 100)}%`,
                    opacity: d.precipMm > 0 ? 0.9 : 0.3,
                  }}
                />
              </div>
              <span className="font-mono text-xs tabular-nums text-muted">
                {d.precipMm.toFixed(1)} mm
              </span>
              <span className="text-center text-[11px] leading-tight text-muted">
                {describeCode(d.code).label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
