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
  { label: string; glyph: string; chip: string; solid: string; bar: string; fill: string }
> = {
  good: {
    label: "Go",
    glyph: "✓",
    chip: "bg-good-bg text-good border-good/30",
    solid: "bg-good text-on-brand",
    bar: "bg-good",
    fill: "from-good-bg",
  },
  marginal: {
    label: "Marginal",
    glyph: "!",
    chip: "bg-marginal-bg text-marginal border-marginal/30",
    solid: "bg-marginal text-on-amber",
    bar: "bg-marginal",
    fill: "from-marginal-bg",
  },
  poor: {
    label: "Avoid",
    glyph: "✕",
    chip: "bg-poor-bg text-poor border-poor/30",
    solid: "bg-poor text-on-brand",
    bar: "bg-poor",
    fill: "from-poor-bg",
  },
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
  // Filled at full saturation — the verdict is the payload, so it is
  // deliberately the loudest thing on the card.
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] shadow-sm ${v.solid}`}
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
  const v = VERDICT[verdict];
  return (
    <section className="card-raised relative overflow-hidden">
      {/* Verdict as a left spine + a fill that fades from the top — colour is
          structure, not a lonely rail. */}
      <div className={`absolute inset-y-0 left-0 w-[5px] ${v.bar}`} aria-hidden="true" />
      <div className={`bg-gradient-to-b ${v.fill} to-40% to-transparent`}>
        <div className="p-5 pl-6 sm:p-6 sm:pl-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-semibold leading-tight">{title}</h2>
              <p className="mt-0.5 text-sm text-muted">{question}</p>
            </div>
            <VerdictBadge verdict={verdict} />
          </div>
          <p className="mt-4 font-display text-xl font-semibold leading-snug text-balance text-foreground sm:text-2xl">
            {headline}
          </p>
          <EvidenceList items={evidence} />
          {children}
          <SourceNote sources={sources} />
        </div>
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
      className={`rounded-2xl border p-4 sm:p-5 ${
        urgent ? "border-marginal/40 bg-marginal-bg" : "card"
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
  // Bar length scales to the wettest day, so the rain column reads as a small
  // chart you can scan straight down to find the dry stretch.
  const maxRain = Math.max(2, ...days.map((d) => d.precipMm));
  // A day is "dry enough to dry grain" below ~1mm — mark it, since that is the
  // whole point of reading a week ahead here.
  const isDry = (mm: number) => mm <= 1;

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">7-day outlook</h2>
      <ul className="mt-3 divide-y divide-border">
        {days.map((d, i) => {
          const dry = isDry(d.precipMm);
          const day = new Date(`${d.date}T00:00:00`);
          return (
            <li key={d.date} className="flex items-center gap-3 py-2.5">
              {/* Day */}
              <div className="w-12 shrink-0">
                <div className="text-sm font-medium">
                  {i === 0 ? "Today" : day.toLocaleDateString(undefined, { weekday: "short" })}
                </div>
                <div className="font-mono text-xs tabular-nums text-muted">
                  {day.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                </div>
              </div>

              {/* Condition + rain bar */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${dry ? "bg-good" : "bg-rain"}`}
                    aria-hidden="true"
                  />
                  <span className="truncate text-sm text-muted">
                    {describeCode(d.code).label}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-rain"
                    style={{
                      width: `${Math.round((d.precipMm / maxRain) * 100)}%`,
                      opacity: d.precipMm > 0 ? 1 : 0,
                    }}
                  />
                </div>
              </div>

              {/* Rain amount + temp */}
              <div className="w-24 shrink-0 text-right">
                <div className="font-mono text-sm tabular-nums">
                  <span className={dry ? "text-muted" : "text-foreground"}>
                    {d.precipMm.toFixed(1)}
                  </span>
                  <span className="text-muted"> mm</span>
                </div>
                <div className="font-mono text-xs tabular-nums text-muted">
                  {d.tempMaxC.toFixed(0)}° / {d.tempMinC.toFixed(0)}°
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-good" aria-hidden="true" />
        rain-free enough to dry
      </p>
    </section>
  );
}
