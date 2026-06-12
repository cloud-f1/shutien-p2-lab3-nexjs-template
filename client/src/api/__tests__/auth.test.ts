import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../tests/setup";
import { authApi } from "../auth";
import { TEST_USER } from "../../tests/handlers/auth";
import {
  setAccessToken,
  getAccessToken,
  setRefreshToken,
  getRefreshToken,
  clearRefreshTimer,
} from "../client";

const BASE = "http://localhost:8080";

describe("authApi", () => {
  beforeEach(() => {
    setAccessToken(null);
    setRefreshToken(null);
    clearRefreshTimer();
  });

  describe("login", () => {
    it("sends form-data, stores token, and returns unified AuthResponse", async () => {
      const result = await authApi.login({
        email: "alex@example.com",
        password: "validPass123",
      });

      expect(result.user.email).toBe("alex@example.com");
      expect(result.access_token).toBe("test-access-token");
      expect(result.expires_in).toBe(900);
      expect(getAccessToken()).toBe("test-access-token");
    });
  });

  describe("register", () => {
    it("sends JSON and returns unified AuthResponse (no auto-login round-trip)", async () => {
      const result = await authApi.register({
        email: "new@example.com",
        password: "securePass1",
      });

      expect(result.user.email).toBe("new@example.com");
      expect(result.access_token).toBe("test-access-token");
      expect(result.expires_in).toBe(900);
      expect(getAccessToken()).toBe("test-access-token");
    });
  });

  describe("logout", () => {
    it("clears tokens and returns message", async () => {
      setAccessToken("test-access-token");
      const result = await authApi.logout();

      expect(result.message).toBe("Logged out");
      expect(getAccessToken()).toBeNull();
    });
  });

  describe("getCurrentUser", () => {
    it("returns user with Bearer token", async () => {
      setAccessToken("test-access-token");
      const user = await authApi.getCurrentUser();

      expect(user.email).toBe("alex@example.com");
      expect(user.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("fills defaults when is_superuser and social_providers are missing", async () => {
      setAccessToken("test-access-token");
      server.use(
        http.get(`${BASE}/users/me`, () =>
          HttpResponse.json({
            id: "550e8400-e29b-41d4-a716-446655440000",
            email: "minimal@example.com",
            display_name: null,
            avatar_url: null,
            is_active: true,
            is_verified: false,
            // No is_superuser or social_providers
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          }),
        ),
      );

      const user = await authApi.getCurrentUser();
      expect(user.is_superuser).toBe(false);
      expect(user.social_providers).toEqual([]);
    });
  });

  describe("forgotPassword", () => {
    it("returns success message", async () => {
      const result = await authApi.forgotPassword({
        email: "alex@example.com",
      });

      expect(result.message).toContain("reset link");
    });
  });

  describe("resetPassword", () => {
    it("returns success message", async () => {
      const result = await authApi.resetPassword({
        token: "valid-token",
        new_password: "newSecure1",
      });

      expect(result.message).toContain("Password reset successful");
    });
  });

  describe("refresh", () => {
    it("refreshes tokens and stores new pair (unified AuthResponse)", async () => {
      // Override the refresh handler to return the unified shape (E161)
      server.use(
        http.post(`${BASE}/auth/refresh`, async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          if (!body.refresh_token || body.refresh_token === "expired-token") {
            return HttpResponse.json(
              { detail: "INVALID_REFRESH_TOKEN" },
              { status: 401 },
            );
          }
          return HttpResponse.json({
            user: TEST_USER,
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            token_type: "bearer",
            expires_in: 900,
          });
        }),
      );

      setAccessToken("old-access");
      setRefreshToken("valid-refresh");

      const result = await authApi.refresh({
        refresh_token: "valid-refresh",
      });

      expect(result.access_token).toBe("new-access-token");
      expect(result.refresh_token).toBe("new-refresh-token");
      expect(result.user.email).toBe("alex@example.com");
      expect(getAccessToken()).toBe("new-access-token");
      expect(getRefreshToken()).toBe("new-refresh-token");
    });

    it("rejects when no refresh token provided", async () => {
      await expect(
        authApi.refresh({ refresh_token: "" }),
      ).rejects.toThrow("No refresh token available");
    });
  });

  describe("verifyEmail", () => {
    it("returns success message for valid token", async () => {
      const result = await authApi.verifyEmail("valid-token");
      expect(result.message).toContain("Email verified");
    });
  });

  describe("updateCurrentUser", () => {
    it("updates user and returns updated data", async () => {
      setAccessToken("test-access-token");
      const result = await authApi.updateCurrentUser({
        display_name: "New Name",
      });

      expect(result.display_name).toBe("New Name");
    });
  });

  describe("listSessions", () => {
    it("returns session list", async () => {
      setAccessToken("test-access-token");
      server.use(
        http.get(`${BASE}/users/me/sessions`, () =>
          HttpResponse.json([
            {
              id: "11111111-1111-1111-1111-111111111111",
              device_info: "Chrome on macOS",
              ip_address: "127.0.0.1",
              created_at: "2026-01-01T00:00:00Z",
              last_used_at: "2026-01-01T00:00:00Z",
              expires_at: "2026-02-01T00:00:00Z",
              is_current: true,
            },
          ]),
        ),
      );

      const sessions = await authApi.listSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe("11111111-1111-1111-1111-111111111111");
    });
  });

  describe("revokeSession", () => {
    it("revokes a session and returns message", async () => {
      setAccessToken("test-access-token");
      server.use(
        http.delete(`${BASE}/users/me/sessions/:sessionId`, () =>
          new HttpResponse(null, { status: 204 }),
        ),
      );

      const result = await authApi.revokeSession("sess-1");
      expect(result.message).toBe("Session revoked");
    });
  });

  describe("getGoogleAuthUrl", () => {
    it("returns authorization URL", async () => {
      const url = await authApi.getGoogleAuthUrl();
      expect(url).toBe("https://google.com/auth");
    });
  });
});
