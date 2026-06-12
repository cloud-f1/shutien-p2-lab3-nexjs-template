import { z } from "zod";
import type { components } from "../api/types";

type ApiAdminHealthResponse = components["schemas"]["AdminHealthResponse"];
type ApiSliResponse = components["schemas"]["SliResponse"];

export const adminHealthResponseSchema = z.object({
  db: z.object({
    status: z.enum(["connected", "disconnected"]),
    latency_ms: z.number(),
  }),
  email: z.object({
    provider: z.string(),
    configured: z.boolean(),
  }),
  oauth: z.object({
    providers: z.array(z.string()),
  }),
  app: z.object({
    version: z.string(),
    uptime_seconds: z.number(),
    environment: z.string(),
  }),
}) satisfies z.ZodType<ApiAdminHealthResponse>;

export type AdminHealthResponse = z.infer<typeof adminHealthResponseSchema>;

// ── SLI (E159 Part 3c) ──────────────────────────────────────────

export const endpointSliSchema = z.object({
  path: z.string(),
  count: z.number().int(),
  success_rate: z.number().min(0).max(1),
  p50_ms: z.number(),
  p95_ms: z.number(),
});

export const dbPoolStatsSchema = z.object({
  size: z.number().int(),
  checked_in: z.number().int(),
  checked_out: z.number().int(),
  overflow: z.number().int(),
});

export const sliResponseSchema = z.object({
  window_seconds: z.number().int(),
  sample_count: z.number().int(),
  success_rate_5m: z.number().min(0).max(1),
  p50_ms: z.number(),
  p95_ms: z.number(),
  top_endpoints: z.array(endpointSliSchema),
  db_pool: dbPoolStatsSchema,
  release: z.string(),
  environment: z.string(),
}) satisfies z.ZodType<ApiSliResponse>;

export type SliResponse = z.infer<typeof sliResponseSchema>;
export type EndpointSli = z.infer<typeof endpointSliSchema>;
export type DbPoolStats = z.infer<typeof dbPoolStatsSchema>;
