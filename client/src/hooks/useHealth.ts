import { healthApi } from "../api/services/health";
import { useServiceQuery } from "./useService";
import { CACHE_TIERS } from "../cacheConfig";

/** Query hook for the /health endpoint. */
export function useHealth() {
  return useServiceQuery(
    ["health"],
    () => healthApi.check(),
    CACHE_TIERS.REALTIME,
  );
}
