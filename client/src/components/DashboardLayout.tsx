import { Suspense } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ROUTE_MAP, deriveActiveView } from "../config/routeMap";
import Seo from "./Seo";
import { Sidebar } from "./dashboard/Sidebar";
import { TopBar } from "./dashboard/TopBar";
import { UserMenu } from "./dashboard/UserMenu";
import "./DashboardLayout.css";

/**
 * Dashboard chrome — sidebar + topbar + content shell.
 *
 * After E175 this component is a thin composition over the
 * `<Sidebar>`, `<TopBar>`, and `<UserMenu>` sub-components in
 * `components/dashboard/`. Layout grid + sidebar/topbar chrome
 * styling still lives in `DashboardLayout.css`. Visual styling for
 * the new ui-primitives (`<NavItem>`, `<DropdownMenu>`) lives in
 * the Preset axis (`components/ui/preset.ts`).
 */
export default function DashboardLayout() {
  const { t } = useTranslation("dashboard");
  const location = useLocation();
  const navigate = useNavigate();

  const activeView = deriveActiveView(location.pathname);
  const activeEntry = ROUTE_MAP[activeView];

  return (
    <>
      <Seo
        title="Dashboard"
        description="Your investment dashboard"
        path="/dashboard"
      />
      <div className="dashboard">
        <Sidebar pathname={location.pathname} footer={<UserMenu />} />

        <main className="main" id="main-content">
          <TopBar
            breadcrumbs={
              <>
                <span>{t("nav.overview")}</span>
                <span className="topbar-sep"> / </span>
                <span className="topbar-crumb-active">
                  {t(activeEntry.labelKey, activeEntry.label)}
                </span>
              </>
            }
            actions={
              <>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--gray)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span className="status-dot green" /> {t("topbar.allSystems")}
                </span>
                <button
                  type="button"
                  className="topbar-btn outline"
                  onClick={() => navigate("/dashboard/promote")}
                >
                  {"↑"} {t("topbar.promote")} (5)
                </button>
                <button
                  type="button"
                  className="topbar-btn primary"
                  onClick={() => navigate("/dashboard/projects")}
                >
                  {t("topbar.newProject")}
                </button>
              </>
            }
          />

          <div className="content">
            <Suspense fallback={<div className="view-enter" />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </>
  );
}
