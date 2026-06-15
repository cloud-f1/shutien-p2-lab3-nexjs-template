/**
 * Brand mark for AI App Template — a layered "stack" chevron on the primary tile.
 * Theme-aware: fills use the design tokens (var(--primary) / var(--primary-foreground)),
 * so it adapts to light/dark automatically. The static favicon lives at app/icon.svg.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="AI App Template"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="7" style={{ fill: "var(--primary)" }} />
      <path
        d="M9 14.5 L16 9.5 L23 14.5"
        fill="none"
        style={{ stroke: "var(--primary-foreground)" }}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 20 L16 15 L23 20"
        fill="none"
        style={{ stroke: "var(--primary-foreground)" }}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
    </svg>
  )
}
