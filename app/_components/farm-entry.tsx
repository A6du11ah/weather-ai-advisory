"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";

const STORAGE_KEY = "fieldwindow.farmKey";

/**
 * Farm entry card on the landing page.
 *
 * Create a farm (get a key, remembered locally) or return to a saved one. This
 * is the door into the actual product — the demo locations below it stay for
 * quick evaluation without an account.
 */
export default function FarmEntry() {
  const router = useRouter();
  const t = useT();
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setSavedKey(localStorage.getItem(STORAGE_KEY));
    } catch {
      // localStorage unavailable (private mode); the create/enter paths still work.
    }
  }, []);

  async function createFarm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/farm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not create farm.");
        return;
      }
      try {
        localStorage.setItem(STORAGE_KEY, json.key);
      } catch {
        /* ignore */
      }
      router.push(`/farm/${json.key}`);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold">{t("nav.start")}</h2>
      <p className="mt-1 text-sm text-muted">{t("farm.desc")}</p>

      {savedKey && (
        <a
          href={`/farm/${savedKey}`}
          className="mt-4 flex min-h-[48px] items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand transition-opacity hover:opacity-90"
        >
          {t("farm.open")}
        </a>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("farm.ph")}
          className="min-h-[44px] flex-1 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        />
        <button
          type="button"
          onClick={createFarm}
          disabled={busy}
          className={`min-h-[44px] cursor-pointer rounded-xl px-4 text-sm font-semibold transition-opacity disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
            savedKey
              ? "border border-border bg-surface hover:bg-surface-muted"
              : "bg-brand text-on-brand hover:opacity-90"
          }`}
        >
          {busy ? "…" : savedKey ? t("farm.another") : t("farm.create")}
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-poor">{error}</p>}
      <p className="mt-2 text-xs text-muted">{t("farm.note")}</p>
    </section>
  );
}
