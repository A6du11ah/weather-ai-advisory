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
  ConditionsPanel,
  ForecastStrip,
  VERDICT,
  fmtDate,
  fmtDayTime,
  type GddInfo,
} from "./advisory-ui";
import { useT } from "@/lib/i18n";

export function AdvisoryBody({
  payload,
  changes,
  meta,
  gdd,
}: {
  payload: AdvisoryPayload;
  changes: AdvisoryChange[];
  meta: React.ReactNode;
  gdd?: GddInfo | null;
}) {
  const t = useT();
  const drying = payload.advisories.drying;
  const spray = payload.advisories.spray;
  const dryingWindow = drying.best ?? drying.closest ?? null;

  return (
    <div className="space-y-4">
      <section
        aria-live="polite"
        className="relative overflow-hidden rounded-2xl border border-brand/20 bg-brand-tint p-5 pl-6 sm:p-6 sm:pl-7"
      >
        <div className="absolute inset-y-0 left-0 w-1 bg-brand" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-mid">
          {payload.placeName} · {payload.crop.name} · today
        </p>
        <p className="mt-2 font-display text-xl font-semibold leading-snug text-balance text-foreground sm:text-2xl">
          {payload.headlineKey
            ? t(payload.headlineKey, payload.headlineParams)
            : payload.headline}
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
        title={t("a.drying")}
        question={t("q.drying", { crop: payload.crop.name.toLowerCase() })}
        verdict={drying.best?.verdict ?? "poor"}
        headline={
          drying.best
            ? `${fmtDate(drying.best.startDate)} → ${fmtDate(drying.best.endDate)} · ${t("hl.rainFreeDays", { days: drying.best.days })}`
            : drying.closest
              ? t("hl.dryShort", {
                  days: `${drying.closest.days} ${drying.closest.days === 1 ? t("st.day") : t("st.days")}`,
                  needed: drying.minRunDays,
                })
              : t("hl.dryNone")
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
        title={t("a.spraying")}
        question={t("q.spraying")}
        verdict={spray.best?.verdict ?? "poor"}
        headline={
          spray.best
            ? `${fmtDayTime(spray.best.time)} · ${t("hl.rainAfter", { mm: spray.best.rainNext24hMm.toFixed(1) })}`
            : t("hl.sprayNone")
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

      <ConditionsPanel conditions={payload.conditions} gdd={gdd} />

      <ForecastStrip days={payload.days} />

      {meta}
    </div>
  );
}
