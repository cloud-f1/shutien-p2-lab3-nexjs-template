import { apiClient } from "../api/client";
import { sliResponseSchema } from "../schemas/admin";
import type { SliResponse } from "../schemas/admin";
import { useServiceQuery } from "./useService";
import { CACHE_TIERS } from "../cacheConfig";

async function fetchAdminSli(): Promise<SliResponse> {
  const res = await apiClient.get("/admin/sli");
  return sliResponseSchema.parse(res.data);
}

/** Query hook for GET /admin/sli — superuser only, auto-refresh every 30s. */
export function useAdminSli() {
  return useServiceQuery(
    ["admin", "sli"],
    fetchAdminSli,
    CACHE_TIERS.REALTIME,
    {
      refetchInterval: 30_000,
      retry: false,
    },
  );
}
