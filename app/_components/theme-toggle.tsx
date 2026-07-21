"use client";

import { useEffect, useState } from "react";

const KEY = "seasonwise.theme";
type Theme = "light" | "dark";

/**
 * Light/dark toggle. An explicit choice is stored and stamped on <html> as
 * data-theme, which overrides the system preference in globals.css. With no
 * stored choice the app follows the system, so the toggle is opt-in.
 *
 * The no-flash init lives in a tiny inline script in the layout; this only
 * handles the interactive flip.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = (localStorage.getItem(KEY) as Theme | null) ?? null;
    if (stored) {
      setTheme(stored);
    } else {
      setTheme(
        window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
      );
    }
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode */
    }
    document.documentElement.dataset.theme = next;
  }

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-surface-muted ${className}`}
    >
      <span aria-hidden="true">{isDark ? "☀" : "☾"}</span>
    </button>
  );
}
