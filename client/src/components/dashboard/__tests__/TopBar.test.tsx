import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TopBar } from "../TopBar";

describe("TopBar", () => {
  it("renders breadcrumbs and actions in the correct slots", () => {
    render(
      <TopBar
        breadcrumbs={<span data-testid="bc">Overview / Sessions</span>}
        actions={<button type="button">New</button>}
      />,
    );
    expect(screen.getByTestId("bc")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /new/i }),
    ).toBeInTheDocument();
  });

  it("preserves role=banner for a11y landmark detection", () => {
    render(<TopBar breadcrumbs={<span>x</span>} />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("renders an optional userMenu slot alongside actions", () => {
    render(
      <TopBar
        breadcrumbs={<span>x</span>}
        actions={<button type="button">A</button>}
        userMenu={<div data-testid="um">user</div>}
      />,
    );
    expect(screen.getByTestId("um")).toBeInTheDocument();
  });

  it("keeps the legacy topbar/topbar-left/topbar-right classes for CSS layout", () => {
    const { container } = render(
      <TopBar breadcrumbs={<span>x</span>} actions={<span>y</span>} />,
    );
    expect(container.querySelector(".topbar")).toBeInTheDocument();
    expect(container.querySelector(".topbar-left")).toBeInTheDocument();
    expect(container.querySelector(".topbar-right")).toBeInTheDocument();
  });
});
