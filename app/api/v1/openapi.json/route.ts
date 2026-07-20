/**
 * OpenAPI description of the versioned advisory contract.
 *
 * Served as a route rather than a static file so the server base URL is filled
 * in at request time. This is what makes "an integrator can consume it" a
 * checkable claim rather than an assertion.
 */

import type { NextRequest } from "next/server";
import { PRESETS } from "@/lib/places";
import { CROPS } from "@/lib/crops";

export function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

  const spec = {
    openapi: "3.0.3",
    info: {
      title: "Field Window Advisory API",
      version: "1.0.0",
      description:
        "Grain-drying and spray-timing advisories derived from the WeatherAI forecast API, with day-over-day change detection. A reference implementation of what a WeatherAI B2B customer would embed.",
    },
    servers: [{ url: origin }],
    paths: {
      "/api/v1/advisory/{station}": {
        get: {
          summary: "Advisory for a station",
          parameters: [
            {
              name: "station",
              in: "path",
              required: true,
              schema: { type: "string", enum: PRESETS.map((p) => p.id) },
              description: "Station identifier.",
            },
            {
              name: "crop",
              in: "query",
              required: false,
              schema: { type: "string", enum: CROPS.map((c) => c.id), default: "maize" },
              description: "Crop profile; changes thresholds without another upstream fetch.",
            },
          ],
          responses: {
            "200": {
              description: "Advisory payload",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Advisory" },
                },
              },
            },
            "404": { description: "Unknown station" },
            "503": { description: "No forecast available" },
          },
        },
      },
    },
    components: {
      schemas: {
        Verdict: { type: "string", enum: ["good", "marginal", "poor"] },
        Advisory: {
          type: "object",
          required: ["apiVersion", "station", "crop", "headline", "drying", "spray", "changes"],
          properties: {
            apiVersion: { type: "string", example: "1.0" },
            station: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                country: { type: "string" },
                lat: { type: "number" },
                lon: { type: "number" },
              },
            },
            crop: {
              type: "object",
              properties: { id: { type: "string" }, name: { type: "string" } },
            },
            generatedAt: { type: "string", format: "date-time" },
            forecastAt: { type: "string", format: "date-time" },
            headline: { type: "string", example: "Nothing to do today. The next drying window opens 2026-07-25." },
            drying: {
              type: "object",
              properties: {
                verdict: { $ref: "#/components/schemas/Verdict" },
                startDate: { type: "string", nullable: true, format: "date" },
                endDate: { type: "string", nullable: true, format: "date" },
                days: { type: "integer" },
                score: { type: "integer" },
              },
            },
            spray: {
              type: "object",
              properties: {
                verdict: { $ref: "#/components/schemas/Verdict" },
                time: { type: "string", nullable: true },
                score: { type: "integer" },
                rainNext24hMm: { type: "number", nullable: true },
                effectiveWashMm: { type: "number", nullable: true },
              },
            },
            changes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  kind: {
                    type: "string",
                    enum: ["new", "retracted", "improved", "degraded", "shifted", "unchanged"],
                  },
                  summary: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  };

  return Response.json(spec, {
    headers: { "Cache-Control": "public, s-maxage=3600" },
  });
}
