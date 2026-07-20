/**
 * Field Window logomark.
 *
 * A window pane whose crossbar is the horizon: harvest-amber sun in the sky
 * above, tilled furrows receding to a vanishing point below. One glyph carries
 * the name ("window"), the function ("a weather window on your field") and the
 * palette (green frame, amber moment).
 */

export function LogoMark({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  // The vertical mullion only reads above ~24px; drop it when small.
  const showMullion = size >= 26;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="4"
        y="4"
        width="24"
        height="24"
        rx="7"
        fill="var(--surface-raised)"
        stroke="var(--brand)"
        strokeWidth="2"
      />
      {/* horizon */}
      <line x1="6.5" y1="19" x2="25.5" y2="19" stroke="var(--brand)" strokeWidth="2" />
      {showMullion && (
        <line x1="16" y1="6.5" x2="16" y2="19" stroke="var(--brand)" strokeWidth="1.5" opacity="0.55" />
      )}
      {/* furrows to the vanishing point */}
      <path
        d="M9,25.5 L15.4,19.5 M16,25.5 L16,19.5 M23,25.5 L16.6,19.5"
        stroke="var(--brand)"
        strokeWidth="1.5"
        opacity="0.85"
      />
      {/* the amber moment */}
      <circle cx="11" cy="12" r="3" fill="var(--amber)" />
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
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span
        className="font-display font-semibold tracking-tight text-foreground"
        style={{ fontSize: size * 0.66 }}
      >
        Field <span className="italic">Window</span>
      </span>
    </span>
  );
}
