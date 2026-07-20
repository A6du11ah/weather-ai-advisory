"use client";

import dynamic from "next/dynamic";
import type { MapInnerProps } from "./map-inner";

/**
 * Client-side-only wrapper around the Leaflet map. `ssr:false` must live in a
 * client component in the Next 16 App Router, so this thin file exists purely
 * to hold that boundary; server components import this, never MapInner.
 */
const MapInner = dynamic(() => import("./map-inner"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full animate-pulse rounded-2xl border border-border bg-surface-muted motion-reduce:animate-none"
      style={{ height: 340 }}
    />
  ),
});

export function MapView(props: MapInnerProps) {
  return <MapInner {...props} />;
}
