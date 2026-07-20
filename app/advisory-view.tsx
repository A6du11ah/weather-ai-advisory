"use client";

import { useCallback, useEffect, useState } from "react";
import { PRESETS, type Preset } from "@/lib/places";
import { CROPS, DEFAULT_CROP, type CropProfile } from "@/lib/crops";
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
  placeName: string;
  crop: {
    id: string;
    name: string;
    note: string;
    minRunDays: number;
    storageMoisturePct: number;
  };
  headline: string;
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
    staleHours: number | null;
    cached: boolean;
    usage: Usage | null;
  };
}

/**
 * Verdict presentation.
 *
 * Colour is never the only carrier of meaning — each verdict also has a word
 * and a distinct glyph, so the state survives greyscale printing, a cheap
 * screen in sunlight, and colour-vision deficiency.
 */
const VERDICT: Record<Verdict, { label: string; glyph: string; chip: string; bar: string }> = {
  good: {
    label: "Go",
    glyph: "✓",
    chip: "bg-good-bg text-good border-good/30",
    bar: "bg-good",
  },
  marginal: {
    label: "Marginal",
    glyph: "!",
    chip: "bg-marginal-bg text-marginal border-marginal/30",
    bar: "bg-marginal",
  },
  poor: {
    label: "Avoid",
    glyph: "✕",
    chip: "bg-poor-bg text-poor border-poor/30",
    bar: "bg-poor",
  },
};

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function fmtDayTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    hour: "numeric",
  });
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
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

function EvidenceList({ items }: { items: Evidence[] }) {
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

function SourceNote({ sources }: { sources: SourceRef[] }) {
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
  verdict: Verdict;
  evidence: Evidence[];
  sources: SourceRef[];
  children?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      {/* Verdict is legible before any text is read. */}
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

function ForecastStrip({ days }: { days: DayPoint[] }) {
  const maxRain = Math.max(1, ...days.map((d) => d.precipMm));

  return (
    <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="text-base font-semibold">7-day outlook</h2>
      <div className="mt-4 -mx-1 overflow-x-auto px-1 pb-1">
        <ul className="flex min-w-max gap-2">
          {days.map((d) => {
            const info = describeCode(d.code);
            return (
              <li
                key={d.date}
                className="flex w-28 flex-col items-center gap-2 rounded-lg bg-surface-muted p-3"
              >
                <span className="text-xs font-medium text-muted">
                  {fmtDate(d.date)}
                </span>
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
                  {info.label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading advisories">
      <div className="h-20 animate-pulse rounded-xl border border-border bg-surface-muted motion-reduce:animate-none" />
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-52 animate-pulse rounded-xl border border-border bg-surface-muted motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

export default function AdvisoryView() {
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [crop, setCrop] = useState<CropProfile>(DEFAULT_CROP);
  const [data, setData] = useState<AdvisoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore selection from the URL so a link carries the full view. Costs no
  // extra API call — the same forecast is re-scored for whatever crop is set.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = PRESETS.find((x) => x.id === params.get("loc"));
    const c = CROPS.find((x) => x.id === params.get("crop"));
    if (p) setPreset(p);
    if (c) setCrop(c);
  }, []);

  const load = useCallback(async (p: Preset, c: CropProfile) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/advisory?lat=${p.lat}&lon=${p.lon}&crop=${c.id}`,
      );
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
    void load(preset, crop);
    const url = `${window.location.pathname}?loc=${preset.id}&crop=${crop.id}`;
    window.history.replaceState(null, "", url);
  }, [preset, crop, load]);

  const drying = data?.advisories.drying;
  const spray = data?.advisories.spray;
  const dryingWindow = drying?.best ?? drying?.closest ?? null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Field Window
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          Two decisions from one forecast: when the harvest can dry safely, and
          when spraying will not be washed off.
        </p>
      </header>

      {/* Controls. Both re-score the same cached forecast. */}
      <div className="mt-6 space-y-4">
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted">
            Location
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((p) => {
              const active = p.id === preset.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p)}
                  aria-pressed={active}
                  className={`min-h-[44px] cursor-pointer rounded-full border px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
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
        </fieldset>

        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted">
            Crop
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {CROPS.map((c) => {
              const active = c.id === crop.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCrop(c)}
                  aria-pressed={active}
                  className={`min-h-[44px] cursor-pointer rounded-full border px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
                    active
                      ? "border-transparent bg-foreground text-background"
                      : "border-border bg-surface hover:bg-surface-muted"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-sm text-muted">{crop.note}</p>
        </fieldset>
      </div>

      <div className="mt-6 space-y-4">
        {loading && <Skeleton />}

        {!loading && error && (
          <div
            role="alert"
            className="rounded-xl border border-border bg-poor-bg p-5 text-poor"
          >
            <p className="font-medium">Could not load advisories</p>
            <p className="mt-1 text-sm opacity-90">{error}</p>
            <button
              type="button"
              onClick={() => void load(preset, crop)}
              className="mt-3 min-h-[44px] cursor-pointer rounded-lg border border-current px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && data && (
          <>
            {/* The single answer to "what do I do today", above everything. */}
            <section
              aria-live="polite"
              className="rounded-xl border border-border bg-surface-muted p-5 sm:p-6"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {data.placeName} · {data.crop.name} · today
              </p>
              <p className="mt-2 text-lg font-semibold leading-snug text-balance sm:text-xl">
                {data.headline}
              </p>
            </section>

            {data.aiSummary && (
              <section className="rounded-xl border border-border bg-surface p-5">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Forecast summary
                </h2>
                <p className="mt-2 leading-relaxed">{data.aiSummary}</p>
              </section>
            )}

            <AdvisoryCard
              title="Drying"
              question={`Is there a stretch long enough to dry ${data.crop.name.toLowerCase()}?`}
              verdict={drying?.best?.verdict ?? "poor"}
              headline={
                drying?.best
                  ? `${fmtDate(drying.best.startDate)} → ${fmtDate(drying.best.endDate)} · ${drying.best.days} dry days`
                  : drying?.closest
                    ? `Longest dry spell is ${drying.closest.days} day${drying.closest.days === 1 ? "" : "s"} — short of the ${drying.minRunDays} needed`
                    : "No dry days in the next 7 days."
              }
              evidence={dryingWindow?.evidence ?? []}
              sources={drying ? [drying.source] : []}
            >
              {drying && !drying.best && (
                <p className="mt-4 text-sm text-muted">
                  {drying.closest
                    ? `Hold under cover. Spreading into a ${drying.closest.days}-day gap leaves the crop damp when rain returns — the point at which spoilage and aflatoxin risk begin.`
                    : "Hold under cover and consider mechanical drying."}
                </p>
              )}

              {drying && drying.alternatives.length > 0 && (
                <p className="mt-4 text-sm text-muted">
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
                  ? `${fmtDayTime(spray.best.time)} · ${spray.best.rainNext24hMm.toFixed(1)} mm rain in the 24h after`
                  : "No suitable application window in the forecast."
              }
              evidence={spray?.best?.evidence ?? []}
              sources={spray?.sources ?? []}
            >
              {spray && spray.byDay.length > 1 && (
                <div className="mt-5 -mx-1 overflow-x-auto px-1 pb-1">
                  <ul className="flex min-w-max gap-2">
                    {spray.byDay.map((w) => {
                      const v = VERDICT[w.verdict];
                      return (
                        <li
                          key={w.time}
                          className={`rounded-lg border px-3 py-2 text-center text-xs ${v.chip}`}
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
                          <div className="mt-1" aria-hidden="true">
                            {v.glyph}
                          </div>
                          <span className="sr-only">{v.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {spray && (
                <div className="mt-5 rounded-lg border border-border bg-surface-muted p-3.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      Wind right now: {spray.windCheck.windKph.toFixed(0)} km/h
                    </span>
                    <span
                      className={
                        spray.windCheck.ok ? "text-good" : "text-marginal"
                      }
                    >
                      {spray.windCheck.ok
                        ? "✓ in range"
                        : "! check before spraying"}
                    </span>
                  </div>
                  <p className="mt-1 text-muted">{spray.windCheck.note}</p>
                  <p className="mt-2 text-xs text-muted">
                    Wind is supplied only as a current observation, not a
                    forecast, so it cannot rank future windows — repeat this
                    check at the moment of application.
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
                {data.meta.cached && <span>· cached</span>}
                {data.meta.stale && (
                  <span className="text-marginal">
                    · upstream unavailable, showing forecast from{" "}
                    {data.meta.staleHours}h ago
                  </span>
                )}
                {data.meta.usage && (
                  <span>
                    · {data.meta.usage.remaining}/{data.meta.usage.limit} API
                    requests left ({data.meta.usage.plan} plan)
                  </span>
                )}
              </div>
              <p className="mt-2 leading-relaxed">
                Advisory only. Thresholds are general extension guidance shown
                above so they can be checked against local practice and product
                labels, which take precedence.
              </p>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}
