import { forwardRef } from "react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { getActivePreset } from "./preset";

export interface NavItemProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  /** Internal route (uses react-router `<NavLink>`) or absolute href. */
  to: string;
  /** Optional leading icon (rendered as aria-hidden). */
  icon?: ReactNode;
  /** Visible label. */
  label: ReactNode;
  /** Optional trailing badge (typically a `<NavBadge>`). */
  badge?: ReactNode;
  /** When set, treats `to` as an external href (renders plain `<a>`). */
  external?: boolean;
  /** Force the active state — overrides router-derived match. */
  active?: boolean;
  /** Match the route exactly (default true — same as the legacy NavLink). */
  end?: boolean;
  /** Extra className appended to the active state. */
  className?: string;
  /** ARIA: explicit aria-current value when `active` is forced. */
  ariaCurrent?: AnchorHTMLAttributes<HTMLAnchorElement>["aria-current"];
}

/**
 * Generic nav-link row — icon + label + optional badge, with an
 * active state. Composes react-router `<NavLink>` for internal routes
 * and a plain `<a>` for external links.
 *
 * Visual classes ride on the Preset axis (`navItem` slot), but we
 * also stamp the legacy `nav-item` / `active` classes so existing
 * a11y / e2e selectors keep working.
 */
export const NavItem = forwardRef<HTMLAnchorElement, NavItemProps>(
  function NavItem(
    {
      to,
      icon,
      label,
      badge,
      external = false,
      active,
      end = true,
      className = "",
      ariaCurrent,
      ...rest
    },
    ref,
  ) {
    const p = getActivePreset().navItem;

    const renderInner = () => (
      <>
        {icon !== undefined && (
          <span className={`nav-icon ${p.icon}`} aria-hidden="true">
            {icon}
          </span>
        )}
        <span className={p.label}>{label}</span>
        {badge !== undefined && badge !== null && badge !== false && (
          <span className={p.badgeWrap}>{badge}</span>
        )}
      </>
    );

    if (external) {
      const isActive = !!active;
      return (
        <a
          {...rest}
          ref={ref}
          href={to}
          className={[
            "nav-item",
            p.base,
            isActive ? `active ${p.active}` : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          aria-current={ariaCurrent}
        >
          {renderInner()}
        </a>
      );
    }

    return (
      <NavLink
        {...rest}
        ref={ref}
        to={to}
        end={end}
        className={({ isActive }) => {
          const effectiveActive = active ?? isActive;
          return [
            "nav-item",
            p.base,
            effectiveActive ? `active ${p.active}` : "",
            className,
          ]
            .filter(Boolean)
            .join(" ");
        }}
        aria-current={
          ariaCurrent ??
          (active === true ? "page" : active === false ? undefined : undefined)
        }
      >
        {renderInner()}
      </NavLink>
    );
  },
);
