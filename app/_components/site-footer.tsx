"use client";

import Link from "next/link";
import { LogoMark } from "./logo";
import { useT } from "@/lib/i18n";

/**
 * Marketing footer — a filled deep-green band that closes the page, with
 * navigation, provenance, and data attributions (required for OSM/CARTO).
 */
export function SiteFooter() {
  const t = useT();
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
            <p className="mt-3 max-w-xs text-sm text-on-brand/75">{t("foot.tagline")}</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-on-brand/60">
              {t("foot.product")}
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/how-it-works" className="text-on-brand/85 hover:text-on-brand">{t("nav.how")}</Link></li>
              <li><Link href="/demo" className="text-on-brand/85 hover:text-on-brand">{t("nav.demo")}</Link></li>
              <li><Link href="/#start" className="text-on-brand/85 hover:text-on-brand">{t("nav.start")}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-on-brand/60">
              {t("nav.developers")}
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
          <p className="mt-1">{t("foot.advisory")}</p>
        </div>
      </div>
    </footer>
  );
}
