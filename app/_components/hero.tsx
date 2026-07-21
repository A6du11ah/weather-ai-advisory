"use client";

import Link from "next/link";
import { LogoMark } from "./logo";
import { useT } from "@/lib/i18n";

/** The landing hero. Client-side so its copy follows the language switcher. */
export function Hero() {
  const t = useT();
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-96 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 60% 100% at 50% 0%, var(--brand-weak), transparent 70%)",
        }}
        aria-hidden="true"
      />
      <div className="relative mx-auto w-full max-w-5xl px-4 pt-16 pb-12 text-center sm:pt-24">
        <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-ink-body shadow-sm">
          <LogoMark size={16} /> {t("hero.badge")}
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance text-foreground sm:text-6xl">
          {t("hero.title")}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink-body">
          {t("hero.subtitle")}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="#start"
            className="inline-flex min-h-[48px] items-center rounded-xl bg-brand px-6 text-sm font-semibold text-on-brand shadow-sm transition-opacity hover:opacity-90"
          >
            {t("hero.startFree")}
          </Link>
          <Link
            href="/demo"
            className="inline-flex min-h-[48px] items-center rounded-xl border border-border bg-surface px-6 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted"
          >
            {t("hero.seeDemo")}
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted">{t("hero.noSignup")}</p>
      </div>
    </section>
  );
}
