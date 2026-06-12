import type { ReactNode } from "react";
import { getActivePreset } from "./preset";

export interface HeroSectionProps {
  /** Small uppercase kicker rendered above the title. */
  eyebrow?: ReactNode;
  /** Hero title (h1). Accepts ReactNode for line breaks / `<em>` accents. */
  title: ReactNode;
  /** Subtitle paragraph below the title. */
  subtitle?: ReactNode;
  /** CTA cluster — typically one or two `<Button>`/`<Link>` nodes. */
  actions?: ReactNode;
  /** Optional decorative visual rendered below the actions (image, code card, …). */
  visual?: ReactNode;
  /** Optional id for in-page anchor navigation. */
  id?: string;
  /** Extra class on the outer `<section>`. */
  className?: string;
}

/**
 * Big-title + subtitle + CTA cluster + optional visual slot. Used as the
 * top-of-page hero on landing-style public pages.
 */
export function HeroSection({
  eyebrow,
  title,
  subtitle,
  actions,
  visual,
  id,
  className = "",
}: HeroSectionProps) {
  const p = getActivePreset().heroSection;

  return (
    <section id={id} className={[p.shell, className].join(" ").trim()}>
      <div className={p.inner}>
        {eyebrow && <div className={p.eyebrow}>{eyebrow}</div>}
        <h1 className={p.title}>{title}</h1>
        {subtitle && <p className={p.subtitle}>{subtitle}</p>}
        {actions && <div className={p.actions}>{actions}</div>}
        {visual && <div className={p.visualWrap}>{visual}</div>}
      </div>
    </section>
  );
}
