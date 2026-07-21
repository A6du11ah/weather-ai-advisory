"use client";

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
import type { FrostWatch, HeatWatch, WorkWindow } from "@/lib/conditions";
import { describeCode } from "@/lib/weathercode";
import { useT } from "@/lib/i18n";

const VERDICT_KEY: Record<Verdict, string> = {
  good: "v.go",
  marginal: "v.marginal",
  poor: "v.avoid",
};

export interface GddInfo {
  gdd: number;
  throughDate: string;
}

function fmtShort(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** A labelled stat with a coloured top-accent bar — the "instrument panel" read. */
function StatTile({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  accent: "brand" | "amber";
}) {
  return (
    <div className="card relative overflow-hidden p-4">
      <div
        className={`absolute inset-x-0 top-0 h-[3px] ${accent === "amber" ? "bg-amber" : "bg-brand"}`}
        aria-hidden="true"
      />
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-muted">{unit}</span>}
      </p>
    </div>
  );
}

function AlertCard({
  tone,
  icon,
  title,
  body,
}: {
  tone: "warn" | "info";
  icon: string;
  title: string;
  body: string;
}) {
  const cls =
    tone === "warn"
      ? "border-marginal/40 bg-marginal-bg"
      : "border-brand/25 bg-brand-tint";
  const spine = tone === "warn" ? "bg-marginal" : "bg-brand";
  const ink = tone === "warn" ? "text-marginal-ink" : "text-foreground";
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 pl-5 ${cls}`}>
      <div className={`absolute inset-y-0 left-0 w-1 ${spine}`} aria-hidden="true" />
      <div className="flex items-start gap-2.5">
        <span aria-hidden="true" className="text-lg leading-none">{icon}</span>
        <div>
          <p className={`text-sm font-semibold ${ink}`}>{title}</p>
          <p className="mt-0.5 text-sm text-ink-body">{body}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Conditions & watches beyond the two headline decisions — frost, heat, the
 * next field-work window, and (on a field with a planting date) accumulated
 * growing-degree-days. Alerts show only when relevant; the tiles are always
 * useful.
 */
export function ConditionsPanel({
  conditions,
  gdd,
}: {
  conditions: {
    frost: FrostWatch | null;
    heat: HeatWatch | null;
    work: WorkWindow | null;
  };
  gdd?: GddInfo | null;
}) {
  const t = useT();
  const { frost, heat, work } = conditions;
  const hasAlert = frost || heat;
  const hasTile = work || gdd;
  if (!hasAlert && !hasTile) return null;

  const leadPhrase = (days: number) =>
    days === 0 ? "tonight" : days === 1 ? "tomorrow night" : `in ${days} days`;

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">{t("a.conditions")}</h2>

      {hasAlert && (
        <div className="mt-4 space-y-2.5">
          {frost && (
            <AlertCard
              tone="warn"
              icon="❄"
              title={
                frost.severity === "frost"
                  ? `Frost risk ${leadPhrase(frost.leadDays)}`
                  : `Cold night ${leadPhrase(frost.leadDays)}`
              }
              body={`Low of ${frost.minC.toFixed(0)}°C on ${fmtShort(frost.date)}. ${
                frost.severity === "frost"
                  ? "Protect sensitive crops."
                  : "Keep an eye on it."
              }`}
            />
          )}
          {heat && (
            <AlertCard
              tone="warn"
              icon="▲"
              title={`Heat stress ${heat.leadDays === 0 ? "today" : `in ${heat.leadDays} days`}`}
              body={`${heat.maxC.toFixed(0)}°C on ${fmtShort(heat.date)}${
                heat.count > 1 ? `, ${heat.count} hot days this week` : ""
              }. Water if you can; worst during flowering.`}
            />
          )}
        </div>
      )}

      {hasTile && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {work && (
            <StatTile
              label="Next dry spell"
              value={`${work.days}`}
              unit={work.days === 1 ? "day" : "days"}
              accent="brand"
            />
          )}
          {gdd && (
            <StatTile
              label="Growing-degree-days"
              value={gdd.gdd.toLocaleString()}
              unit="since planting"
              accent="amber"
            />
          )}
        </div>
      )}
    </section>
  );
}

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
  const t = useT();
  // Filled at full saturation — the verdict is the payload, so it is
  // deliberately the loudest thing on the card.
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] shadow-sm ${v.solid}`}
    >
      <span aria-hidden="true">{v.glyph}</span>
      {t(VERDICT_KEY[verdict])}
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
  const t = useT();
  // Bar length scales to the wettest day, so the rain column reads as a small
  // chart you can scan straight down to find the dry stretch.
  const maxRain = Math.max(2, ...days.map((d) => d.precipMm));
  // A day is "dry enough to dry grain" below ~1mm — mark it, since that is the
  // whole point of reading a week ahead here.
  const isDry = (mm: number) => mm <= 1;

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">{t("a.outlook")}</h2>
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
