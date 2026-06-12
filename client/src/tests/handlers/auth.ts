import { http, HttpResponse } from "msw";
import { createMockFromSchema } from "../helpers/mockFactory";
import { userSchema, tokenPairSchema } from "../../schemas/auth";

const BASE = "http://localhost:8080";

// Schema-derived mock objects — auto-update when schemas change
export const TEST_USER = createMockFromSchema(userSchema, {
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "alex@example.com",
  display_name: "Alex Hsieh",
  avatar_url: null,
  is_active: true,
  is_verified: false,
  is_superuser: false,
  social_providers: [] as ("google" | "apple")[],
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
});

const TEST_TOKENS = createMockFromSchema(tokenPairSchema, {
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  token_type: "bearer",
});

export const handlers = [
  // Health
  http.get(`${BASE}/health`, () => HttpResponse.json({ status: "ok" })),

  // Login — form-data, returns unified AuthResponse (E161)
  http.post(`${BASE}/auth/jwt/login`, async ({ request }) => {
    const body = await request.text();
    const params = new URLSearchParams(body);
    const email = params.get("username");
    const password = params.get("password");

    if (email === "alex@example.com" && password === "wrongPassword") {
      return HttpResponse.json(
        { detail: "LOGIN_BAD_CREDENTIALS" },
        { status: 400 },
      );
    }
    return HttpResponse.json({
      user: { ...TEST_USER, email: email ?? TEST_USER.email },
      access_token: TEST_TOKENS.access_token,
      refresh_token: TEST_TOKENS.refresh_token,
      token_type: TEST_TOKENS.token_type,
      expires_in: 900,
    });
  }),

  // Register — JSON, returns unified AuthResponse (E161 — no more auto-login round-trip)
  http.post(`${BASE}/auth/register`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.email === "existing@example.com") {
      return HttpResponse.json(
        { detail: "REGISTER_USER_ALREADY_EXISTS" },
        { status: 400 },
      );
    }
    return HttpResponse.json(
      {
        user: {
          ...TEST_USER,
          email: body.email,
          display_name: body.display_name ?? null,
        },
        access_token: TEST_TOKENS.access_token,
        refresh_token: TEST_TOKENS.refresh_token,
        token_type: TEST_TOKENS.token_type,
        expires_in: 900,
      },
      { status: 201 },
    );
  }),

  // Logout
  http.post(
    `${BASE}/auth/jwt/logout`,
    () => new HttpResponse(null, { status: 204 }),
  ),

  // Forgot password — always 202
  http.post(
    `${BASE}/auth/forgot-password`,
    () => new HttpResponse(null, { status: 202 }),
  ),

  // Reset password
  http.post(`${BASE}/auth/reset-password`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.token === "bad-token") {
      return HttpResponse.json(
        { detail: "RESET_PASSWORD_BAD_TOKEN" },
        { status: 400 },
      );
    }
    return HttpResponse.json(null, { status: 200 });
  }),

  // Verify email
  http.post(`${BASE}/auth/verify`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.token === "bad-token") {
      return HttpResponse.json(
        { detail: "VERIFY_USER_BAD_TOKEN" },
        { status: 400 },
      );
    }
    return HttpResponse.json(null, { status: 200 });
  }),

  // Refresh token — returns unified AuthResponse (E161)
  http.post(`${BASE}/auth/refresh`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    if (!body.refresh_token || body.refresh_token === "expired-token") {
      return HttpResponse.json(
        { detail: "INVALID_REFRESH_TOKEN" },
        { status: 401 },
      );
    }
    if (body.refresh_token === "revoked-token") {
      return HttpResponse.json(
        { detail: "SESSION_REVOKED" },
        { status: 401 },
      );
    }
    return HttpResponse.json({
      user: TEST_USER,
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
      token_type: TEST_TOKENS.token_type,
      expires_in: 900,
    });
  }),

  // Get current user
  http.get(`${BASE}/users/me`, ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return HttpResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }
    return HttpResponse.json(TEST_USER);
  }),

  // Update current user
  http.patch(`${BASE}/users/me`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...TEST_USER, ...body });
  }),

  // Google OAuth authorize
  http.get(`${BASE}/auth/google/authorize`, () =>
    HttpResponse.json({
      authorization_url: "https://google.com/auth",
    }),
  ),

  // GitHub OAuth authorize
  http.get(`${BASE}/auth/github/authorize`, () =>
    HttpResponse.json({
      authorization_url: "https://github.com/login/oauth/authorize",
    }),
  ),
];
