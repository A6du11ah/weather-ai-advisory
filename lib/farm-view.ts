/**
 * Farm view assembly.
 *
 * Composes a field's stored record, its live-or-cached forecast, the weather
 * advisory, and the personalised field context into one object. Both the farm
 * dashboard and the field detail page build on this, so a field looks the same
 * everywhere and the personalisation logic lives in one place.
 */

import { buildAdvisory, type AdvisoryPayload } from "./advisory";
import { resolveForecastByCoords, type ForecastOrigin } from "./forecast-source";
import { buildFieldContext, type FieldContext } from "./field-context";
import { findCrop } from "./crops";
import type { ActivityRow, FieldRow } from "./db/schema";

export interface FieldView {
  field: {
    id: number;
    name: string;
    lat: number;
    lon: number;
    cropId: string;
    cropName: string;
    plantingDate: string | null;
  };
  advisory: AdvisoryPayload;
  context: FieldContext;
  meta: { origin: ForecastOrigin; ageHours: number | null };
}

/**
 * Build the full view for one field. Resolves weather by the field's own
 * coordinates (cached, live on miss) rather than a preset station.
 */
export async function composeField(
  field: FieldRow,
  activities: ActivityRow[],
  opts: { withAi: boolean },
): Promise<FieldView> {
  const crop = findCrop(field.cropId);
  const resolved = await resolveForecastByCoords(field.lat, field.lon, opts);

  const advisory = buildAdvisory({
    forecast: resolved.forecast,
    stationId: `field-${field.id}`,
    placeName: field.name,
    cropId: field.cropId,
  });

  const today = resolved.localDate || resolved.forecast.days[0]?.date || "";
  const context = buildFieldContext(
    { cropId: field.cropId, plantingDate: field.plantingDate },
    activities,
    advisory,
    today,
  );

  return {
    field: {
      id: field.id,
      name: field.name,
      lat: field.lat,
      lon: field.lon,
      cropId: field.cropId,
      cropName: crop.name,
      plantingDate: field.plantingDate,
    },
    advisory,
    context,
    meta: { origin: resolved.origin, ageHours: resolved.ageHours },
  };
}
