import { describe, it, expect } from "vitest";
import {
  ROUTE_MAP,
  VIEW_ORDER,
  SECTION_LABELS,
  deriveActiveView,
  getNavSections,
} from "../routeMap";

describe("ROUTE_MAP", () => {
  it("has an entry for every VIEW_ORDER id", () => {
    for (const id of VIEW_ORDER) {
      expect(ROUTE_MAP[id]).toBeDefined();
      expect(ROUTE_MAP[id].path).toBeTruthy();
      expect(ROUTE_MAP[id].label).toBeTruthy();
      expect(ROUTE_MAP[id].icon).toBeTruthy();
      expect(ROUTE_MAP[id].section).toBeTruthy();
      expect(ROUTE_MAP[id].component).toBeDefined();
    }
  });

  it("contains all 9 dashboard views", () => {
    expect(VIEW_ORDER).toHaveLength(9);
    expect(VIEW_ORDER).toContain("overview");
    expect(VIEW_ORDER).toContain("projects");
    expect(VIEW_ORDER).toContain("memory");
    expect(VIEW_ORDER).toContain("activity");
    expect(VIEW_ORDER).toContain("promote");
    expect(VIEW_ORDER).toContain("commands");
    expect(VIEW_ORDER).toContain("health");
    expect(VIEW_ORDER).toContain("sessions");
    expect(VIEW_ORDER).toContain("settings");
  });

  it("has unique paths for all entries", () => {
    const paths = VIEW_ORDER.map((id) => ROUTE_MAP[id].path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("has unique labels for all entries", () => {
    const labels = VIEW_ORDER.map((id) => ROUTE_MAP[id].label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("assigns every non-footer entry to a section with a label", () => {
    for (const id of VIEW_ORDER) {
      const entry = ROUTE_MAP[id];
      if (entry.section !== "footer") {
        expect(SECTION_LABELS[entry.section]).toBeDefined();
      }
    }
  });
});

describe("deriveActiveView", () => {
  it("returns overview for /dashboard", () => {
    expect(deriveActiveView("/dashboard")).toBe("overview");
  });

  it("returns overview for /dashboard/", () => {
    expect(deriveActiveView("/dashboard/")).toBe("overview");
  });

  it("returns health for /dashboard/health", () => {
    expect(deriveActiveView("/dashboard/health")).toBe("health");
  });

  it("returns settings for /dashboard/settings", () => {
    expect(deriveActiveView("/dashboard/settings")).toBe("settings");
  });

  it("returns overview for unknown segments", () => {
    expect(deriveActiveView("/dashboard/nonexistent")).toBe("overview");
  });

  it("derives correctly for every ROUTE_MAP entry", () => {
    for (const id of VIEW_ORDER) {
      const entry = ROUTE_MAP[id];
      expect(deriveActiveView(`/dashboard/${entry.path}`)).toBe(id);
    }
  });
});

describe("getNavSections", () => {
  it("returns 3 sections (workspace, intelligence, tools)", () => {
    const sections = getNavSections();
    expect(sections).toHaveLength(3);
    expect(sections.map((s) => s.section)).toEqual([
      "workspace",
      "intelligence",
      "tools",
    ]);
  });

  it("excludes footer items from nav sections", () => {
    const sections = getNavSections();
    const allItems = sections.flatMap((s) => s.items);
    const footerItems = allItems.filter((item) => item.section === "footer");
    expect(footerItems).toHaveLength(0);
  });

  it("includes all non-footer views in nav sections", () => {
    const sections = getNavSections();
    const allIds = sections.flatMap((s) => s.items.map((i) => i.id));
    const nonFooterIds = VIEW_ORDER.filter(
      (id) => ROUTE_MAP[id].section !== "footer",
    );
    expect(allIds).toEqual(nonFooterIds);
  });
});
