"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CROPS } from "@/lib/crops";
import { PRESETS } from "@/lib/places";
import { VERDICT } from "@/app/_components/advisory-ui";
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
            ← Home
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {data?.farm.name ?? "My farm"}
          </h1>
        </div>
      </header>

      {loading && !data && (
        <div className="mt-6 h-40 animate-pulse rounded-xl border border-border bg-surface-muted motion-reduce:animate-none" />
      )}

      {data && (
        <>
          {data.tasks.length > 0 && (
            <section className="mt-6 rounded-xl border border-border bg-surface-muted p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                This week
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

          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-base font-semibold">
              Fields{" "}
              <span className="font-normal text-muted">({data.fields.length})</span>
            </h2>
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className="min-h-[44px] cursor-pointer rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              {showAdd ? "Close" : "Add field"}
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
                  className="block rounded-xl border border-border bg-surface p-5 transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{f.name}</h3>
                      <p className="text-sm text-muted">
                        {f.cropName}
                        {f.stage && ` · ${f.stage}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <VerdictPill label="Dry" verdict={f.drying} />
                      <VerdictPill label="Spray" verdict={f.spray} />
                    </div>
                  </div>
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
                No fields yet. Add your first to get advisories tuned to it.
              </li>
            )}
          </ul>

          <p className="mt-8 rounded-lg border border-border bg-surface px-4 py-3 text-xs text-muted">
            This farm lives at a private link. Bookmark this page to return —
            anyone with the link can view and edit it.
          </p>
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
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [cropId, setCropId] = useState(CROPS[0].id);
  const [plantingDate, setPlantingDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(4));
        setLon(pos.coords.longitude.toFixed(4));
      },
      () => setError("Could not get your location — enter it manually."),
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
          lat: Number(lat),
          lon: Number(lon),
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
    "min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface p-5">
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
        <label className="block">
          <span className="text-xs font-medium text-muted">Latitude</span>
          <input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" placeholder="-0.7813" className={`mt-1 ${inputCls}`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted">Longitude</span>
          <input value={lon} onChange={(e) => setLon(e.target.value)} inputMode="decimal" placeholder="35.3416" className={`mt-1 ${inputCls}`} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-muted">Planting date (optional — enables stage tracking)</span>
          <input type="date" value={plantingDate} onChange={(e) => setPlantingDate(e.target.value)} className={`mt-1 ${inputCls}`} />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={useMyLocation} className="min-h-[44px] cursor-pointer rounded-lg border border-border bg-surface-muted px-3 text-sm hover:bg-border/40">
          Use my location
        </button>
        <span className="text-xs text-muted">or pick a nearby demo point:</span>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => { setLat(String(p.lat)); setLon(String(p.lon)); }}
            className="min-h-[44px] cursor-pointer rounded-full border border-border bg-surface px-3 text-xs hover:bg-surface-muted"
          >
            {p.name}
          </button>
        ))}
      </div>

      {error && <p className="mt-2 text-sm text-poor">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !lat || !lon}
        className="mt-4 min-h-[44px] w-full cursor-pointer rounded-lg bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
      >
        {busy ? "Adding…" : "Add field"}
      </button>
    </div>
  );
}
