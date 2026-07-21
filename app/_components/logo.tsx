/**
 * Seasonwise logomark.
 *
 * Minimal: a sprout — two leaves on a stem — under a small amber sun. Growth
 * through the season, in the brand's green and amber. No container, three
 * shapes, legible from a favicon to a hero.
 */

export function LogoMark({
  size = 28,
  className = "",
  tone = "brand",
}: {
  size?: number;
  className?: string;
  /** "brand" = green sprout (default). "light" = cream sprout for use on a coloured band. */
  tone?: "brand" | "light";
}) {
  const sprout = tone === "light" ? "var(--on-brand)" : "var(--brand)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* sun */}
      <circle cx="16" cy="6.5" r="3" fill="var(--amber)" />
      {/* stem */}
      <path d="M16 29 V 15.5" stroke={sprout} strokeWidth="2.4" strokeLinecap="round" />
      {/* leaves */}
      <path d="M16 19c-2.6 1.4-6 .3-7.5-3 3.6-1 6.6.2 7.5 3Z" fill={sprout} />
      <path d="M16 15.5c2.6 1.4 6 .3 7.5-3-3.6-1-6.6.2-7.5 3Z" fill={sprout} />
    </svg>
  );
}

export function Logo({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      <span
        className="font-display font-semibold tracking-tight text-foreground"
        style={{ fontSize: size * 0.62 }}
      >
        Seasonwise
      </span>
    </span>
  );
}
