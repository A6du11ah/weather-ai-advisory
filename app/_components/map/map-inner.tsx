"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * The actual Leaflet map. Loaded only via a dynamic import with ssr:false
 * (see MapView), because Leaflet touches `window` at module load.
 *
 * Vanilla Leaflet, not react-leaflet: react-leaflet's context re-initialises
 * the map under React 19 strict effects. The known Next-16 failure modes are
 * handled inline — the `_leaflet_id` guard, an explicit container height, an
 * invalidateSize after mount, and a CSS `divIcon` pin so the default marker
 * PNGs (which 404 under Turbopack) are never requested.
 */

const BRAND_PIN = `
<div style="position:relative;width:28px;height:36px">
  <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 35C14 35 26 22 26 13A12 12 0 1 0 2 13c0 9 12 22 12 22Z"
      fill="#2e5d3a" stroke="#fbf7ee" stroke-width="2"/>
    <circle cx="14" cy="13" r="4.5" fill="#c8811e"/>
  </svg>
</div>`;

export interface MapInnerProps {
  lat: number;
  lon: number;
  /** Fired when the user moves the pin (drag or tap). */
  onPick?: (lat: number, lon: number) => void;
  /** External recentring (e.g. after a place search). Bump `flyToken` to trigger. */
  flyTo?: { lat: number; lon: number; token: number } | null;
  /** Read-only overview mode: no draggable pin, optional multiple markers. */
  markers?: { lat: number; lon: number; label: string }[];
  height?: number;
  zoom?: number;
}

export default function MapInner({
  lat,
  lon,
  onPick,
  flyTo,
  markers,
  height = 340,
  zoom = 12,
}: MapInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // Create the map once.
  useEffect(() => {
    const el = containerRef.current;
    // Guard against React 19 double-invoke re-initialising the same node.
    if (!el || (el as unknown as { _leaflet_id?: number })._leaflet_id) return;

    const map = L.map(el, { zoomControl: true, attributionControl: true }).setView(
      [lat, lon],
      zoom,
    );
    mapRef.current = map;

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    ).addTo(map);

    const icon = L.divIcon({
      html: BRAND_PIN,
      className: "",
      iconSize: [28, 36],
      iconAnchor: [14, 35],
    });

    if (markers && markers.length > 0) {
      // Overview mode: plot all markers, fit them in view.
      const group = L.featureGroup(
        markers.map((m) =>
          L.marker([m.lat, m.lon], { icon }).bindTooltip(m.label),
        ),
      ).addTo(map);
      if (markers.length > 1) map.fitBounds(group.getBounds().pad(0.3));
    } else {
      // Picker mode: one draggable pin; tapping the map moves it.
      const marker = L.marker([lat, lon], { icon, draggable: Boolean(onPick) }).addTo(map);
      markerRef.current = marker;
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        onPickRef.current?.(p.lat, p.lng);
      });
      if (onPick) {
        map.on("click", (e: L.LeafletMouseEvent) => {
          marker.setLatLng(e.latlng);
          onPickRef.current?.(e.latlng.lat, e.latlng.lng);
        });
      }
    }

    // Tiles can render grey until the container's real size is known.
    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Intentionally run once; updates are handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recentre + move the pin when a search result is chosen.
  useEffect(() => {
    if (!flyTo || !mapRef.current) return;
    mapRef.current.flyTo([flyTo.lat, flyTo.lon], 13, { duration: 0.6 });
    markerRef.current?.setLatLng([flyTo.lat, flyTo.lon]);
  }, [flyTo]);

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="w-full overflow-hidden rounded-2xl border border-border"
    />
  );
}
