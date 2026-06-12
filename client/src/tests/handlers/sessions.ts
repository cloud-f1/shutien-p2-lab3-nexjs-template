import { http, HttpResponse } from "msw";
import type { UserSessionRead } from "../../schemas/auth";

const BASE = "http://localhost:8080";

/**
 * Mock session fixtures keyed by id. The handlers operate on this in-memory
 * store so test cases can observe revoke / logout-all side effects without
 * coordinating shared state with the schemas module.
 */
let MOCK_SESSIONS: UserSessionRead[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    created_at: "2026-04-20T10:00:00Z",
    last_used_at: "2026-04-24T08:00:00Z",
    ip: "203.0.113.10",
    user_agent: "Mozilla/5.0 (Macintosh) AppleWebKit/605 Safari/605",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    created_at: "2026-04-22T14:00:00Z",
    last_used_at: "2026-04-24T12:00:00Z",
    ip: "198.51.100.42",
    user_agent: "Mozilla/5.0 (iPhone) AppleWebKit/605 Mobile",
  },
];

/** Reset the mock store between tests. */
export function resetSessionFixtures(next?: UserSessionRead[]): void {
  MOCK_SESSIONS = next
    ? [...next]
    : [
        {
          id: "11111111-1111-1111-1111-111111111111",
          created_at: "2026-04-20T10:00:00Z",
          last_used_at: "2026-04-24T08:00:00Z",
          ip: "203.0.113.10",
          user_agent: "Mozilla/5.0 (Macintosh) AppleWebKit/605 Safari/605",
        },
        {
          id: "22222222-2222-2222-2222-222222222222",
          created_at: "2026-04-22T14:00:00Z",
          last_used_at: "2026-04-24T12:00:00Z",
          ip: "198.51.100.42",
          user_agent: "Mozilla/5.0 (iPhone) AppleWebKit/605 Mobile",
        },
      ];
}

export function getSessionFixtures(): UserSessionRead[] {
  return MOCK_SESSIONS;
}

export const sessionHandlers = [
  // GET /auth/sessions
  http.get(`${BASE}/auth/sessions`, ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return HttpResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }
    return HttpResponse.json(MOCK_SESSIONS);
  }),

  // DELETE /auth/sessions/:session_id
  http.delete(`${BASE}/auth/sessions/:sessionId`, ({ params, request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return HttpResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }
    const id = String(params.sessionId);
    const before = MOCK_SESSIONS.length;
    MOCK_SESSIONS = MOCK_SESSIONS.filter((s) => s.id !== id);
    if (MOCK_SESSIONS.length === before) {
      return new HttpResponse(null, { status: 404 });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /auth/logout-all
  http.post(`${BASE}/auth/logout-all`, ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return HttpResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }
    MOCK_SESSIONS = [];
    return new HttpResponse(null, { status: 204 });
  }),
];
