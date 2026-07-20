"use client";

import { useEffect, useRef, useState } from "react";

export interface PlacePick {
  lat: number;
  lon: number;
  label: string;
}

interface GeoResult {
  name: string;
  label: string;
  lat: number;
  lon: number;
  country: string | null;
}

/**
 * Debounced place search over /api/geocode (Open-Meteo). Picking a result
 * hands its coordinates + label up so the map can recentre and the field can
 * store a readable place name — no raw lat/lon typing required.
 */
export function LocationSearch({ onPick }: { onPick: (p: PlacePick) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounce queries; abort in-flight requests when the term changes.
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const json = await res.json();
        setResults(json.results ?? []);
        setOpen(true);
      } catch {
        /* aborted or offline — leave prior results */
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search a place — town, district…"
        className="well min-h-[48px] w-full rounded-xl px-3.5 text-sm text-foreground placeholder:text-ink-faint"
        aria-label="Search for a location"
        autoComplete="off"
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
          …
        </span>
      )}
      {open && results.length > 0 && (
        <ul className="card-raised absolute z-[500] mt-1.5 max-h-64 w-full overflow-auto py-1">
          {results.map((r, i) => (
            <li key={`${r.lat}-${r.lon}-${i}`}>
              <button
                type="button"
                onClick={() => {
                  onPick({ lat: r.lat, lon: r.lon, label: r.label });
                  setQ(r.label);
                  setOpen(false);
                }}
                className="flex min-h-[44px] w-full items-center px-3.5 text-left text-sm hover:bg-surface-muted"
              >
                <span className="truncate">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
