import Link from "next/link";
import { LogoMark } from "./logo";

/**
 * Marketing footer — a filled deep-green band that closes the page, with
 * navigation, provenance, and data attributions (required for OSM/CARTO).
 */
export function SiteFooter() {
  return (
    <footer className="mt-20 bg-brand-deep text-on-brand">
      <div className="mx-auto w-full max-w-5xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="rounded-lg bg-on-brand/10 p-1">
                <LogoMark size={24} tone="light" />
              </span>
              <span className="font-display text-lg font-semibold">Seasonwise</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-on-brand/75">
              Your season, one field at a time. Weather-driven decisions from
              planting to storage.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-on-brand/60">
              Product
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/how-it-works" className="text-on-brand/85 hover:text-on-brand">How it works</Link></li>
              <li><Link href="/demo" className="text-on-brand/85 hover:text-on-brand">Live demo</Link></li>
              <li><Link href="/#start" className="text-on-brand/85 hover:text-on-brand">Start a farm</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-on-brand/60">
              Developers
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/developers" className="text-on-brand/85 hover:text-on-brand">API reference</Link></li>
              <li>
                <a
                  href="/api/v1/openapi.json"
                  target="_blank"
                  rel="noreferrer"
                  className="text-on-brand/85 hover:text-on-brand"
                >
                  openapi.json (raw) ↗
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-on-brand/15 pt-6 text-xs text-on-brand/60">
          <p>
            Weather by WeatherAI · Maps © OpenStreetMap contributors © CARTO ·
            Geocoding by Open-Meteo &amp; Nominatim
          </p>
          <p className="mt-1">
            Advisory only. Thresholds are general extension guidance; local
            practice and product labels take precedence.
          </p>
        </div>
      </div>
    </footer>
  );
}
