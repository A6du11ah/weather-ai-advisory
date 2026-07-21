"use client";

import { useT } from "@/lib/i18n";

/**
 * Translated page title + intro for the marketing pages. Client so it follows
 * the language switch; the deeper body content of each page (sourced agronomy,
 * API reference) stays in reviewed English for now.
 */
export function PageIntro({
  titleKey,
  introKey,
}: {
  titleKey: string;
  introKey: string;
}) {
  const t = useT();
  return (
    <header className="mb-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        {t(titleKey)}
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-body">{t(introKey)}</p>
    </header>
  );
}
