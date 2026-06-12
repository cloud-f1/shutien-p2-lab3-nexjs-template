import { useServiceQuery } from "./useService";
import { CACHE_TIERS } from "../cacheConfig";
import { billingService } from "../api/services/billing";

/**
 * Feature gate hook — checks whether a feature is allowed by the team's plan.
 *
 * Usage:
 *   const { allowed, limit } = useFeatureGate("analytics", teamId);
 *   if (!allowed) return <UpgradePrompt />;
 */
export function useFeatureGate(
  feature: string,
  teamId: string | undefined,
): {
  allowed: boolean;
  limit: number | null;
  currentUsage: number | null;
  isLoading: boolean;
} {
  const { data: subscription, isLoading } = useServiceQuery(
    ["billing", "subscription", teamId],
    () => billingService.getSubscription(teamId!),
    CACHE_TIERS.STANDARD,
    { enabled: !!teamId },
  );

  if (!subscription || isLoading) {
    return { allowed: true, limit: null, currentUsage: null, isLoading };
  }

  const plan = subscription.plan;

  // Check boolean feature flag
  const featureValue = plan.features?.[feature];
  if (typeof featureValue === "boolean") {
    return { allowed: featureValue, limit: null, currentUsage: null, isLoading };
  }

  // Check numeric limit
  const limitValue = plan.limits?.[feature];
  if (typeof limitValue === "number") {
    return {
      allowed: true,
      limit: limitValue,
      currentUsage: null,
      isLoading,
    };
  }

  // Feature not defined — default to allowed
  return { allowed: true, limit: null, currentUsage: null, isLoading };
}
