"use client";

import { useCallback, useEffect, useState } from "react";
import { PRESETS, type Preset } from "@/lib/places";
import type { CurrentPoint, DayPoint, Place, Usage } from "@/lib/types";
import type {
  DryingWindow,
  Evidence,
  SprayWindow,
  Verdict,
  WindCheck,
} from "@/lib/rules";
import { describeCode } from "@/lib/weathercode";

interface SourceRef {
  label: string;
  note: string;
  url: string;
}

interface AdvisoryResponse {
  place: Place;
  current: CurrentPoint;
  days: DayPoint[];
  aiSummary: string | null;
  advisories: {
    drying: {
      best: DryingWindow | null;
      closest: DryingWindow | null;
      alternatives: DryingWindow[];
      minRunDays: number;
      source: SourceRef;
    };
    spray: {
      best: SprayWindow | null;
      byDay: SprayWindow[];
      windCheck: WindCheck;
      sources: SourceRef[];
    };
  };
  meta: {
    fetchedAt: string;
    stale: boolean;
    cached: boolean;
    usage: Usage | null;
  };
}

const VERDICT_STYLE: Record<Verdict, string> = {
  good: "bg-good-bg text-good",
  marginal: "bg-marginal-bg text-marginal",
  poor: "bg-poor-bg text-poor",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  good: "Go",
  marginal: "Marginal",
  poor: "Avoid",
};

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    hour: "numeric",
  });
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${VERDICT_STYLE[verdict]}`}
    >
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

function EvidenceList({ items }: { items: Evidence[] }) {
  return (
    <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {items.map((e) => (
        <div
          key={e.label}
          className="flex items-baseline justify-between gap-3 border-b border-border pb-2"
        >
          <dt className="text-sm text-muted">{e.label}</dt>
          <dd className="flex items-center gap-1.5 font-mono text-sm tabular-nums">
            {e.value}
            <span
              aria-label={e.ok ? "meets threshold" : "outside threshold"}
              className={e.ok ? "text-good" : "text-poor"}
            >
              {e.ok ? "✓" : "✕"}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SourceNote({ sources }: { sources: SourceRef[] }) {
  if (sources.length === 0) return null;
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-muted hover:text-foreground">
        Why these thresholds?
      </summary>
      <div className="mt-2 space-y-3">
        {sources.map((s) => (
          <p key={s.url} className="leading-relaxed text-muted">
            {s.note}{" "}
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {s.label}
            </a>
          </p>
        ))}
      </div>
    </details>
  );
}

function AdvisoryCard({
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
  verdict: Verdict | null;
  evidence: Evidence[];
  sources: SourceRef[];
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-0.5 text-sm text-muted">{question}</p>
        </div>
        {verdict && <VerdictBadge verdict={verdict} />}
      </div>

      <p className="mt-4 text-xl font-semibold leading-snug sm:text-2xl">
        {headline}
      </p>

      {evidence.length > 0 && <EvidenceList items={evidence} />}
      {children}
      <SourceNote sources={sources} />
    </section>
  );
}

function ForecastStrip({ days }: { days: DayPoint[] }) {
  const maxRain = Math.max(1, ...days.map((d) => d.precipMm));

  return (
    <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="text-base font-semibold">7-day outlook</h2>
      <div className="mt-4 overflow-x-auto">
        <div className="flex min-w-max gap-2">
          {days.map((d) => (
            <div
              key={d.date}
              className="flex w-28 flex-col items-center gap-2 rounded-lg bg-surface-muted p-3"
            >
              <span className="text-xs font-medium text-muted">
                {fmtDate(d.date)}
              </span>
              <span className="font-mono text-sm tabular-nums">
                {d.tempMaxC.toFixed(0)}° / {d.tempMinC.toFixed(0)}°
              </span>
              <div
                className="flex h-14 w-full items-end justify-center"
                title={`${d.precipMm.toFixed(1)} mm`}
              >
                <div
                  className="w-4 rounded-t bg-good"
                  style={{
                    height: `${Math.max(3, (d.precipMm / maxRain) * 100)}%`,
                    opacity: d.precipMm > 0 ? 0.85 : 0.2,
                  }}
                />
              </div>
              <span className="font-mono text-xs tabular-nums text-muted">
                {d.precipMm.toFixed(1)} mm
              </span>
              <span className="text-center text-[11px] leading-tight text-muted">
                {describeCode(d.code).label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading advisories">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-44 animate-pulse rounded-xl border border-border bg-surface-muted"
        />
      ))}
    </div>
  );
}

export default function AdvisoryView() {
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [data, setData] = useState<AdvisoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: Preset) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/advisory?lat=${p.lat}&lon=${p.lon}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Request failed (${res.status})`);
        setData(null);
      } else {
        setData(json as AdvisoryResponse);
      }
    } catch {
      setError("Could not reach the advisory service.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(preset);
  }, [preset, load]);

  const drying = data?.advisories.drying;
  const spray = data?.advisories.spray;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Field Window
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          Two decisions from one forecast: when grain can dry safely, and when
          spraying will not be washed off. Built on the WeatherAI API.
        </p>
      </header>

      <nav aria-label="Locations" className="mt-6">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const active = p.id === preset.id;
            return (
              <button
                key={p.id}
                onClick={() => setPreset(p)}
                aria-pressed={active}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                  active
                    ? "border-transparent bg-foreground text-background"
                    : "border-border bg-surface hover:bg-surface-muted"
                }`}
              >
                {p.name}
                <span className="ml-1.5 text-xs opacity-60">{p.country}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-muted">{preset.context}</p>
      </nav>

      <div className="mt-6 space-y-4">
        {loading && <Skeleton />}

        {!loading && error && (
          <div className="rounded-xl border border-border bg-poor-bg p-5 text-poor">
            <p className="font-medium">Could not load advisories</p>
            <p className="mt-1 text-sm opacity-90">{error}</p>
            <button
              onClick={() => void load(preset)}
              className="mt-3 rounded-lg border border-current px-3 py-1.5 text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && data && (
          <>
            {data.aiSummary && (
              <section className="rounded-xl border border-border bg-surface-muted p-5">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Summary
                </h2>
                <p className="mt-2 leading-relaxed">{data.aiSummary}</p>
              </section>
            )}

            <AdvisoryCard
              title="Grain drying"
              question="Do I have a safe stretch to dry the harvest?"
              verdict={drying?.best?.verdict ?? "poor"}
              headline={
                drying?.best
                  ? `${fmtDate(drying.best.startDate)} → ${fmtDate(drying.best.endDate)} · ${drying.best.days} dry days`
                  : drying?.closest
                    ? `Longest dry spell is ${drying.closest.days} day${drying.closest.days === 1 ? "" : "s"} — short of the ${drying.minRunDays} needed`
                    : "No dry days in the next 7 days."
              }
              evidence={(drying?.best ?? drying?.closest)?.evidence ?? []}
              sources={drying ? [drying.source] : []}
            >
              {drying && !drying.best && (
                <p className="mt-3 text-sm text-muted">
                  {drying.closest
                    ? `Keep the harvest under cover. Spreading grain into a ${drying.closest.days}-day gap leaves it damp when the rain returns, which is when aflatoxin develops.`
                    : "Keep the harvest under cover and consider mechanical drying."}
                </p>
              )}

              {drying && drying.alternatives.length > 0 && (
                <p className="mt-3 text-sm text-muted">
                  Also usable:{" "}
                  {drying.alternatives
                    .map(
                      (w) =>
                        `${fmtDate(w.startDate)}–${fmtDate(w.endDate)} (${w.days}d)`,
                    )
                    .join(" · ")}
                </p>
              )}
            </AdvisoryCard>

            <AdvisoryCard
              title="Spraying"
              question="When can I apply without losing it to rain?"
              verdict={spray?.best?.verdict ?? "poor"}
              headline={
                spray?.best
                  ? `${fmtDateTime(spray.best.time)} · ${spray.best.rainNext24hMm.toFixed(1)} mm rain in the 24h after`
                  : "No suitable application window in the forecast."
              }
              evidence={spray?.best?.evidence ?? []}
              sources={spray?.sources ?? []}
            >
              {spray && spray.byDay.length > 1 && (
                <div className="mt-4 overflow-x-auto">
                  <div className="flex min-w-max gap-2">
                    {spray.byDay.map((w) => (
                      <div
                        key={w.time}
                        className={`rounded-lg px-3 py-2 text-center text-xs ${VERDICT_STYLE[w.verdict]}`}
                      >
                        <div className="font-medium">
                          {new Date(w.time).toLocaleDateString(undefined, {
                            weekday: "short",
                          })}
                        </div>
                        <div className="mt-0.5 font-mono tabular-nums">
                          {new Date(w.time).toLocaleTimeString(undefined, {
                            hour: "numeric",
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {spray && (
                <div className="mt-4 rounded-lg border border-border bg-surface-muted p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">
                      Wind right now: {spray.windCheck.windKph.toFixed(0)} km/h
                    </span>
                    <span
                      className={
                        spray.windCheck.ok ? "text-good" : "text-marginal"
                      }
                    >
                      {spray.windCheck.ok ? "✓ in range" : "⚠ check before spraying"}
                    </span>
                  </div>
                  <p className="mt-1 text-muted">{spray.windCheck.note}</p>
                  <p className="mt-2 text-xs text-muted">
                    The API supplies wind only as a current observation, not a
                    forecast, so it cannot rank future windows — treat this as a
                    check to repeat at the moment of application.
                  </p>
                </div>
              )}
            </AdvisoryCard>

            <ForecastStrip days={data.days} />

            <footer className="rounded-xl border border-border bg-surface px-5 py-4 text-xs text-muted">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>
                  Updated{" "}
                  {new Date(data.meta.fetchedAt).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                {data.meta.cached && <span>· served from cache</span>}
                {data.meta.stale && (
                  <span className="text-marginal">
                    · upstream unavailable, showing last known forecast
                  </span>
                )}
                {data.meta.usage && (
                  <span>
                    · {data.meta.usage.remaining}/{data.meta.usage.limit} API
                    requests left on the {data.meta.usage.plan} plan
                  </span>
                )}
              </div>
              <p className="mt-2 leading-relaxed">
                Advisory only. Thresholds come from published agricultural
                extension guidance and are shown above so they can be checked
                against local practice.
              </p>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}
