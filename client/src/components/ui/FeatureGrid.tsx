import type { ReactNode } from "react";
import { getActivePreset } from "./preset";

export interface FeatureCardProps {
  /** Optional small uppercase label rendered above the title. */
  label?: ReactNode;
  /** Card title. */
  title: ReactNode;
  /** Card body / description. */
  description?: ReactNode;
  /** Optional content slot (e.g. icon, mini-stat) rendered below description. */
  children?: ReactNode;
}

/**
 * Single feature card — composes inside `<FeatureGrid>`. Visual classes
 * are preset-driven via `featureGrid.card{,Label,Title,Desc}`.
 */
export function FeatureCard({
  label,
  title,
  description,
  children,
}: FeatureCardProps) {
  const p = getActivePreset().featureGrid;

  return (
    <div className={p.card}>
      {label && <div className={p.cardLabel}>{label}</div>}
      <div className={p.cardTitle}>{title}</div>
      {description && <div className={p.cardDesc}>{description}</div>}
      {children}
    </div>
  );
}

export interface FeatureGridProps {
  /** Grid children — typically `<FeatureCard>` nodes. */
  children: ReactNode;
  /** Optional id for in-page anchor navigation. */
  id?: string;
  /** Extra class on the outer container. */
  className?: string;
}

/**
 * Responsive grid of `<FeatureCard>` children. Defaults to 1/2/3 columns
 * via the preset, but the inner content slot is unopinionated.
 */
export function FeatureGrid({ children, id, className = "" }: FeatureGridProps) {
  const p = getActivePreset().featureGrid;

  return (
    <div id={id} className={[p.shell, className].join(" ").trim()}>
      <div className={p.grid}>{children}</div>
    </div>
  );
}
