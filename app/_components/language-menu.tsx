"use client";

import { useEffect, useRef, useState } from "react";
import { LOCALES, setLocale, useLocale } from "@/lib/i18n";

/**
 * Language switcher for the site chrome and landing. A compact dropdown of the
 * supported locales; picking one persists it and updates the page language and
 * direction (RTL for Arabic).
 */
export function LanguageMenu() {
  const [open, setOpen] = useState(false);
  // Read the active locale from the shared store so every menu instance stays
  // in sync when one of them changes the language.
  const active = useLocale();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const label = LOCALES.find((l) => l.code === active)?.code.toUpperCase() ?? "EN";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Change language"
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-1 rounded-lg border border-border px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
      >
        <span aria-hidden="true">🌐</span>
        <span className="font-mono text-xs">{label}</span>
      </button>
      {open && (
        <ul className="card-raised absolute right-0 z-[600] mt-1.5 max-h-72 w-44 overflow-auto py-1">
          {LOCALES.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                onClick={() => {
                  setLocale(l.code);
                  setOpen(false);
                }}
                className={`flex min-h-[40px] w-full items-center justify-between px-3 text-left text-sm hover:bg-surface-muted ${
                  l.code === active ? "font-semibold text-brand" : ""
                }`}
                dir={l.dir}
              >
                {l.label}
                {l.code === active && <span aria-hidden="true">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
