"use client";

import type { SeasonTimeline as Season } from "@/lib/growth";

interface Activity {
  id: number;
  kind: string;
  label: string | null;
  occurredOn: string;
}

interface UpcomingTask {
  date: string;
  label: string;
  kind: "spray" | "dry" | "harvest" | "stage";
}

/**
 * A milestone on the season journey, from any source. The timeline merges crop
 * stages, logged activities, and upcoming weather windows into one ordered
 * story and marks where "today" falls.
 */
interface Milestone {
  date: string;
  title: string;
  detail: string | null;
  type: "plant" | "stage" | "activity" | "task" | "harvest";
  when: "past" | "current" | "future";
}

const DOT: Record<Milestone["type"], string> = {
  plant: "bg-brand",
  stage: "bg-brand/70",
  activity: "bg-foreground/60",
  task: "bg-marginal",
  harvest: "bg-brand",
};

function fmt(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

const ACTIVITY_VERB: Record<string, string> = {
  spray: "Sprayed",
  fertilize: "Fertilised",
  plant: "Planted",
  harvest: "Harvested",
  irrigate: "Irrigated",
  other: "Logged",
};

/**
 * The season journey. This is the product's centre of gravity: the field's
 * path from planting to storage, with the weather advisory riding on top of it
 * as the next thing to do rather than the whole point.
 */
export function SeasonTimeline({
  season,
  activities,
  tasks,
  today,
}: {
  season: Season;
  activities: Activity[];
  tasks: UpcomingTask[];
  today: string;
}) {
  const milestones: Milestone[] = [];

  milestones.push({
    date: season.plantingDate,
    title: "Planted",
    detail: null,
    type: "plant",
    when: "past",
  });

  for (const s of season.stages) {
    // Skip the planting-day stage; "Planted" already covers it.
    if (s.day === 0) continue;
    milestones.push({
      date: s.date,
      title: s.label,
      detail: s.note,
      type: "stage",
      when: s.status,
    });
  }

  for (const a of activities) {
    milestones.push({
      date: a.occurredOn,
      title: `${ACTIVITY_VERB[a.kind] ?? "Logged"}${a.label ? ` — ${a.label}` : ""}`,
      detail: null,
      type: "activity",
      when: a.occurredOn <= today ? "past" : "future",
    });
  }

  for (const t of tasks) {
    // The estimated harvest is added explicitly below, so skip the task-derived
    // harvest milestone to avoid showing it twice on the same date.
    if (t.kind === "harvest") continue;
    milestones.push({
      date: t.date,
      title: t.label,
      detail: null,
      type: "task",
      when: t.date < today ? "past" : t.date === today ? "current" : "future",
    });
  }

  milestones.push({
    date: season.estimatedHarvest,
    title: "Estimated harvest",
    detail: null,
    type: "harvest",
    when: season.estimatedHarvest <= today ? "past" : "future",
  });

  // Stable chronological order; ties keep insertion order via index.
  const ordered = milestones
    .map((m, i) => ({ m, i }))
    .sort((a, b) => a.m.date.localeCompare(b.m.date) || a.i - b.i)
    .map((x) => x.m);

  // Index of the first future item, where the "today" divider goes.
  const todayIdx = ordered.findIndex((m) => m.date > today);

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">The season</h2>
        <span className="text-sm text-muted">
          day {season.daysAfterPlanting} of {season.daysAfterPlanting + season.daysToHarvest}
        </span>
      </div>

      {/* Progress ribbon */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${Math.round(season.progress * 100)}%` }}
        />
      </div>
      <p className="mt-1.5 text-sm text-muted">
        {season.daysToHarvest > 0
          ? `${season.daysToHarvest} days to estimated harvest`
          : "Past estimated maturity"}
      </p>

      {/* Vertical journey */}
      <ol className="mt-5 space-y-0">
        {ordered.map((m, i) => {
          const showToday = i === todayIdx;
          return (
            <li key={`${m.date}-${m.title}-${i}`}>
              {showToday && <TodayRow today={today} />}
              <div className="relative flex gap-3 pb-4">
                {/* connector line */}
                {i < ordered.length - 1 && (
                  <span
                    className="absolute left-[5px] top-3 h-full w-px bg-border"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={`relative mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-surface ${DOT[m.type]} ${
                    m.when === "current" ? "scale-125" : ""
                  } ${m.when === "future" ? "opacity-50" : ""}`}
                  aria-hidden="true"
                />
                <div className={m.when === "future" ? "opacity-70" : ""}>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className={`text-sm ${m.when === "current" ? "font-semibold text-brand" : "font-medium"}`}>
                      {m.title}
                    </span>
                    {m.when === "current" && (
                      <span className="rounded-full bg-brand-weak px-2 py-0.5 text-[11px] font-semibold text-brand">
                        now
                      </span>
                    )}
                    <span className="font-mono text-xs tabular-nums text-muted">
                      {fmt(m.date)}
                    </span>
                  </div>
                  {m.detail && <p className="mt-0.5 text-xs text-muted">{m.detail}</p>}
                </div>
              </div>
            </li>
          );
        })}
        {todayIdx === -1 && <TodayRow today={today} trailing />}
      </ol>
    </section>
  );
}

function TodayRow({ today, trailing }: { today: string; trailing?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${trailing ? "pt-1" : "pb-4"}`}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-brand bg-background" aria-hidden="true" />
      <span className="text-xs font-semibold uppercase tracking-wide text-brand">
        Today · {fmt(today)}
      </span>
      <span className="h-px flex-1 bg-brand/30" aria-hidden="true" />
    </div>
  );
}
