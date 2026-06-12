import type { ReactNode } from "react";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { useBreadcrumbs } from "./useBreadcrumbs";
import { getActivePreset } from "./preset";

export interface PageContainerProps {
  /** Small uppercase kicker rendered above the title. */
  eyebrow?: string;
  /** Page title — required. Renders as `<h1>` in the display font. */
  title: string;
  /** Single-line description shown beneath the title. */
  subtitle?: string;
  /**
   * Breadcrumb items. If omitted, derived from the current route via
   * `useBreadcrumbs()` (any path under `/dashboard`).
   */
  breadcrumbs?: Crumb[];
  /** Right-aligned action cluster (typically buttons). */
  actions?: ReactNode;
  /** Page content. Wrapped in a vertical stack with consistent gap. */
  children: ReactNode;
}

export function PageContainer({
  eyebrow,
  title,
  subtitle,
  breadcrumbs,
  actions,
  children,
}: PageContainerProps) {
  const derivedCrumbs = useBreadcrumbs();
  const crumbs = breadcrumbs ?? derivedCrumbs;
  const p = getActivePreset().pageContainer;

  return (
    <div className={p.shell}>
      {crumbs.length > 0 && (
        <Breadcrumb items={crumbs} className={p.breadcrumbWrap} />
      )}

      <header className={p.header}>
        <div className={p.titleColumn}>
          {eyebrow && <div className={p.eyebrow}>{eyebrow}</div>}
          <h1 className={p.title}>{title}</h1>
          {subtitle && <p className={p.subtitle}>{subtitle}</p>}
        </div>
        {actions && <div className={p.actionsWrap}>{actions}</div>}
      </header>

      <div className={p.body}>{children}</div>
    </div>
  );
}
