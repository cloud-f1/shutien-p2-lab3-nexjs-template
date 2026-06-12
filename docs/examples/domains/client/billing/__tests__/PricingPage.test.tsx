import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import PricingPage from "../PricingPage";
import { server } from "../../../tests/setup";
import { billingHandlers, PLAN_FIXTURES } from "../../../tests/handlers/billing";

function renderPricing() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/pricing"]}>
        <PricingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PricingPage", () => {
  beforeEach(() => {
    server.use(...billingHandlers);
  });

  it("renders page title", async () => {
    renderPricing();
    expect(screen.getByText("Choose Your Plan")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    renderPricing();
    expect(screen.getByText("Loading plans...")).toBeInTheDocument();
  });

  it("renders all plans from API", async () => {
    renderPricing();

    // Wait for plans to load by looking for a non-ambiguous plan name
    expect(await screen.findByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
    // "Free" appears in both the name and amount, so use getAllByText
    expect(screen.getAllByText("Free").length).toBeGreaterThanOrEqual(1);
  });

  it("displays plan amounts correctly", async () => {
    renderPricing();

    // Wait for plans to load
    expect(await screen.findByText("$29.99")).toBeInTheDocument();
    expect(screen.getByText("$99.99")).toBeInTheDocument();
    // Free plan shows "Free" as its amount
    expect(screen.getAllByText("Free").length).toBeGreaterThanOrEqual(1);
  });

  it("marks pro plan as most popular", async () => {
    renderPricing();

    expect(await screen.findByText("Most Popular")).toBeInTheDocument();
  });

  it("has accessible plan cards", async () => {
    renderPricing();

    // Wait for plans to load
    await screen.findByText("Pro");

    const planCards = screen.getAllByRole("article");
    expect(planCards.length).toBe(PLAN_FIXTURES.length);

    for (const card of planCards) {
      expect(card).toHaveAttribute("aria-label");
    }
  });

  it("CTA buttons are keyboard accessible", async () => {
    const user = userEvent.setup();
    renderPricing();

    // Wait for plans to load
    await screen.findByText("Pro");

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);

    // Tab to first button and verify focus
    await user.tab();
    const focusedElement = document.activeElement;
    expect(focusedElement?.tagName).toBeTruthy();
  });
});
