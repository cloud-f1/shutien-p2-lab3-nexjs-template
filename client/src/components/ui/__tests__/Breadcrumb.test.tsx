import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Breadcrumb } from "../Breadcrumb";

function renderCrumbs(items: { label: string; to?: string }[]) {
  return render(
    <MemoryRouter>
      <Breadcrumb items={items} />
    </MemoryRouter>,
  );
}

describe("Breadcrumb", () => {
  it("renders nothing when items are empty", () => {
    const { container } = renderCrumbs([]);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders linkable crumbs except the current page", () => {
    renderCrumbs([
      { label: "Dashboard", to: "/dashboard" },
      { label: "Settings", to: "/dashboard/settings" },
      { label: "Sessions" },
    ]);

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/dashboard/settings",
    );
    expect(screen.queryByRole("link", { name: "Sessions" })).toBeNull();
  });

  it("marks the last crumb with aria-current=page", () => {
    renderCrumbs([
      { label: "Dashboard", to: "/dashboard" },
      { label: "Sessions" },
    ]);

    const current = screen.getByText("Sessions");
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("uses a navigation landmark labelled Breadcrumb", () => {
    renderCrumbs([{ label: "Home" }]);
    expect(
      screen.getByRole("navigation", { name: /breadcrumb/i }),
    ).toBeInTheDocument();
  });
});
