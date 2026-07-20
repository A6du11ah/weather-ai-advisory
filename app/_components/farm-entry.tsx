"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
    <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="text-base font-semibold">Your farm</h2>
      <p className="mt-1 text-sm text-muted">
        Save your fields and crops, log what you do, and get advisories tuned to
        each field&rsquo;s stage — not just the weather.
      </p>

      {savedKey && (
        <a
          href={`/farm/${savedKey}`}
          className="mt-4 flex min-h-[44px] items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background"
        >
          Open my farm →
        </a>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Farm name (optional)"
          className="min-h-[44px] flex-1 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        />
        <button
          type="button"
          onClick={createFarm}
          disabled={busy}
          className="min-h-[44px] cursor-pointer rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-muted disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          {busy ? "Creating…" : savedKey ? "Create another" : "Create a farm"}
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-poor">{error}</p>}
      <p className="mt-2 text-xs text-muted">
        No sign-up. Your farm lives at a private link kept on this device — save
        it to return from another phone.
      </p>
    </section>
  );
}
