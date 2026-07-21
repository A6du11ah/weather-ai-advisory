"use client";

import { useCallback, useEffect, useState } from "react";
import { PRESETS, type Preset } from "@/lib/places";
import { CROPS, DEFAULT_CROP, type CropProfile } from "@/lib/crops";
import type { AdvisoryPayload } from "@/lib/advisory";
import type { AdvisoryChange } from "@/lib/diff";
import type { Usage } from "@/lib/types";
import { AdvisoryBody } from "@/app/_components/advisory-body";
import { ChipRow } from "@/app/_components/controls";

interface ApiResponse extends AdvisoryPayload {
  changes: AdvisoryChange[];
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
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      const res = await fetch(`/api/advisory?lat=${p.lat}&lon=${p.lon}&crop=${c.id}`);
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
    void load(preset, crop);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?loc=${preset.id}&crop=${crop.id}`,
    );
  }, [preset, crop, load]);

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
      </div>

      <div className="mt-6">
        {loading && <Skeleton />}

        {!loading && error && (
          <div role="alert" className="rounded-2xl border border-border bg-poor-bg p-5 text-poor">
            <p className="font-medium">Could not load advisories</p>
            <p className="mt-1 text-sm opacity-90">{error}</p>
            <button
              type="button"
              onClick={() => void load(preset, crop)}
              className="mt-3 min-h-[44px] cursor-pointer rounded-lg border border-current px-4 text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && data && (
          <AdvisoryBody
            payload={data}
            changes={data.changes}
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
        )}
      </div>
    </div>
  );
}
