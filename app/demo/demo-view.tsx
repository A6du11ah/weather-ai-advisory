"use client";

import { useCallback, useEffect, useState } from "react";
import { PRESETS, type Preset } from "@/lib/places";
import { CROPS, DEFAULT_CROP, type CropProfile } from "@/lib/crops";
import type { AdvisoryPayload } from "@/lib/advisory";
import type { AdvisoryChange } from "@/lib/diff";
import type { SeasonTimeline as Season } from "@/lib/growth";
import type { Usage } from "@/lib/types";
import { AdvisoryBody } from "@/app/_components/advisory-body";
import { SeasonTimeline } from "@/app/_components/season-timeline";
import { ChipRow } from "@/app/_components/controls";

interface ApiResponse extends AdvisoryPayload {
  changes: AdvisoryChange[];
  season: Season | null;
  gdd: { gdd: number; throughDate: string } | null;
  meta: {
    fetchedAt: string;
    origin: string;
    stale: boolean;
    ageHours: number | null;
    usage: Usage | null;
  };
}

function Skeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading advisories">
      <div className="h-20 animate-pulse rounded-2xl border border-border bg-surface-muted motion-reduce:animate-none" />
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-52 animate-pulse rounded-2xl border border-border bg-surface-muted motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

/** The anonymous demo playground: pick a location + crop, see the advisory. */
export default function DemoView() {
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [crop, setCrop] = useState<CropProfile>(DEFAULT_CROP);
  const [planted, setPlanted] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = PRESETS.find((x) => x.id === params.get("loc"));
    const c = CROPS.find((x) => x.id === params.get("crop"));
    const pl = params.get("planted");
    if (p) setPreset(p);
    if (c) setCrop(c);
    if (pl && /^\d{4}-\d{2}-\d{2}$/.test(pl)) setPlanted(pl);
  }, []);

  const load = useCallback(async (p: Preset, c: CropProfile, plant: string) => {
    setLoading(true);
    setError(null);
    try {
      const plantParam = plant ? `&planted=${plant}` : "";
      const res = await fetch(`/api/advisory?lat=${p.lat}&lon=${p.lon}&crop=${c.id}${plantParam}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Request failed (${res.status})`);
        setData(null);
      } else {
        setData(json as ApiResponse);
      }
    } catch {
      setError("Could not reach the advisory service.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(preset, crop, planted);
    const plantQ = planted ? `&planted=${planted}` : "";
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?loc=${preset.id}&crop=${crop.id}${plantQ}`,
    );
  }, [preset, crop, planted, load]);

  return (
    <div>
      <div className="space-y-4">
        <ChipRow
          legend="Location"
          items={PRESETS.map((p) => ({ id: p.id, label: p.name, sublabel: p.country }))}
          activeId={preset.id}
          onSelect={(id) => setPreset(PRESETS.find((p) => p.id === id) ?? PRESETS[0])}
        />
        <ChipRow
          legend="Crop"
          items={CROPS.map((c) => ({ id: c.id, label: c.name }))}
          activeId={crop.id}
          onSelect={(id) => setCrop(CROPS.find((c) => c.id === id) ?? DEFAULT_CROP)}
        />
        <p className="text-sm text-muted">{crop.note}</p>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted">
            Planting date{" "}
            <span className="font-normal normal-case tracking-normal">
              (optional — adds the season timeline & growing-degree-days)
            </span>
          </label>
          <input
            type="date"
            value={planted}
            onChange={(e) => setPlanted(e.target.value)}
            className="well mt-1.5 block min-h-[44px] w-full max-w-xs rounded-xl px-3 text-sm text-foreground sm:w-56"
          />
        </div>
      </div>

      <div className="mt-6">
        {loading && <Skeleton />}

        {!loading && error && (
          <div role="alert" className="rounded-2xl border border-border bg-poor-bg p-5 text-poor">
            <p className="font-medium">Could not load advisories</p>
            <p className="mt-1 text-sm opacity-90">{error}</p>
            <button
              type="button"
              onClick={() => void load(preset, crop, planted)}
              className="mt-3 min-h-[44px] cursor-pointer rounded-lg border border-current px-4 text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && data && (
          <div className="space-y-4">
            {data.season && (
              <SeasonTimeline
                season={data.season}
                activities={[]}
                tasks={[
                  ...(data.advisories.spray.best && data.advisories.spray.best.verdict !== "poor"
                    ? [{ date: data.advisories.spray.best.time.slice(0, 10), label: "Spray window", kind: "spray" as const }]
                    : []),
                  ...(data.advisories.drying.best
                    ? [{ date: data.advisories.drying.best.startDate, label: "Drying window", kind: "dry" as const }]
                    : []),
                ]}
                today={data.days[0]?.date ?? ""}
              />
            )}
          <AdvisoryBody
            payload={data}
            changes={data.changes}
            gdd={data.gdd}
            meta={
              <footer className="card px-5 py-4 text-xs text-muted">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>
                    Updated{" "}
                    {new Date(data.meta.fetchedAt).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <span>· {data.meta.origin}</span>
                  {data.meta.usage && (
                    <span>
                      · {data.meta.usage.remaining}/{data.meta.usage.limit} API
                      requests left
                    </span>
                  )}
                </div>
              </footer>
            }
          />
          </div>
        )}
      </div>
    </div>
  );
}
