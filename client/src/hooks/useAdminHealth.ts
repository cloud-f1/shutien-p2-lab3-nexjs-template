import { apiClient } from "../api/client";
import { adminHealthResponseSchema } from "../schemas/admin";
import type { AdminHealthResponse } from "../schemas/admin";
import { useServiceQuery } from "./useService";
import { CACHE_TIERS } from "../cacheConfig";

async function fetchAdminHealth(): Promise<AdminHealthResponse> {
  const res = await apiClient.get("/admin/health");
  return adminHealthResponseSchema.parse(res.data);
}

/** Query hook for GET /admin/health — superuser only, auto-refresh every 30s. */
export function useAdminHealth() {
  return useServiceQuery(
    ["admin", "health"],
    fetchAdminHealth,
    CACHE_TIERS.REALTIME,
    {
      refetchInterval: 30_000,
      retry: false,
    },
  );
}
