import type { ReactNode } from "react";
import { getActivePreset } from "./preset";

export interface CTABannerProps {
  /** Optional small uppercase kicker rendered above the title. */
  eyebrow?: ReactNode;
  /** Banner title — typically a short call-to-action question. */
  title: ReactNode;
  /** Optional subtitle paragraph. */
  subtitle?: ReactNode;
  /** CTA button cluster. */
  actions?: ReactNode;
  /** Optional small note rendered below the actions. */
  note?: ReactNode;
  /** Optional id for in-page anchor navigation. */
  id?: string;
  /** Extra class on the outer `<section>`. */
  className?: string;
}

/**
 * Bottom-of-page "Ready to start?" call-to-action band. Used as the
 * closing block on landing/marketing pages.
 */
export function CTABanner({
  eyebrow,
  title,
  subtitle,
  actions,
  note,
  id,
  className = "",
}: CTABannerProps) {
  const p = getActivePreset().ctaBanner;

  return (
    <section id={id} className={[p.shell, className].join(" ").trim()}>
      <div className={p.inner}>
        {eyebrow && <div className={p.eyebrow}>{eyebrow}</div>}
        <h2 className={p.title}>{title}</h2>
        {subtitle && <p className={p.subtitle}>{subtitle}</p>}
        {actions && <div className={p.actions}>{actions}</div>}
        {note && <div className={p.note}>{note}</div>}
      </div>
    </section>
  );
}
