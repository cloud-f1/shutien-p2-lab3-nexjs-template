import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { PageContainer } from "../PageContainer";

function renderPage(ui: React.ReactNode, route = "/dashboard/settings") {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}

describe("PageContainer", () => {
  it("renders eyebrow, title, subtitle, and children", () => {
    renderPage(
      <PageContainer
        eyebrow="Account"
        title="Settings"
        subtitle="Manage your account."
        breadcrumbs={[]}
      >
        <div data-testid="page-body">body</div>
      </PageContainer>,
    );

    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Manage your account.")).toBeInTheDocument();
    expect(screen.getByTestId("page-body")).toBeInTheDocument();
  });

  it("renders provided breadcrumbs", () => {
    renderPage(
      <PageContainer
        title="Sessions"
        breadcrumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Sessions" },
        ]}
      >
        <span />
      </PageContainer>,
    );

    expect(
      screen.getByRole("navigation", { name: /breadcrumb/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  it("renders actions slot", () => {
    renderPage(
      <PageContainer
        title="Projects"
        breadcrumbs={[]}
        actions={<button>New</button>}
      >
        <span />
      </PageContainer>,
    );
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });
});
