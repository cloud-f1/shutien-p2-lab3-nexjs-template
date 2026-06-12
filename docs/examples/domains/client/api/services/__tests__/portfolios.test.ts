import { describe, it, expect, beforeEach } from "vitest";
import { server } from "../../../tests/setup";
import {
  portfolioHandlers,
  PORTFOLIO_FIXTURES,
} from "../../../tests/handlers/portfolios";
import {
  portfoliosService,
  portfolioPlacesApi,
  getPortfolioAnalytics,
} from "../portfolios";

describe("portfoliosService", () => {
  beforeEach(() => {
    server.use(...portfolioHandlers);
  });

  it("list() returns paginated portfolios", async () => {
    const result = await portfoliosService.list({ page: 1, page_size: 20 });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.items[0].name).toBe("Growth Portfolio");
  });

  it("getById() returns a single portfolio", async () => {
    const portfolio = await portfoliosService.getById(PORTFOLIO_FIXTURES[0].id);
    expect(portfolio.name).toBe("Growth Portfolio");
    expect(portfolio.place_count).toBe(2);
    expect(portfolio.total_value).toBe("1600000.00");
  });

  it("create() sends data and returns parsed portfolio", async () => {
    const newPortfolio = await portfoliosService.create({
      name: "New Portfolio",
      description: "Test",
    });
    expect(newPortfolio.name).toBe("New Portfolio");
    expect(newPortfolio.id).toBeDefined();
    expect(newPortfolio.place_count).toBe(0);
  });

  it("update() sends patch and returns updated portfolio", async () => {
    const updated = await portfoliosService.update(PORTFOLIO_FIXTURES[0].id, {
      name: "Renamed",
    });
    expect(updated.name).toBe("Renamed");
    expect(updated.place_count).toBe(2); // unchanged from fixture
  });

  it("remove() calls DELETE", async () => {
    await expect(
      portfoliosService.remove(PORTFOLIO_FIXTURES[0].id),
    ).resolves.toBeUndefined();
  });
});

describe("portfolioPlacesApi", () => {
  beforeEach(() => {
    server.use(...portfolioHandlers);
  });

  it("list() returns portfolio places", async () => {
    const places = await portfolioPlacesApi.list(PORTFOLIO_FIXTURES[0].id);
    expect(places).toHaveLength(1);
    expect(places[0].purchase_price).toBe("1000000.00");
    expect(places[0].place.name).toBe("Test Place A");
  });

  it("add() creates a portfolio place membership", async () => {
    const pp = await portfolioPlacesApi.add(PORTFOLIO_FIXTURES[0].id, {
      place_id: "11111111-1111-1111-1111-111111111111",
      purchase_price: "500000.00",
      current_value: "600000.00",
    });
    expect(pp.purchase_price).toBe("500000.00");
    expect(pp.current_value).toBe("600000.00");
    expect(pp.gain_loss).toBe("100000.00");
  });

  it("update() patches portfolio place values", async () => {
    const updated = await portfolioPlacesApi.update(
      PORTFOLIO_FIXTURES[0].id,
      "11111111-1111-1111-1111-111111111111",
      { current_value: "1500000.00" },
    );
    expect(updated.current_value).toBe("1500000.00");
  });

  it("remove() deletes a portfolio place", async () => {
    await expect(
      portfolioPlacesApi.remove(
        PORTFOLIO_FIXTURES[0].id,
        "11111111-1111-1111-1111-111111111111",
      ),
    ).resolves.toBeUndefined();
  });
});

describe("getPortfolioAnalytics", () => {
  beforeEach(() => {
    server.use(...portfolioHandlers);
  });

  it("returns analytics with categories and performers", async () => {
    const analytics = await getPortfolioAnalytics(PORTFOLIO_FIXTURES[0].id);
    expect(analytics.total_value).toBe("1600000.00");
    expect(analytics.total_purchase).toBe("1500000.00");
    expect(analytics.gain_loss).toBe("100000.00");
    expect(analytics.place_count).toBe(2);
    expect(analytics.category_allocation).toHaveLength(2);
    expect(analytics.top_performers).toHaveLength(1);
    expect(analytics.top_performers[0].place_name).toBe("Test Place A");
  });
});
