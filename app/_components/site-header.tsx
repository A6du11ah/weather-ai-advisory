"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "./logo";

/**
 * Marketing site header. Sticky, with a logo lockup, primary nav, and the
 * "start" CTA. Collapses to a slide-down menu on mobile. This chrome wraps the
 * public pages only; the app has its own minimal shell.
 */
const NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/demo", label: "Demo" },
  { href: "/developers", label: "Developers" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-field/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center" aria-label="Field Window home">
          <Logo size={26} />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-body transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
          <Link
            href="/#start"
            className="ml-2 inline-flex min-h-[40px] items-center rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand shadow-sm transition-opacity hover:opacity-90"
          >
            Start your farm
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          <span aria-hidden="true" className="text-lg">{open ? "✕" : "☰"}</span>
        </button>
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
                {n.label}
              </Link>
            ))}
            <Link
              href="/#start"
              onClick={() => setOpen(false)}
              className="mt-1 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand"
            >
              Start your farm
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
