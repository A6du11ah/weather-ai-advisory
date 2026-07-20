/**
 * The advisory cards for one location + crop.
 *
 * Presentational only — it takes a fully-built payload and renders it. Both the
 * home view and the station pages compose this, so the arrangement of headline,
 * change banner, cards, and forecast strip is defined once.
 */

import type { AdvisoryPayload } from "@/lib/advisory";
import type { AdvisoryChange } from "@/lib/diff";
import {
  AdvisoryCard,
  ChangesBanner,
  ForecastStrip,
  VERDICT,
  fmtDate,
  fmtDayTime,
} from "./advisory-ui";

export function AdvisoryBody({
  payload,
  changes,
  meta,
}: {
  payload: AdvisoryPayload;
  changes: AdvisoryChange[];
  meta: React.ReactNode;
}) {
  const drying = payload.advisories.drying;
  const spray = payload.advisories.spray;
  const dryingWindow = drying.best ?? drying.closest ?? null;

  return (
    <div className="space-y-4">
      <section
        aria-live="polite"
        className="rounded-2xl border border-brand/20 bg-brand-weak p-5 sm:p-6"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-brand/80">
          {payload.placeName} · {payload.crop.name} · today
        </p>
        <p className="mt-2 font-display text-xl font-semibold leading-snug text-balance sm:text-2xl">
          {payload.headline}
        </p>
      </section>

      <ChangesBanner changes={changes} />

      {payload.aiSummary && (
        <section className="card p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Forecast summary
          </h2>
          <p className="mt-2 leading-relaxed">{payload.aiSummary}</p>
        </section>
      )}

      <AdvisoryCard
        title="Drying"
        question={`Is there a long enough rain-free run to dry ${payload.crop.name.toLowerCase()}?`}
        verdict={drying.best?.verdict ?? "poor"}
        headline={
          drying.best
            ? `${fmtDate(drying.best.startDate)} → ${fmtDate(drying.best.endDate)} · ${drying.best.days} rain-free days`
            : drying.closest
              ? `Longest rain-free run is ${drying.closest.days} day${drying.closest.days === 1 ? "" : "s"} — short of the ${drying.minRunDays} needed`
              : "No rain-free days in the next 7 days."
        }
        evidence={dryingWindow?.evidence ?? []}
        sources={[drying.source]}
      >
        {!drying.best && (
          <p className="mt-4 text-sm text-muted">
            {drying.closest
              ? `Hold under cover. Spreading into a ${drying.closest.days}-day gap leaves the crop damp when rain returns — the point at which spoilage and aflatoxin risk begin.`
              : "Hold under cover and consider mechanical drying."}
          </p>
        )}
        {drying.alternatives.length > 0 && (
          <p className="mt-4 text-sm text-muted">
            Also usable:{" "}
            {drying.alternatives
              .map((w) => `${fmtDate(w.startDate)}–${fmtDate(w.endDate)} (${w.days}d)`)
              .join(" · ")}
          </p>
        )}
      </AdvisoryCard>

      <AdvisoryCard
        title="Spraying"
        question="When can I apply without losing it to rain?"
        verdict={spray.best?.verdict ?? "poor"}
        headline={
          spray.best
            ? `${fmtDayTime(spray.best.time)} · ${spray.best.rainNext24hMm.toFixed(1)} mm rain in the 24h after`
            : "No suitable application window in the forecast."
        }
        evidence={spray.best?.evidence ?? []}
        sources={spray.sources}
      >
        {spray.byDay.length > 1 && (
          <div className="scroll-x mt-5 -mx-1 overflow-x-auto px-1 pb-2">
            <ul className="flex min-w-max gap-2">
              {spray.byDay.map((w) => {
                const v = VERDICT[w.verdict];
                return (
                  <li key={w.time} className={`rounded-lg border px-3 py-2 text-center text-xs ${v.chip}`}>
                    <div className="font-medium">
                      {new Date(w.time).toLocaleDateString(undefined, { weekday: "short" })}
                    </div>
                    <div className="mt-0.5 font-mono tabular-nums">
                      {new Date(w.time).toLocaleTimeString(undefined, { hour: "numeric" })}
                    </div>
                    <div className="mt-1" aria-hidden="true">{v.glyph}</div>
                    <span className="sr-only">{v.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <div className="mt-5 rounded-lg border border-border bg-surface-muted p-3.5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">
              Wind right now: {spray.windCheck.windKph.toFixed(0)} km/h
            </span>
            <span className={spray.windCheck.ok ? "text-good" : "text-marginal"}>
              {spray.windCheck.ok ? "✓ in range" : "! check before spraying"}
            </span>
          </div>
          <p className="mt-1 text-muted">{spray.windCheck.note}</p>
          <p className="mt-2 text-xs text-muted">
            Wind is supplied only as a current observation, not a forecast, so it
            cannot rank future windows — repeat this check at the moment of
            application.
          </p>
        </div>
      </AdvisoryCard>

      <ForecastStrip days={payload.days} />

      {meta}
    </div>
  );
}
