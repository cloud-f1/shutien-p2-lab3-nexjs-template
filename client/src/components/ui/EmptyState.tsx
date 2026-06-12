import type { ReactNode } from "react";
import { getActivePreset } from "./preset";

export interface EmptyStateProps {
  /** Optional large display code (e.g. `"404"`). */
  code?: ReactNode;
  /** Title — typically a short heading like "Not Found". */
  title: ReactNode;
  /** Subtitle / explanation text. */
  subtitle?: ReactNode;
  /** Optional CTA cluster (Link, Button, etc.). */
  cta?: ReactNode;
  /** Extra class merged onto the outer wrapper. */
  className?: string;
}

/**
 * Centered card with an optional display code, title, subtitle, and CTA.
 * Used for 404 pages and any "no data yet" empty state.
 */
export function EmptyState({
  code,
  title,
  subtitle,
  cta,
  className = "",
}: EmptyStateProps) {
  const p = getActivePreset().emptyState;

  return (
    <div className={[p.shell, className].join(" ").trim()}>
      <div className={p.card}>
        {code && <div className={p.code}>{code}</div>}
        <h1 className={p.title}>{title}</h1>
        {subtitle && <p className={p.subtitle}>{subtitle}</p>}
        {cta && <div className={p.actions}>{cta}</div>}
      </div>
    </div>
  );
}
