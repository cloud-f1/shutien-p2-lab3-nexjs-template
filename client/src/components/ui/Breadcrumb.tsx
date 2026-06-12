import { Fragment } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getActivePreset } from "./preset";

export interface Crumb {
  label: string;
  to?: string;
}

export interface BreadcrumbProps {
  items: Crumb[];
  className?: string;
}

export function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  if (items.length === 0) return null;
  const p = getActivePreset().breadcrumb;
  const { t } = useTranslation("primitives");

  return (
    <nav aria-label={t("breadcrumb.label")} className={[p.shell, className].join(" ")}>
      <ol className={p.list}>
        {items.map((crumb, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <Fragment key={`${crumb.label}-${idx}`}>
              <li className={p.item}>
                {crumb.to && !isLast ? (
                  <Link to={crumb.to} className={p.link}>
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? "page" : undefined}
                    className={isLast ? p.current : undefined}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
              {!isLast && (
                <li aria-hidden="true" className={p.separator}>
                  {p.separatorGlyph}
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
