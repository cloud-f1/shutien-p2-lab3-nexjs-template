import { apiClient } from "../client";
import { createService } from "./createService";
import {
  portfolioAnalyticsSchema,
  portfolioDetailSchema,
  portfolioPlaceReadSchema,
  portfolioReadSchema,
} from "../../schemas/portfolio";
import type {
  PortfolioAnalytics,
  PortfolioDetail,
  PortfolioPlaceCreate,
  PortfolioPlaceRead,
  PortfolioPlaceUpdate,
} from "../../schemas/portfolio";

/** Standard CRUD for portfolios (list, getById, create, update, remove). */
export const portfoliosService = createService("/portfolios", portfolioReadSchema);

/** Sub-resource API for portfolio ↔ place memberships + analytics. */
export const portfolioPlacesApi = {
  list: async (portfolioId: string): Promise<PortfolioPlaceRead[]> => {
    const res = await apiClient.get(`/portfolios/${portfolioId}/places`);
    return portfolioPlaceReadSchema.array().parse(res.data);
  },

  add: async (portfolioId: string, data: PortfolioPlaceCreate): Promise<PortfolioPlaceRead> => {
    const res = await apiClient.post(`/portfolios/${portfolioId}/places`, data);
    return portfolioPlaceReadSchema.parse(res.data);
  },

  update: async (
    portfolioId: string,
    placeId: string,
    data: PortfolioPlaceUpdate,
  ): Promise<PortfolioPlaceRead> => {
    const res = await apiClient.patch(`/portfolios/${portfolioId}/places/${placeId}`, data);
    return portfolioPlaceReadSchema.parse(res.data);
  },

  remove: async (portfolioId: string, placeId: string): Promise<void> => {
    await apiClient.delete(`/portfolios/${portfolioId}/places/${placeId}`);
  },
};

/** Get portfolio detail (with embedded places and stats). */
export async function getPortfolioDetail(portfolioId: string): Promise<PortfolioDetail> {
  const res = await apiClient.get(`/portfolios/${portfolioId}`);
  return portfolioDetailSchema.parse(res.data);
}

/** Get portfolio analytics. */
export async function getPortfolioAnalytics(portfolioId: string): Promise<PortfolioAnalytics> {
  const res = await apiClient.get(`/portfolios/${portfolioId}/analytics`);
  return portfolioAnalyticsSchema.parse(res.data);
}
