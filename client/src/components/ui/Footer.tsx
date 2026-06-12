import type { ReactNode } from "react";
import { getActivePreset } from "./preset";

export interface FooterLink {
  label: ReactNode;
  href: string;
  /** Optional render override for the link (e.g. react-router `<Link>`). */
  render?: (className: string) => ReactNode;
}

export interface FooterProps {
  /** Brand line — e.g. "Claude Agent Template · Built by". */
  brand?: ReactNode;
  /** Optional handle/highlight (e.g. `@alexhsieh`) styled distinctly. */
  brandHandle?: ReactNode;
  /** Right-aligned links list. */
  links?: FooterLink[];
  /** Accessible role override; defaults to `contentinfo`. */
  role?: string;
}

/**
 * Site footer for public pages. Renders brand text + optional handle on
 * the left and a links list on the right. Visual classes are preset-driven.
 */
export function Footer({
  brand,
  brandHandle,
  links = [],
  role = "contentinfo",
}: FooterProps) {
  const p = getActivePreset().footer;

  return (
    <footer className={p.shell} role={role}>
      <div className={p.inner}>
        {(brand || brandHandle) && (
          <div className={p.brand}>
            {brand}
            {brandHandle && (
              <>
                {" "}
                <span className={p.brandHandle}>{brandHandle}</span>
              </>
            )}
          </div>
        )}
        {links.length > 0 && (
          <ul className={p.links}>
            {links.map((link, i) => (
              <li key={i}>
                {link.render ? (
                  link.render(p.link)
                ) : (
                  <a href={link.href} className={p.link}>
                    {link.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </footer>
  );
}
