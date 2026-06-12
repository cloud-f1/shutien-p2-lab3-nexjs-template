/**
 * DashboardPage — Legacy entry point.
 *
 * After E112 (ROUTE_MAP), the dashboard uses nested layout routes:
 *   - DashboardLayout (layout route with <Outlet />)
 *   - Individual view components in ./views/
 *   - Routes generated from config/routeMap.ts
 *
 * This file is kept for backward compatibility with tests.
 * In production, App.tsx renders DashboardLayout directly as the layout route.
 */
import { Navigate } from "react-router-dom";

export default function DashboardPage() {
  return <Navigate to="/dashboard/overview" replace />;
}
