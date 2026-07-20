"use client";

import Link from "next/link";

export interface ChipItem {
  id: string;
  label: string;
  sublabel?: string;
}

/**
 * Location / crop selector rows.
 *
 * `asLinks` renders locations as real anchors to /s/[station] for the
 * server-rendered pages (crawlable, forwardable), or as buttons for the
 * client home view that swaps state in place.
 */
export function ChipRow({
  legend,
  items,
  activeId,
  onSelect,
  hrefFor,
}: {
  legend: string;
  items: ChipItem[];
  activeId: string;
  onSelect?: (id: string) => void;
  hrefFor?: (id: string) => string;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase tracking-wide text-muted">
        {legend}
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => {
          const active = item.id === activeId;
          const cls = `min-h-[44px] inline-flex items-center cursor-pointer rounded-full border px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
            active
              ? "border-transparent bg-foreground text-background"
              : "border-border bg-surface hover:bg-surface-muted"
          }`;
          const inner = (
            <>
              {item.label}
              {item.sublabel && (
                <span className="ml-1.5 text-xs opacity-60">{item.sublabel}</span>
              )}
            </>
          );
          if (hrefFor) {
            return (
              <Link
                key={item.id}
                href={hrefFor(item.id)}
                aria-current={active ? "page" : undefined}
                className={cls}
              >
                {inner}
              </Link>
            );
          }
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect?.(item.id)}
              aria-pressed={active}
              className={cls}
            >
              {inner}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
