import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, afterEach } from "vitest";
import { NavItem } from "../NavItem";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

function renderInRouter(
  ui: React.ReactNode,
  initialPath = "/dashboard/overview",
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={ui} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("NavItem", () => {
  it("renders icon, label, and badge", () => {
    renderInRouter(
      <NavItem
        to="/dashboard/projects"
        icon="◈"
        label="Projects"
        badge={<span data-testid="b">3</span>}
      />,
    );
    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByText("◈")).toBeInTheDocument();
    expect(screen.getByTestId("b")).toBeInTheDocument();
  });

  it("marks the icon as aria-hidden", () => {
    renderInRouter(
      <NavItem to="/dashboard/projects" icon="◈" label="Projects" />,
    );
    const icon = screen.getByText("◈");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("preserves the legacy nav-item class for e2e selectors", () => {
    renderInRouter(<NavItem to="/dashboard/projects" label="Projects" />);
    const link = screen.getByRole("link", { name: /projects/i });
    expect(link.className).toMatch(/\bnav-item\b/);
  });

  it("applies active class when active prop is forced", () => {
    renderInRouter(
      <NavItem to="/dashboard/projects" label="Projects" active />,
    );
    const link = screen.getByRole("link", { name: /projects/i });
    expect(link.className).toMatch(/\bactive\b/);
  });

  it("derives active state + aria-current=page from the route via NavLink", () => {
    renderInRouter(
      <NavItem to="/dashboard/overview" label="Overview" />,
      "/dashboard/overview",
    );
    const link = screen.getByRole("link", { name: /overview/i });
    expect(link.className).toMatch(/\bactive\b/);
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("renders an external <a> when external=true", () => {
    renderInRouter(
      <NavItem to="https://example.com" label="External" external />,
    );
    const link = screen.getByRole("link", { name: /external/i });
    expect(link).toHaveAttribute("href", "https://example.com");
  });

  it("does not render badge wrapper when badge is omitted", () => {
    const { container } = renderInRouter(
      <NavItem to="/dashboard/x" label="X" />,
    );
    // badgeWrap has class ml-auto in default preset; no badge → no wrapper.
    expect(container.querySelector(".ml-auto")).toBeNull();
  });
});
