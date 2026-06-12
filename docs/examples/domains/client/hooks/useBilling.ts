import { useServiceQuery, useServiceMutation } from "./useService";
import { CACHE_TIERS } from "../cacheConfig";
import { billingService } from "../api/services/billing";
import type {
  CheckoutSessionCreate,
  PortalSessionCreate,
} from "../schemas/billing";

// ── Billing hooks ──────────────────────────────────────────────

export function usePlans() {
  return useServiceQuery(
    ["billing", "plans"],
    () => billingService.listPlans(),
    CACHE_TIERS.STATIC,
  );
}

export function useSubscription(teamId: string | undefined) {
  return useServiceQuery(
    ["billing", "subscription", teamId],
    () => billingService.getSubscription(teamId!),
    CACHE_TIERS.STANDARD,
    { enabled: !!teamId },
  );
}

export function useCreateCheckout() {
  return useServiceMutation(
    (data: CheckoutSessionCreate) => billingService.createCheckout(data),
    { invalidateKeys: [["billing"]] },
  );
}

export function useCreatePortal() {
  return useServiceMutation(
    (data: PortalSessionCreate) => billingService.createPortal(data),
  );
}
