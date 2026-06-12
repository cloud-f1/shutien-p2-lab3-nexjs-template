import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ROUTE_MAP, deriveActiveView } from "../../config/routeMap";
import type { Crumb } from "./Breadcrumb";

/**
 * Derive breadcrumbs for any path under `/dashboard` from `routeMap.ts`.
 * Returns `[{ label: "Dashboard", to: "/dashboard" }, { label: <view> }]`.
 * Falls back to a single "Dashboard" crumb if the route isn't recognized.
 */
export function useBreadcrumbs(): Crumb[] {
  const location = useLocation();
  const { t } = useTranslation("dashboard");

  const root: Crumb = {
    label: t("nav.dashboard", "Dashboard"),
    to: "/dashboard",
  };

  if (!location.pathname.startsWith("/dashboard")) {
    return [];
  }

  const view = deriveActiveView(location.pathname);
  const entry = ROUTE_MAP[view];
  if (!entry) return [root];

  const viewLabel = t(entry.labelKey, entry.label);

  // Don't duplicate "Dashboard" → "Overview" when overview is the root view.
  if (
    location.pathname === "/dashboard" ||
    location.pathname === "/dashboard/"
  ) {
    return [root];
  }

  return [root, { label: viewLabel }];
}
