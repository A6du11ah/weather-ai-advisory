"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PRESETS, type Preset } from "@/lib/places";
import { CROPS, DEFAULT_CROP, type CropProfile } from "@/lib/crops";
import type { AdvisoryPayload } from "@/lib/advisory";
import type { AdvisoryChange } from "@/lib/diff";
import type { Usage } from "@/lib/types";
import { AdvisoryBody } from "./_components/advisory-body";
import { ChipRow } from "./_components/controls";
import FarmEntry from "./_components/farm-entry";
import { Logo } from "./_components/logo";

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
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <header className="pt-4 sm:pt-8">
        <Logo size={30} />
        <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance text-foreground sm:text-5xl">
          Your season, one field at a time.
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-body">
          A weather companion that follows each field from planting to storage —
          knows its crop, its stage, and what you&rsquo;ve done — and gives you
          the two decisions that actually move the season: when to dry, and when
          to spray.
        </p>
      </header>

      <div className="mt-8">
        <FarmEntry />
      </div>

      <div className="mt-12 border-t border-border pt-8">
        <h2 className="font-display text-xl font-semibold">See it without an account</h2>
        <p className="mt-1 text-sm text-muted">
          A live advisory for a fixed set of demo locations.
        </p>
      </div>

      <div className="mt-5 space-y-4">
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
          <div role="alert" className="rounded-xl border border-border bg-poor-bg p-5 text-poor">
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
            <AdvisoryBody
              payload={data}
              changes={data.changes}
              meta={
                <footer className="rounded-xl border border-border bg-surface px-5 py-4 text-xs text-muted">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>
                      Updated{" "}
                      {new Date(data.meta.fetchedAt).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <span>· {data.meta.origin}</span>
                    {data.meta.stale && data.meta.ageHours !== null && (
                      <span className="text-marginal">
                        · upstream unavailable, {data.meta.ageHours}h old
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
              }
            />
            <div className="mt-4">
              <Link
                href={`/s/${preset.id}?crop=${crop.id}`}
                className="inline-flex min-h-[44px] items-center rounded-lg border border-border bg-surface px-4 text-sm hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              >
                Open {preset.name}&rsquo;s shareable page →
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
