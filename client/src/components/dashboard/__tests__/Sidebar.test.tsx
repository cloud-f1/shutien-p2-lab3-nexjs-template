import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, afterEach } from "vitest";
import { Sidebar } from "../Sidebar";
import { resetActivePreset } from "../../ui/preset";

afterEach(() => resetActivePreset());

describe("Sidebar", () => {
  it("renders the dashboard nav with the legacy aria-label", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/overview"]}>
        <Sidebar pathname="/dashboard/overview" />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("navigation", { name: "Dashboard navigation" }),
    ).toBeInTheDocument();
  });

  it("renders the section labels (workspace / intelligence / tools)", () => {
    render(
      <MemoryRouter>
        <Sidebar pathname="/dashboard/overview" />
      </MemoryRouter>,
    );
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Tools")).toBeInTheDocument();
  });

  it("renders nav-item links with the legacy class for e2e selectors", () => {
    const { container } = render(
      <MemoryRouter>
        <Sidebar pathname="/dashboard/overview" />
      </MemoryRouter>,
    );
    const navItems = container.querySelectorAll(".nav-item");
    expect(navItems.length).toBeGreaterThanOrEqual(4);
  });

  it("renders a footer slot", () => {
    render(
      <MemoryRouter>
        <Sidebar
          pathname="/dashboard/overview"
          footer={<div data-testid="user-footer">user</div>}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("user-footer")).toBeInTheDocument();
  });

  it("renders nav-icon spans with aria-hidden", () => {
    const { container } = render(
      <MemoryRouter>
        <Sidebar pathname="/dashboard/overview" />
      </MemoryRouter>,
    );
    const icons = container.querySelectorAll(
      ".sidebar-nav [aria-hidden='true']",
    );
    expect(icons.length).toBeGreaterThan(0);
  });
});
