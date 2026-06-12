import { apiClient } from "../client";
import { healthResponseSchema } from "../../schemas/auth";
import type { HealthResponse } from "../../schemas/auth";

export const healthApi = {
  /** GET /health — liveness + readiness probe. */
  check: async (): Promise<HealthResponse> => {
    const res = await apiClient.get("/health");
    return healthResponseSchema.parse(res.data);
  },
};
