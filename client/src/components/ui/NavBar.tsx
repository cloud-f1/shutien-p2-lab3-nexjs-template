import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { getActivePreset } from "./preset";

export interface NavBarLink {
  /** Visible label for the link. */
  label: ReactNode;
  /** Anchor href (e.g. `#features`) or absolute path (e.g. `/getting-started`). */
  href: string;
  /** Render as a primary CTA button instead of a plain link. */
  cta?: boolean;
  /** Optional override for the rendered element (e.g. a `<Link>` from react-router). */
  render?: (className: string) => ReactNode;
}

export interface NavBarProps {
  /** Brand mark / logo node — typically the project's `<LogoMark />`. */
  brand?: ReactNode;
  /** Brand text shown alongside the logo. */
  brandText?: ReactNode;
  /** Brand link destination. Defaults to `/`. */
  brandHref?: string;
  /** Optional render override for the brand link (e.g. react-router `<Link>`). */
  brandRender?: (className: string) => ReactNode;
  /** Right-aligned link list. CTAs render with the cta variant. */
  links?: NavBarLink[];
  /** Accessible label for the `<nav>`. Defaults to the translated
   * `navBar.label` key (`"Main navigation"` in EN, `"主要導覽"` in zh-TW). */
  ariaLabel?: string;
}

/**
 * Top navigation bar for public pages. Distinct from the dashboard
 * sidebar — this is the marketing/static-page chrome.
 */
export function NavBar({
  brand,
  brandText,
  brandHref = "/",
  brandRender,
  links = [],
  ariaLabel,
}: NavBarProps) {
  const p = getActivePreset().navBar;
  const { t } = useTranslation("primitives");
  const resolvedLabel = ariaLabel ?? t("navBar.label");

  const brandInner = (
    <>
      {brand}
      {brandText && <span className={p.logoText}>{brandText}</span>}
    </>
  );

  return (
    <nav className={p.shell} aria-label={resolvedLabel}>
      <div className={p.inner}>
        {brandRender ? (
          brandRender(p.logo)
        ) : (
          <a href={brandHref} className={p.logo}>
            {brandInner}
          </a>
        )}
        {links.length > 0 && (
          <ul className={p.links}>
            {links.map((link, i) => {
              const cls = link.cta ? p.cta : p.link;
              return (
                <li key={i}>
                  {link.render ? (
                    link.render(cls)
                  ) : (
                    <a href={link.href} className={cls}>
                      {link.label}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </nav>
  );
}
