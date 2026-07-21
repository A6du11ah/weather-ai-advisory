"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { LanguageMenu } from "./language-menu";
import { useT } from "@/lib/i18n";

/**
 * Marketing site header. Sticky, with a logo lockup, primary nav, and the
 * "start" CTA. Collapses to a slide-down menu on mobile. This chrome wraps the
 * public pages only; the app has its own minimal shell.
 */
const NAV = [
  { href: "/how-it-works", key: "nav.how" },
  { href: "/demo", key: "nav.demo" },
  { href: "/developers", key: "nav.developers" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const t = useT();
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-field/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center" aria-label="Seasonwise home">
          <Logo size={26} />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-body transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              {t(n.key)}
            </Link>
          ))}
          <span className="mx-1 flex items-center gap-1">
            <LanguageMenu />
            <ThemeToggle />
          </span>
          <Link
            href="/#start"
            className="ml-1 inline-flex min-h-[40px] items-center rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand shadow-sm transition-opacity hover:opacity-90"
          >
            {t("nav.start")}
          </Link>
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          <LanguageMenu />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            <span aria-hidden="true" className="text-lg">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-field px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-sm font-medium text-ink-body hover:bg-surface-muted"
              >
                {t(n.key)}
              </Link>
            ))}
            <Link
              href="/#start"
              onClick={() => setOpen(false)}
              className="mt-1 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand"
            >
              {t("nav.start")}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
