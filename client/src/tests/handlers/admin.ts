import { http, HttpResponse } from "msw";
import { createMockFromSchema } from "../helpers/mockFactory";
import {
  adminHealthResponseSchema,
  sliResponseSchema,
} from "../../schemas/admin";

const BASE = "http://localhost:8080";

// Schema-derived mock — auto-updates when adminHealthResponseSchema changes
export const MOCK_ADMIN_HEALTH = createMockFromSchema(
  adminHealthResponseSchema,
  {
    db: { status: "connected", latency_ms: 1.23 },
    email: { provider: "console", configured: true },
    oauth: { providers: ["google", "github"] },
    app: {
      version: "1.0.0",
      uptime_seconds: 3600,
      environment: "development",
    },
  },
);

export const MOCK_ADMIN_SLI = createMockFromSchema(sliResponseSchema, {
  window_seconds: 300,
  sample_count: 142,
  success_rate_5m: 0.9931,
  p50_ms: 12.4,
  p95_ms: 87.6,
  top_endpoints: [
    {
      path: "/users/me",
      count: 80,
      success_rate: 1.0,
      p50_ms: 8.2,
      p95_ms: 24.1,
    },
    {
      path: "/auth/jwt/login",
      count: 32,
      success_rate: 0.9688,
      p50_ms: 35.5,
      p95_ms: 110.2,
    },
  ],
  db_pool: { size: 5, checked_in: 4, checked_out: 1, overflow: 0 },
  release: "abc1234",
  environment: "development",
});

export const adminHandlers = [
  http.get(`${BASE}/admin/health`, ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return HttpResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }
    return HttpResponse.json(MOCK_ADMIN_HEALTH);
  }),
  http.get(`${BASE}/admin/sli`, ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return HttpResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }
    return HttpResponse.json(MOCK_ADMIN_SLI);
  }),
];
