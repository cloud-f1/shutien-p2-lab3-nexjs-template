import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { server } from "../../tests/setup";
import {
  portfolioHandlers,
  PORTFOLIO_FIXTURES,
} from "../../tests/handlers/portfolios";
import { placeHandlers } from "../../tests/handlers/places";
import PortfoliosPage from "./PortfoliosPage";

const BASE = "http://localhost:8080";

function renderPortfolios() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PortfoliosPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PortfoliosPage", () => {
  beforeEach(() => {
    server.use(...portfolioHandlers, ...placeHandlers);
  });

  it("renders portfolio list with formatted total_value", async () => {
    renderPortfolios();

    expect(await screen.findByText("Growth Portfolio")).toBeInTheDocument();
    expect(screen.getByText("Income Portfolio")).toBeInTheDocument();
    // total_value "1600000.00" should be formatted
    expect(screen.getByText("$1,600,000.00")).toBeInTheDocument();
  });

  it("shows empty state when API returns empty list", async () => {
    server.use(
      http.get(`${BASE}/portfolios`, () =>
        HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          page_size: 20,
          pages: 0,
        }),
      ),
    );

    renderPortfolios();

    expect(
      await screen.findByText("No portfolios yet"),
    ).toBeInTheDocument();
  });

  it("opens create form when Create Portfolio is clicked", async () => {
    const user = userEvent.setup();
    renderPortfolios();

    const createBtn = await screen.findByText("+ Create Portfolio");
    await user.click(createBtn);

    expect(screen.getByLabelText("Name *")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  it("shows portfolio detail with summary stats when card is clicked", async () => {
    const user = userEvent.setup();
    renderPortfolios();

    const card = await screen.findByText("Growth Portfolio");
    await user.click(card);

    // Wait for detail to load — should show analytics stats
    await waitFor(() => {
      expect(screen.getByText("Total Value")).toBeInTheDocument();
    });

    // Formatted monetary values from analytics
    expect(screen.getByText("$1,600,000.00")).toBeInTheDocument();
  });

  it("shows portfolio places table in detail view", async () => {
    const user = userEvent.setup();
    renderPortfolios();

    const card = await screen.findByText("Growth Portfolio");
    await user.click(card);

    // Wait for places manager to render
    await waitFor(() => {
      expect(
        screen.getByText("Places in Portfolio (1)"),
      ).toBeInTheDocument();
    });

    // Place name from PP_FIXTURE
    expect(screen.getByText("Test Place A")).toBeInTheDocument();
    // Formatted purchase price
    expect(screen.getByText("$1,000,000.00")).toBeInTheDocument();
  });

  it("shows gain/loss with correct styling class", async () => {
    const user = userEvent.setup();
    renderPortfolios();

    const card = await screen.findByText("Growth Portfolio");
    await user.click(card);

    // Wait for the places table
    await waitFor(() => {
      expect(screen.getByText("$200,000.00")).toBeInTheDocument();
    });

    // The gain_loss value should have gain-up class
    const gainCell = screen.getByText("$200,000.00");
    expect(gainCell.className).toContain("gain-up");
  });

  it("renders allocation chart SVG", async () => {
    const user = userEvent.setup();
    renderPortfolios();

    const card = await screen.findByText("Growth Portfolio");
    await user.click(card);

    // Wait for the chart title
    await waitFor(() => {
      expect(screen.getByText("Category Allocation")).toBeInTheDocument();
    });
  });

  it("renders performance chart section", async () => {
    const user = userEvent.setup();
    renderPortfolios();

    const card = await screen.findByText("Growth Portfolio");
    await user.click(card);

    await waitFor(() => {
      expect(screen.getByText("Top Performers")).toBeInTheDocument();
    });
  });

  it("creates a portfolio successfully", async () => {
    const user = userEvent.setup();
    renderPortfolios();

    const createBtn = await screen.findByText("+ Create Portfolio");
    await user.click(createBtn);

    await user.type(screen.getByLabelText("Name *"), "Test Portfolio");

    const submitBtn = screen.getByRole("button", {
      name: "Create Portfolio",
    });
    await user.click(submitBtn);

    // Should return to list after success
    await waitFor(() => {
      expect(screen.queryByLabelText("Name *")).not.toBeInTheDocument();
    });
  });

  it("shows loading state while fetching", () => {
    server.use(
      http.get(`${BASE}/portfolios`, async () => {
        await new Promise((r) => setTimeout(r, 100));
        return HttpResponse.json({
          items: PORTFOLIO_FIXTURES,
          total: 2,
          page: 1,
          page_size: 20,
          pages: 1,
        });
      }),
    );

    renderPortfolios();
    expect(screen.getByText("Loading portfolios...")).toBeInTheDocument();
  });

  it("shows error state on API failure", async () => {
    server.use(
      http.get(`${BASE}/portfolios`, () =>
        HttpResponse.json({ detail: "Server Error" }, { status: 500 }),
      ),
    );

    renderPortfolios();

    expect(
      await screen.findByText("Failed to load portfolios. Please try again."),
    ).toBeInTheDocument();
  });

  it("shows delete confirmation from detail view", async () => {
    const user = userEvent.setup();
    renderPortfolios();

    const card = await screen.findByText("Growth Portfolio");
    await user.click(card);

    await waitFor(() => {
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByText("Delete");
    await user.click(deleteBtn);

    expect(screen.getByText("Delete Portfolio")).toBeInTheDocument();
  });
});
