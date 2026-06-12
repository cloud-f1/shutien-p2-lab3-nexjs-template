import { lazy } from "react";
import type { LazyExoticComponent, ComponentType } from "react";

export interface RouteEntry {
  /** URL segment under /dashboard/ */
  path: string;
  /** i18n key for nav label (dashboard namespace) */
  labelKey: string;
  /** Fallback label when i18n is unavailable */
  label: string;
  /** Icon character displayed in sidebar */
  icon: string;
  /** Section grouping — "workspace" | "intelligence" | "tools" | "footer" */
  section: "workspace" | "intelligence" | "tools" | "footer";
  /** Optional badge text */
  badge?: string;
  /** Optional badge CSS class */
  badgeClass?: string;
  /** Lazy-loaded view component */
  component: LazyExoticComponent<ComponentType<unknown>>;
}

/**
 * ROUTE_MAP — Single source of truth for dashboard navigation and routing.
 *
 * To add a new view:
 *   1. Create the component in pages/dashboard/views/
 *   2. Add an entry here
 *   3. Done — routes + nav are auto-generated
 */
export const ROUTE_MAP: Record<string, RouteEntry> = {
  overview: {
    path: "overview",
    labelKey: "nav.overview",
    label: "Overview",
    icon: "\u2B21",
    section: "workspace",
    component: lazy(() => import("../pages/dashboard/views/OverviewView")),
  },
  projects: {
    path: "projects",
    labelKey: "nav.projects",
    label: "Projects",
    icon: "\u25EB",
    section: "workspace",
    badge: "3",
    component: lazy(() => import("../pages/dashboard/views/ProjectsView")),
  },
  memory: {
    path: "memory",
    labelKey: "nav.memoryHub",
    label: "Memory Hub",
    icon: "\u25C8",
    section: "intelligence",
    badge: "24",
    badgeClass: "purple",
    component: lazy(() => import("../pages/dashboard/views/MemoryHubView")),
  },
  activity: {
    path: "activity",
    labelKey: "nav.agentActivity",
    label: "Agent Activity",
    icon: "\u25CE",
    section: "intelligence",
    component: lazy(
      () => import("../pages/dashboard/views/AgentActivityView"),
    ),
  },
  promote: {
    path: "promote",
    labelKey: "nav.promoteQueue",
    label: "Promote Queue",
    icon: "\u2191",
    section: "intelligence",
    badge: "5",
    badgeClass: "green",
    component: lazy(
      () => import("../pages/dashboard/views/PromoteQueueView"),
    ),
  },
  commands: {
    path: "commands",
    labelKey: "nav.slashCommands",
    label: "Slash Commands",
    icon: "/",
    section: "tools",
    component: lazy(() => import("../pages/dashboard/views/CommandsView")),
  },
  health: {
    path: "health",
    labelKey: "nav.systemHealth",
    label: "System Health",
    icon: "\u2665",
    section: "tools",
    component: lazy(
      () => import("../pages/dashboard/views/SystemHealthView"),
    ),
  },
  sessions: {
    path: "sessions",
    labelKey: "nav.securitySessions",
    label: "Security \u00b7 Sessions",
    icon: "\u26bf",
    section: "tools",
    component: lazy(
      () => import("../pages/dashboard/views/SecuritySessionsView"),
    ),
  },
  settings: {
    path: "settings",
    labelKey: "nav.settings",
    label: "Settings",
    icon: "\u2699",
    section: "footer",
    component: lazy(() => import("../pages/dashboard/views/SettingsView")),
  },
};

/** Ordered view IDs for consistent iteration */
export const VIEW_ORDER = [
  "overview",
  "projects",
  "memory",
  "activity",
  "promote",
  "commands",
  "health",
  "sessions",
  "settings",
] as const;

export type ViewId = (typeof VIEW_ORDER)[number];

/** Section display names (i18n keys) */
export const SECTION_LABELS: Record<string, string> = {
  workspace: "nav.workspace",
  intelligence: "nav.intelligence",
  tools: "nav.tools",
};

/** Derive the active view ID from the current pathname */
export function deriveActiveView(pathname: string): ViewId {
  const segment = pathname.split("/").filter(Boolean)[1]; // /dashboard/{segment}
  if (segment && segment in ROUTE_MAP) {
    return segment as ViewId;
  }
  return "overview";
}

/** Get entries grouped by section (excludes footer) */
export function getNavSections(): {
  section: string;
  sectionLabelKey: string;
  items: (RouteEntry & { id: string })[];
}[] {
  const sections = ["workspace", "intelligence", "tools"] as const;
  return sections.map((section) => ({
    section,
    sectionLabelKey: SECTION_LABELS[section],
    items: VIEW_ORDER.filter((id) => ROUTE_MAP[id].section === section).map(
      (id) => ({ id, ...ROUTE_MAP[id] }),
    ),
  }));
}
