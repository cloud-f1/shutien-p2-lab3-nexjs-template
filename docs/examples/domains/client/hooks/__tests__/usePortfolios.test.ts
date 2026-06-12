import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  usePortfoliosList,
  usePortfolioDetail,
  usePortfolioAnalytics,
  usePortfolioPlaces,
  usePortfolioCreate,
  usePortfolioUpdate,
  usePortfolioDelete,
  useAddPlaceToPortfolio,
  useRemovePlaceFromPortfolio,
} from "../usePortfolios";
import { server } from "../../tests/setup";
import {
  portfolioHandlers,
  PORTFOLIO_FIXTURES,
} from "../../tests/handlers/portfolios";
import { createWrapper } from "../../tests/helpers/createWrapper";

describe("usePortfolios hooks", () => {
  beforeEach(() => {
    server.use(...portfolioHandlers);
  });

  describe("usePortfoliosList", () => {
    it("returns paginated portfolios", async () => {
      const { result } = renderHook(
        () => usePortfoliosList({ page: 1, page_size: 20 }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.items).toHaveLength(2);
      expect(result.current.data!.items[0].name).toBe("Growth Portfolio");
    });
  });

  describe("usePortfolioDetail", () => {
    it("returns portfolio detail", async () => {
      const { result } = renderHook(
        () => usePortfolioDetail(PORTFOLIO_FIXTURES[0].id),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.name).toBe("Growth Portfolio");
      expect(result.current.data!.places).toHaveLength(1);
    });

    it("does not fetch when id is empty", () => {
      const { result } = renderHook(() => usePortfolioDetail(""), {
        wrapper: createWrapper(),
      });
      expect(result.current.isFetching).toBe(false);
    });
  });

  describe("usePortfolioAnalytics", () => {
    it("returns analytics data", async () => {
      const { result } = renderHook(
        () => usePortfolioAnalytics(PORTFOLIO_FIXTURES[0].id),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.total_value).toBe("1600000.00");
      expect(result.current.data!.category_allocation).toHaveLength(2);
    });

    it("does not fetch when id is empty", () => {
      const { result } = renderHook(() => usePortfolioAnalytics(""), {
        wrapper: createWrapper(),
      });
      expect(result.current.isFetching).toBe(false);
    });
  });

  describe("usePortfolioPlaces", () => {
    it("returns places in a portfolio", async () => {
      const { result } = renderHook(
        () => usePortfolioPlaces(PORTFOLIO_FIXTURES[0].id),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data![0].place.name).toBe("Test Place A");
    });

    it("does not fetch when portfolioId is empty", () => {
      const { result } = renderHook(() => usePortfolioPlaces(""), {
        wrapper: createWrapper(),
      });
      expect(result.current.isFetching).toBe(false);
    });
  });

  describe("usePortfolioCreate", () => {
    it("creates a portfolio", async () => {
      const { result } = renderHook(() => usePortfolioCreate(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ name: "New Portfolio" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.name).toBe("New Portfolio");
    });
  });

  describe("usePortfolioUpdate", () => {
    it("updates a portfolio", async () => {
      const { result } = renderHook(() => usePortfolioUpdate(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        id: PORTFOLIO_FIXTURES[0].id,
        data: { name: "Updated Name" },
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.name).toBe("Updated Name");
    });
  });

  describe("usePortfolioDelete", () => {
    it("deletes a portfolio", async () => {
      const { result } = renderHook(() => usePortfolioDelete(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(PORTFOLIO_FIXTURES[0].id);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useAddPlaceToPortfolio", () => {
    it("adds a place to a portfolio", async () => {
      const { result } = renderHook(() => useAddPlaceToPortfolio(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        portfolioId: PORTFOLIO_FIXTURES[0].id,
        data: {
          place_id: "11111111-1111-1111-1111-111111111111",
          purchase_price: "500000.00",
          current_value: "600000.00",
        },
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useRemovePlaceFromPortfolio", () => {
    it("removes a place from a portfolio", async () => {
      const { result } = renderHook(() => useRemovePlaceFromPortfolio(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        portfolioId: PORTFOLIO_FIXTURES[0].id,
        placeId: "11111111-1111-1111-1111-111111111111",
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });
});
