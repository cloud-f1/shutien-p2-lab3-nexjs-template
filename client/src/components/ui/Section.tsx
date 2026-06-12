import type { ReactNode } from "react";
import { getActivePreset } from "./preset";

export interface SectionProps {
  /** Optional small uppercase label rendered above the title. */
  label?: ReactNode;
  /** Optional section title. Renders as `<h2>` when provided. */
  title?: ReactNode;
  /** Optional lede paragraph below the title. */
  lede?: ReactNode;
  /** Section body content. */
  children: ReactNode;
  /** Optional id for in-page anchor navigation. */
  id?: string;
  /** Extra class on the outer `<section>`. */
  className?: string;
  /** Accessible label for the `<section>` (when no visible title). */
  ariaLabel?: string;
}

/**
 * Generic content section with an optional label, title, and lede above
 * a children body slot. Used for "How it works", "Stack", "Theme preview"
 * — anything between the hero and CTA on a public page.
 */
export function Section({
  label,
  title,
  lede,
  children,
  id,
  className = "",
  ariaLabel,
}: SectionProps) {
  const p = getActivePreset().section;

  return (
    <section
      id={id}
      aria-label={ariaLabel}
      className={[p.shell, className].join(" ").trim()}
    >
      <div className={p.inner}>
        {label && <div className={p.label}>{label}</div>}
        {title && <h2 className={p.title}>{title}</h2>}
        {lede && <p className={p.lede}>{lede}</p>}
        <div className={p.body}>{children}</div>
      </div>
    </section>
  );
}
