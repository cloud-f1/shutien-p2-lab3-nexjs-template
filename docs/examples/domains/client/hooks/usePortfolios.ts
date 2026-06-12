import { useServiceQuery, useServiceMutation } from "./useService";
import { CACHE_TIERS } from "../cacheConfig";
import {
  portfoliosService,
  portfolioPlacesApi,
  getPortfolioDetail,
  getPortfolioAnalytics,
} from "../api/services/portfolios";
import type { PaginationParams } from "../schemas/common";
import type {
  PortfolioCreate,
  PortfolioUpdate,
  PortfolioPlaceCreate,
  PortfolioPlaceUpdate,
} from "../schemas/portfolio";

export function usePortfoliosList(params?: PaginationParams) {
  return useServiceQuery(
    ["portfolios", params],
    () => portfoliosService.list(params),
    CACHE_TIERS.STANDARD,
  );
}

export function usePortfolioDetail(id: string) {
  return useServiceQuery(
    ["portfolios", id, "detail"],
    () => getPortfolioDetail(id),
    CACHE_TIERS.STANDARD,
    { enabled: !!id },
  );
}

export function usePortfolioAnalytics(id: string) {
  return useServiceQuery(
    ["portfolios", id, "analytics"],
    () => getPortfolioAnalytics(id),
    CACHE_TIERS.STANDARD,
    { enabled: !!id },
  );
}

export function usePortfolioPlaces(portfolioId: string) {
  return useServiceQuery(
    ["portfolios", portfolioId, "places"],
    () => portfolioPlacesApi.list(portfolioId),
    CACHE_TIERS.STANDARD,
    { enabled: !!portfolioId },
  );
}

export function usePortfolioCreate() {
  return useServiceMutation(
    (data: PortfolioCreate) =>
      portfoliosService.create(data as Record<string, unknown>),
    { invalidateKeys: [["portfolios"]] },
  );
}

export function usePortfolioUpdate() {
  return useServiceMutation(
    ({ id, data }: { id: string; data: PortfolioUpdate }) =>
      portfoliosService.update(id, data as Record<string, unknown>),
    { invalidateKeys: [["portfolios"]] },
  );
}

export function usePortfolioDelete() {
  return useServiceMutation(
    (id: string) => portfoliosService.remove(id),
    { invalidateKeys: [["portfolios"]] },
  );
}

export function useAddPlaceToPortfolio() {
  return useServiceMutation(
    ({ portfolioId, data }: { portfolioId: string; data: PortfolioPlaceCreate }) =>
      portfolioPlacesApi.add(portfolioId, data),
    { invalidateKeys: [["portfolios"]] },
  );
}

export function useUpdatePortfolioPlace() {
  return useServiceMutation(
    ({
      portfolioId,
      placeId,
      data,
    }: {
      portfolioId: string;
      placeId: string;
      data: PortfolioPlaceUpdate;
    }) => portfolioPlacesApi.update(portfolioId, placeId, data),
    { invalidateKeys: [["portfolios"]] },
  );
}

export function useRemovePlaceFromPortfolio() {
  return useServiceMutation(
    ({ portfolioId, placeId }: { portfolioId: string; placeId: string }) =>
      portfolioPlacesApi.remove(portfolioId, placeId),
    { invalidateKeys: [["portfolios"]] },
  );
}
