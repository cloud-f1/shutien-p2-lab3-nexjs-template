import type { AxiosRequestConfig } from "axios";
import { apiClient } from "../client";
import {
  planReadSchema,
  subscriptionReadSchema,
  checkoutSessionReadSchema,
  portalSessionReadSchema,
} from "../../schemas/billing";
import type {
  PlanRead,
  SubscriptionRead,
  CheckoutSessionCreate,
  CheckoutSessionRead,
  PortalSessionCreate,
  PortalSessionRead,
} from "../../schemas/billing";

const BASE = "/billing";

export const billingService = {
  /** GET /billing/plans — list available plans (public, no auth). */
  listPlans: async (config?: AxiosRequestConfig): Promise<PlanRead[]> => {
    const res = await apiClient.get(`${BASE}/plans`, config);
    return planReadSchema.array().parse(res.data);
  },

  /** GET /billing/subscription/:teamId — get current subscription. */
  getSubscription: async (
    teamId: string,
    config?: AxiosRequestConfig,
  ): Promise<SubscriptionRead> => {
    const res = await apiClient.get(
      `${BASE}/subscription/${teamId}`,
      config,
    );
    return subscriptionReadSchema.parse(res.data);
  },

  /** POST /billing/checkout — create Stripe Checkout session. */
  createCheckout: async (
    data: CheckoutSessionCreate,
    config?: AxiosRequestConfig,
  ): Promise<CheckoutSessionRead> => {
    const res = await apiClient.post(`${BASE}/checkout`, data, config);
    return checkoutSessionReadSchema.parse(res.data);
  },

  /** POST /billing/portal — create Stripe Customer Portal session. */
  createPortal: async (
    data: PortalSessionCreate,
    config?: AxiosRequestConfig,
  ): Promise<PortalSessionRead> => {
    const res = await apiClient.post(`${BASE}/portal`, data, config);
    return portalSessionReadSchema.parse(res.data);
  },
};
