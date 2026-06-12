import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useBreadcrumbs } from "../useBreadcrumbs";

function wrap(route: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>;
  };
}

describe("useBreadcrumbs", () => {
  it("returns an empty list outside /dashboard", () => {
    const { result } = renderHook(() => useBreadcrumbs(), {
      wrapper: wrap("/getting-started"),
    });
    expect(result.current).toEqual([]);
  });

  it("returns just the Dashboard root when on /dashboard root", () => {
    const { result } = renderHook(() => useBreadcrumbs(), {
      wrapper: wrap("/dashboard"),
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0].label).toBeTruthy();
    expect(result.current[0].to).toBe("/dashboard");
  });

  it("returns Dashboard + view label for a known sub-route", () => {
    const { result } = renderHook(() => useBreadcrumbs(), {
      wrapper: wrap("/dashboard/sessions"),
    });
    expect(result.current).toHaveLength(2);
    expect(result.current[0].to).toBe("/dashboard");
    // Last crumb has no `to` (it's the current page)
    expect(result.current[1].to).toBeUndefined();
    expect(result.current[1].label).toBeTruthy();
  });

  it("falls back to overview for an unknown sub-route", () => {
    const { result } = renderHook(() => useBreadcrumbs(), {
      wrapper: wrap("/dashboard/this-route-does-not-exist"),
    });
    // Unknown segments fall through to "overview" via deriveActiveView,
    // which still renders 2 crumbs (root + view label).
    expect(result.current).toHaveLength(2);
  });
});
