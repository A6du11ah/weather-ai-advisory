"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CROPS } from "@/lib/crops";
import { PRESETS } from "@/lib/places";
import { VERDICT } from "@/app/_components/advisory-ui";
import { MapView } from "@/app/_components/map/map-view";
import { LocationSearch } from "@/app/_components/map/location-search";
import { FarmQr } from "@/app/_components/farm-qr";
import { useT } from "@/lib/i18n";
import type { Verdict } from "@/lib/rules";
import type { FieldTask } from "@/lib/field-context";

interface FieldSummary {
  id: number;
  name: string;
  cropName: string;
  headline: string;
  drying: Verdict;
  spray: Verdict;
  stage: string | null;
  progress: number | null;
  daysToHarvest: number | null;
  nextTask: FieldTask | null;
}

interface FarmData {
  farm: { name: string; key: string };
  fields: FieldSummary[];
  tasks: (FieldTask & { field: string })[];
}

function fmt(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function FarmDashboard({ farmKey }: { farmKey: string }) {
  const t = useT();
  const [data, setData] = useState<FarmData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/farm/${farmKey}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [farmKey]);

  useEffect(() => {
    void load();
  }, [load]);

  if (notFound) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <p className="text-muted">
          Farm not found. <Link href="/" className="underline">Start over</Link>.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-muted underline-offset-2 hover:underline">
            ← {t("a.home")}
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {data?.farm.name ?? "My farm"}
          </h1>
        </div>
      </header>

      {loading && !data && (
        <div className="mt-6 h-40 animate-pulse rounded-2xl border border-border bg-surface-muted motion-reduce:animate-none" />
      )}

      {data && (
        <>
          {data.tasks.length > 0 && (
            <section className="mt-6 rounded-2xl border border-brand/20 bg-brand-weak p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-brand/80">
                {t("a.week")}
              </h2>
              <ul className="mt-2 space-y-1.5">
                {data.tasks.slice(0, 6).map((t, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                    <span>
                      <span className="font-medium">{t.field}:</span> {t.label}
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                      {fmt(t.date)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-8 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">
              {t("a.fields")}{" "}
              <span className="font-normal text-muted">({data.fields.length})</span>
            </h2>
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className={`min-h-[44px] cursor-pointer rounded-xl px-4 text-sm font-semibold transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                showAdd
                  ? "border border-border bg-surface hover:bg-surface-muted"
                  : "bg-brand text-on-brand hover:opacity-90"
              }`}
            >
              {showAdd ? t("a.close") : t("a.add")}
            </button>
          </div>

          {showAdd && (
            <AddFieldForm
              farmKey={farmKey}
              onAdded={() => {
                setShowAdd(false);
                void load();
              }}
            />
          )}

          <ul className="mt-4 space-y-3">
            {data.fields.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/farm/${farmKey}/field/${f.id}`}
                  className="card block p-5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg font-semibold">{f.name}</h3>
                      <p className="text-sm text-muted">
                        {f.cropName}
                        {f.stage && ` · ${f.stage}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <VerdictPill label={t("v.dry")} verdict={f.drying} />
                      <VerdictPill label={t("v.spray")} verdict={f.spray} />
                    </div>
                  </div>

                  {f.progress !== null && (
                    <div className="mt-3">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${Math.round(f.progress * 100)}%` }}
                        />
                      </div>
                      {f.daysToHarvest !== null && f.daysToHarvest > 0 && (
                        <p className="mt-1 text-xs text-muted">
                          {f.daysToHarvest} days to harvest
                        </p>
                      )}
                    </div>
                  )}

                  <p className="mt-3 text-sm">{f.headline}</p>
                  {f.nextTask && (
                    <p className="mt-1 text-xs text-muted">
                      Next: {f.nextTask.label} · {fmt(f.nextTask.date)}
                    </p>
                  )}
                </Link>
              </li>
            ))}
            {data.fields.length === 0 && !showAdd && (
              <li className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
                {t("a.empty")}
              </li>
            )}
          </ul>

          <div className="mt-8">
            <FarmQr farmKey={farmKey} />
          </div>
        </>
      )}
    </main>
  );
}

function VerdictPill({ label, verdict }: { label: string; verdict: Verdict }) {
  const v = VERDICT[verdict];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${v.chip}`}>
      <span aria-hidden="true">{v.glyph}</span>
      {label}
    </span>
  );
}

function AddFieldForm({
  farmKey,
  onAdded,
}: {
  farmKey: string;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  // Default the map to the first demo location so it never opens on null island.
  const [lat, setLat] = useState(PRESETS[0].lat);
  const [lon, setLon] = useState(PRESETS[0].lon);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [picked, setPicked] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lat: number; lon: number; token: number } | null>(null);
  const [cropId, setCropId] = useState(CROPS[0].id);
  const [plantingDate, setPlantingDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function moveTo(nextLat: number, nextLon: number, label: string | null) {
    setLat(nextLat);
    setLon(nextLon);
    setPlaceName(label);
    setPicked(true);
    setFlyTo({ lat: nextLat, lon: nextLon, token: Date.now() });
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => moveTo(pos.coords.latitude, pos.coords.longitude, null),
      () => setError("Could not get your location — search or drop a pin instead."),
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/farm/${farmKey}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          lat,
          lon,
          placeName,
          cropId,
          plantingDate: plantingDate || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not add field.");
        return;
      }
      onAdded();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "well min-h-[48px] w-full rounded-xl px-3.5 text-sm text-foreground";

  return (
    <div className="card mt-4 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-muted">Field name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="North plot" className={`mt-1 ${inputCls}`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted">Crop</span>
          <select value={cropId} onChange={(e) => setCropId(e.target.value)} className={`mt-1 ${inputCls}`}>
            {CROPS.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-muted">Planting date (optional — enables stage tracking)</span>
          <input type="date" value={plantingDate} onChange={(e) => setPlantingDate(e.target.value)} className={`mt-1 ${inputCls}`} />
        </label>
      </div>

      {/* Location: search, then fine-tune by dragging the pin. */}
      <div className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-muted">Location</span>
          <button
            type="button"
            onClick={useMyLocation}
            className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-medium hover:bg-surface-muted"
          >
            <span aria-hidden="true">◎</span> Use my location
          </button>
        </div>
        <div className="mt-1.5">
          <LocationSearch onPick={(p) => moveTo(p.lat, p.lon, p.label)} />
        </div>
        <div className="mt-2.5">
          <MapView
            lat={lat}
            lon={lon}
            flyTo={flyTo}
            onPick={(la, lo) => moveTo(la, lo, null)}
            height={280}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          {picked ? (
            <>
              {placeName ? <span className="text-foreground">{placeName} · </span> : null}
              <span className="font-mono tabular-nums">
                {lat.toFixed(4)}, {lon.toFixed(4)}
              </span>{" "}
              — drag the pin to your exact field.
            </>
          ) : (
            "Search a place or tap the map to set your field, then drag the pin to fine-tune."
          )}
        </p>
      </div>

      {error && <p className="mt-3 text-sm text-poor">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !picked}
        className="mt-4 min-h-[48px] w-full cursor-pointer rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Adding…" : picked ? "Add field" : "Set a location first"}
      </button>
    </div>
  );
}
