import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { NavItem } from "../ui/NavItem";
import { getNavSections, deriveActiveView } from "../../config/routeMap";

export interface SidebarProps {
  /** The pathname used to compute the active route. */
  pathname: string;
  /** Footer slot — typically `<UserMenu />`. */
  footer?: ReactNode;
}

/**
 * Dashboard left rail. Renders the logo + grouped nav sections + a
 * settings divider + a footer slot. Composes `<NavItem>` for each row.
 *
 * Keeps the legacy class names (`.sidebar`, `.sidebar-nav`,
 * `.nav-section-label`, etc.) so the existing CSS layout grid + the
 * `dashboard-smoke.spec.ts` selectors keep working.
 */
export function Sidebar({ pathname, footer }: SidebarProps) {
  const { t } = useTranslation("dashboard");
  const navSections = getNavSections();
  const activeView = deriveActiveView(pathname);

  return (
    <aside className="sidebar">
      <Link to="/" className="sidebar-logo">
        <div className="logo-mark" />
        <div>
          <div className="logo-text">AGENT TEMPLATE</div>
          <div className="logo-ver">v2.0.0</div>
        </div>
      </Link>

      <nav className="sidebar-nav" aria-label="Dashboard navigation">
        {navSections.map((section) => (
          <div key={section.section}>
            <div className="nav-section-label">
              {t(section.sectionLabelKey)}
            </div>
            {section.items.map((item) => (
              <NavItem
                key={item.id}
                to={`/dashboard/${item.path}`}
                icon={item.icon}
                label={t(item.labelKey, item.label)}
                badge={
                  item.badge ? (
                    <span
                      className={`nav-badge ${item.badgeClass || ""}`.trim()}
                    >
                      {item.badge}
                    </span>
                  ) : undefined
                }
              />
            ))}
          </div>
        ))}

        <div className="sidebar-divider" />
        <NavItem
          to="/dashboard/settings"
          icon={"⚙"}
          label={t("nav.settings")}
          active={activeView === "settings" ? true : undefined}
        />
        <NavItem
          to="/"
          icon={"↗"}
          label={t("nav.landingPage")}
          external
          target="_blank"
          rel="noopener"
        />
      </nav>

      {footer}
    </aside>
  );
}
