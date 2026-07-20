/**
 * Per-station Open Graph card.
 *
 * When a station link is forwarded into a chat, this is what unfurls: the
 * location and today's headline verdict, legible without opening the page.
 * The card *is* the message, which the research identified as how these
 * advisories actually spread.
 */

import { ImageResponse } from "next/og";
import { findPreset } from "@/lib/places";
import { buildAdvisory } from "@/lib/advisory";
import { resolveForecast } from "@/lib/forecast-source";

export const alt = "Field Window advisory";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COLORS = {
  bg: "#14130f",
  surface: "#1d1b17",
  text: "#f0ece3",
  muted: "#a09a8e",
  good: "#6cc294",
  marginal: "#e0aa53",
  poor: "#e58a80",
};

export default async function Image(props: {
  params: Promise<{ station: string }>;
}) {
  const { station } = await props.params;
  const preset = findPreset(station);

  let headline = "Field Window";
  let sub = "Grain drying and spray advisories";
  let accent = COLORS.muted;

  if (preset) {
    sub = `${preset.name}, ${preset.country}`;
    try {
      const resolved = await resolveForecast(preset, { withAi: false });
      const payload = buildAdvisory({
        forecast: resolved.forecast,
        stationId: preset.id,
        placeName: preset.name,
      });
      headline = payload.headline;
      const v =
        payload.advisories.drying.best?.verdict ??
        payload.advisories.spray.best?.verdict ??
        "poor";
      accent = COLORS[v];
    } catch {
      headline = `Advisory for ${preset.name}`;
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: COLORS.bg,
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "6px",
              background: accent,
            }}
          />
          <div style={{ fontSize: "30px", color: COLORS.muted, letterSpacing: "-0.01em" }}>
            Field Window
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ fontSize: "34px", color: COLORS.muted }}>{sub}</div>
          <div
            style={{
              fontSize: "64px",
              color: COLORS.text,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              maxWidth: "1000px",
            }}
          >
            {headline}
          </div>
        </div>

        <div style={{ fontSize: "26px", color: COLORS.muted }}>
          When the harvest can dry, and when to spray without losing it to rain.
        </div>
      </div>
    ),
    size,
  );
}
