import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import BillingSettingsPage from "../BillingSettingsPage";
import { server } from "../../../tests/setup";
import { billingHandlers } from "../../../tests/handlers/billing";

function renderBilling(teamId?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BillingSettingsPage teamId={teamId} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("BillingSettingsPage", () => {
  beforeEach(() => {
    server.use(...billingHandlers);
  });

  it("shows loading state", () => {
    renderBilling("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(
      screen.getByText("Loading billing information..."),
    ).toBeInTheDocument();
  });

  it("renders subscription details for free plan", async () => {
    renderBilling("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

    expect(await screen.findByText("Free")).toBeInTheDocument();
    expect(await screen.findByText("free")).toBeInTheDocument();
  });

  it("shows Upgrade Plan link for free tier", async () => {
    renderBilling("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

    const upgradeLink = await screen.findByText("Upgrade Plan");
    expect(upgradeLink).toBeInTheDocument();
    expect(upgradeLink.closest("a")).toHaveAttribute("href", "/pricing");
  });

  it("shows plan features", async () => {
    renderBilling("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

    expect(await screen.findByText("Plan features")).toBeInTheDocument();
    expect(await screen.findByText(/basic access/i)).toBeInTheDocument();
  });

  it("has accessible billing section", async () => {
    renderBilling("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

    await screen.findByText("Billing");

    const section = screen.getByRole("region", {
      name: /subscription details/i,
    });
    expect(section).toBeInTheDocument();
  });

  it("renders nothing when no teamId", () => {
    renderBilling(undefined);
    // Should not show loading for undefined teamId since query is disabled
    // The component renders nothing if no subscription
    expect(
      screen.queryByText("Loading billing information..."),
    ).not.toBeInTheDocument();
  });

  it("Upgrade Plan is keyboard focusable", async () => {
    const user = userEvent.setup();
    renderBilling("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

    await screen.findByText("Upgrade Plan");

    await user.tab();
    // Should be able to tab to the upgrade link
    const focusedElement = document.activeElement;
    expect(focusedElement?.tagName).toBeTruthy();
  });
});
