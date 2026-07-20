/**
 * Field context — the personalisation layer.
 *
 * Combines a field's crop and planting date, its activity log, and the current
 * weather advisory into guidance about *this* field. This is what the anonymous
 * location+crop view cannot do: it knows what you planted, when, and what you
 * have already done, so it can talk about your situation rather than the sky.
 *
 * Pure: everything is derived from the arguments and the injected `today`.
 */

import type { AdvisoryPayload } from "./advisory";
import { growthState, type GrowthState } from "./growth";
import type { ActivityRow } from "./db/schema";

export interface FieldNote {
  tone: "info" | "action" | "warning";
  text: string;
}

export interface FieldTask {
  /** ISO date the task points at, for sorting. */
  date: string;
  label: string;
  kind: "spray" | "dry" | "harvest" | "stage";
}

export interface FieldContext {
  growth: GrowthState;
  lastSpray: { label: string | null; date: string; daysAgo: number } | null;
  notes: FieldNote[];
  tasks: FieldTask[];
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(`${fromISO.slice(0, 10)}T00:00:00Z`).getTime();
  const b = new Date(`${toISO.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * Assemble the personalised context for a field.
 *
 * @param field      crop id and (optional) planting date
 * @param activities the field's log, any order
 * @param advisory   the already-built weather advisory for the field
 * @param today      the field's local calendar date (forecast's first day)
 */
export function buildFieldContext(
  field: { cropId: string; plantingDate: string | null },
  activities: ActivityRow[],
  advisory: AdvisoryPayload,
  today: string,
): FieldContext {
  const growth = growthState(field.cropId, field.plantingDate, today);
  const notes: FieldNote[] = [];
  const tasks: FieldTask[] = [];

  // --- Growth stage ------------------------------------------------------
  if (growth.hasCalendar && growth.stage) {
    notes.push({
      tone: "info",
      text: `${growth.stage.label} (day ${growth.daysAfterPlanting} after planting). ${growth.stage.note}`,
    });

    // Stage-sensitive weather cross-checks.
    const heatStressed = advisory.days.some((d) => d.tempMaxC >= 34);
    if (
      (growth.stage.key === "flowering" || growth.stage.key === "panicle") &&
      heatStressed
    ) {
      notes.push({
        tone: "warning",
        text: "Flowering coincides with a hot spell in the forecast — the most yield-sensitive combination. Prioritise any irrigation you can give.",
      });
    }
  }

  // --- Last spray --------------------------------------------------------
  const sprays = activities
    .filter((a) => a.kind === "spray")
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
  const lastSprayRow = sprays[0] ?? null;
  const lastSpray = lastSprayRow
    ? {
        label: lastSprayRow.label,
        date: lastSprayRow.occurredOn,
        daysAgo: daysBetween(lastSprayRow.occurredOn, today),
      }
    : null;

  if (lastSpray) {
    if (lastSpray.daysAgo <= 1) {
      notes.push({
        tone: "info",
        text: `Sprayed ${lastSpray.label ? `${lastSpray.label} ` : ""}${lastSpray.daysAgo === 0 ? "today" : "yesterday"} — keep off the crop until the deposit is rainfast and any re-entry interval has passed.`,
      });
    } else {
      notes.push({
        tone: "info",
        text: `Last spray was ${lastSpray.daysAgo} days ago${lastSpray.label ? ` (${lastSpray.label})` : ""}.`,
      });
    }
  }

  // --- Harvest horizon and pre-harvest interval --------------------------
  if (growth.hasCalendar && growth.daysToHarvest !== null && growth.estimatedHarvest) {
    if (growth.daysToHarvest <= 0) {
      notes.push({
        tone: "action",
        text: "Past estimated maturity — harvest when a dry window allows and moisture is right.",
      });
    } else if (growth.daysToHarvest <= 21) {
      notes.push({
        tone: "action",
        text: `About ${growth.daysToHarvest} days to estimated harvest (${growth.estimatedHarvest}). Start lining up a drying window.`,
      });
      tasks.push({
        date: growth.estimatedHarvest,
        label: `Estimated harvest for ${advisory.crop.name}`,
        kind: "harvest",
      });

      // Pre-harvest interval: warn if a spray now would sit inside the PHI.
      if (
        growth.preHarvestIntervalDays !== null &&
        growth.daysToHarvest < growth.preHarvestIntervalDays
      ) {
        notes.push({
          tone: "warning",
          text: `Within the ~${growth.preHarvestIntervalDays}-day pre-harvest interval — a spray now may leave residue at harvest. Check the product label before applying.`,
        });
      }
    }
  }

  // --- Turn advisory windows into dated tasks ----------------------------
  const spray = advisory.advisories.spray.best;
  if (spray && spray.verdict !== "poor") {
    tasks.push({
      date: spray.time.slice(0, 10),
      label: `Spray window — ${advisory.crop.name}`,
      kind: "spray",
    });
  }
  const drying = advisory.advisories.drying.best;
  if (drying) {
    tasks.push({
      date: drying.startDate,
      label: `Drying window opens (${drying.days} days)`,
      kind: "dry",
    });
  }

  tasks.sort((a, b) => a.date.localeCompare(b.date));

  return { growth, lastSpray, notes, tasks };
}
