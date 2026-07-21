"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdvisoryPayload } from "@/lib/advisory";
import type { FieldContext, FieldNote } from "@/lib/field-context";
import type { ForecastOrigin } from "@/lib/forecast-source";
import type { SeasonTimeline as Season } from "@/lib/growth";
import { AdvisoryBody } from "@/app/_components/advisory-body";
import { SeasonTimeline } from "@/app/_components/season-timeline";

interface Activity {
  id: number;
  kind: string;
  label: string | null;
  occurredOn: string;
  notes: string | null;
}

interface FieldData {
  field: {
    id: number;
    name: string;
    cropName: string;
    plantingDate: string | null;
  };
  advisory: AdvisoryPayload;
  context: FieldContext;
  season: Season | null;
  gdd: { gdd: number; throughDate: string } | null;
  meta: { origin: ForecastOrigin; ageHours: number | null };
  activities: Activity[];
}

const NOTE_STYLE: Record<FieldNote["tone"], string> = {
  info: "border-border bg-surface",
  action: "border-good/40 bg-good-bg",
  warning: "border-marginal/40 bg-marginal-bg",
};

const ACTIVITY_KINDS = ["spray", "fertilize", "plant", "harvest", "irrigate", "other"] as const;

function fmt(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function FieldDetail({
  farmKey,
  fieldId,
}: {
  farmKey: string;
  fieldId: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<FieldData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/farm/${farmKey}/fields/${fieldId}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not load field.");
        return;
      }
      setData(json as FieldData);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [farmKey, fieldId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function removeField() {
    if (!confirm("Delete this field and its log?")) return;
    await fetch(`/api/farm/${farmKey}/fields/${fieldId}`, { method: "DELETE" });
    router.push(`/farm/${farmKey}`);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <Link href={`/farm/${farmKey}`} className="text-sm text-muted underline-offset-2 hover:underline">
        ← Back to farm
      </Link>

      {loading && !data && (
        <div className="mt-6 h-40 animate-pulse rounded-xl border border-border bg-surface-muted motion-reduce:animate-none" />
      )}

      {error && (
        <div role="alert" className="mt-6 rounded-xl border border-border bg-poor-bg p-5 text-poor">
          <p>{error}</p>
          <button onClick={() => void load()} className="mt-3 min-h-[44px] rounded-lg border border-current px-4 text-sm">
            Retry
          </button>
        </div>
      )}

      {data && (
        <>
          <header className="mt-3 flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                {data.field.name}
              </h1>
              <p className="mt-1 text-muted">
                {data.field.cropName}
                {data.context.growth.stage && ` · ${data.context.growth.stage.label}`}
                {data.field.plantingDate && ` · planted ${fmt(data.field.plantingDate)}`}
              </p>
            </div>
            <button
              type="button"
              onClick={removeField}
              className="min-h-[44px] shrink-0 cursor-pointer rounded-lg border border-border px-3 text-sm text-muted transition-colors hover:border-poor/40 hover:text-poor"
            >
              Delete
            </button>
          </header>

          {/* The season journey — the centre of gravity for this field. */}
          {data.season && (
            <div className="mt-6">
              <SeasonTimeline
                season={data.season}
                activities={data.activities}
                tasks={data.context.tasks}
                today={data.advisory.days[0]?.date ?? ""}
              />
            </div>
          )}

          {/* What this field needs now. */}
          {data.context.notes.length > 0 && (
            <section className="mt-4 space-y-2">
              {data.context.notes.map((n, i) => (
                <p key={i} className={`rounded-2xl border px-4 py-3 text-sm ${NOTE_STYLE[n.tone]}`}>
                  {n.text}
                </p>
              ))}
            </section>
          )}

          <div className="mt-4">
            <AdvisoryBody
              payload={data.advisory}
              changes={[]}
              gdd={data.gdd}
              meta={
                <footer className="card px-5 py-4 text-xs text-muted">
                  <p>
                    Forecast {data.meta.origin}
                    {data.meta.ageHours !== null && ` · ${data.meta.ageHours}h old`}.
                    Growth stage and harvest date are estimates from a typical
                    crop calendar — your local knowledge overrides them.
                  </p>
                </footer>
              }
            />
          </div>

          {/* Activity log */}
          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Activity log</h2>
              <button
                type="button"
                onClick={() => setShowLog((v) => !v)}
                className="min-h-[44px] cursor-pointer rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-muted"
              >
                {showLog ? "Close" : "Log activity"}
              </button>
            </div>

            {showLog && (
              <LogActivityForm
                farmKey={farmKey}
                fieldId={fieldId}
                onLogged={() => {
                  setShowLog(false);
                  void load();
                }}
              />
            )}

            <ul className="mt-4 space-y-2">
              {data.activities.map((a) => (
                <li key={a.id} className="flex items-baseline justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                  <span>
                    <span className="font-medium capitalize">{a.kind}</span>
                    {a.label && ` — ${a.label}`}
                    {a.notes && <span className="text-muted"> · {a.notes}</span>}
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted">{fmt(a.occurredOn)}</span>
                </li>
              ))}
              {data.activities.length === 0 && (
                <li className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
                  Nothing logged yet. Record a spray or harvest and the advisory
                  will factor it in.
                </li>
              )}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

function LogActivityForm({
  farmKey,
  fieldId,
  onLogged,
}: {
  farmKey: string;
  fieldId: string;
  onLogged: () => void;
}) {
  const [kind, setKind] = useState<string>("spray");
  const [label, setLabel] = useState("");
  const [occurredOn, setOccurredOn] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/farm/${farmKey}/fields/${fieldId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, label, occurredOn, notes }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not log activity.");
        return;
      }
      onLogged();
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
          <span className="text-xs font-medium text-muted">Type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={`mt-1 ${inputCls} capitalize`}>
            {ACTIVITY_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted">Date</span>
          <input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} className={`mt-1 ${inputCls}`} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-muted">Label (e.g. product name)</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. mancozeb" className={`mt-1 ${inputCls}`} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-muted">Notes (optional)</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`mt-1 ${inputCls}`} />
        </label>
      </div>
      {error && <p className="mt-2 text-sm text-poor">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={busy || !occurredOn}
        className="mt-4 min-h-[44px] w-full cursor-pointer rounded-lg bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save to log"}
      </button>
    </div>
  );
}
