import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../tests/setup";
import {
  apiClient,
  setAccessToken,
  getAccessToken,
  setRefreshToken,
  getRefreshToken,
  clearRefreshTimer,
} from "../client";

const BASE = "http://localhost:8080";

describe("apiClient interceptors", () => {
  beforeEach(() => {
    setAccessToken(null);
    setRefreshToken(null);
    clearRefreshTimer();
  });

  afterEach(() => {
    clearRefreshTimer();
  });

  it("adds Bearer token when available", async () => {
    setAccessToken("my-token");
    const res = await apiClient.get("/health");

    expect(res.status).toBe(200);
    expect(res.config.headers.Authorization).toBe("Bearer my-token");
  });

  it("skips token when not available", async () => {
    const res = await apiClient.get("/health");

    expect(res.status).toBe(200);
    expect(res.config.headers.Authorization).toBeUndefined();
  });

  it("passes through successful responses", async () => {
    const res = await apiClient.get("/health");

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ status: "ok" });
  });
});

describe("token storage", () => {
  afterEach(() => {
    clearRefreshTimer();
    setAccessToken(null);
    setRefreshToken(null);
  });

  it("stores and retrieves access token", () => {
    setAccessToken("abc");
    expect(getAccessToken()).toBe("abc");
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });

  it("stores and retrieves refresh token", () => {
    setRefreshToken("xyz");
    expect(getRefreshToken()).toBe("xyz");
    setRefreshToken(null);
    expect(getRefreshToken()).toBeNull();
  });
});

describe("401 refresh interceptor", () => {
  beforeEach(() => {
    clearRefreshTimer();
    setAccessToken(null);
    setRefreshToken(null);
  });

  afterEach(() => {
    clearRefreshTimer();
    setAccessToken(null);
    setRefreshToken(null);
  });

  it("refreshes token on 401 and retries the request", async () => {
    let callCount = 0;
    server.use(
      http.get(`${BASE}/users/me`, () => {
        callCount++;
        if (callCount === 1) {
          return HttpResponse.json({ detail: "Unauthorized" }, { status: 401 });
        }
        return HttpResponse.json({ id: "user-1", email: "test@test.com" });
      }),
    );

    setAccessToken("expired-token");
    setRefreshToken("valid-refresh");

    const res = await apiClient.get("/users/me");
    expect(res.status).toBe(200);
    expect(res.data.email).toBe("test@test.com");
    // After refresh, new access token should be set
    expect(getAccessToken()).toBe("new-access-token");
    expect(getRefreshToken()).toBe("new-refresh-token");
  });

  it("rejects when no refresh token is available on 401", async () => {
    server.use(
      http.get(`${BASE}/users/me`, () => {
        return HttpResponse.json({ detail: "Unauthorized" }, { status: 401 });
      }),
    );

    setAccessToken("expired-token");
    // No refresh token set

    await expect(apiClient.get("/users/me")).rejects.toThrow();
  });

  it("clears tokens when refresh fails", async () => {
    server.use(
      http.get(`${BASE}/users/me`, () => {
        return HttpResponse.json({ detail: "Unauthorized" }, { status: 401 });
      }),
      http.post(`${BASE}/auth/refresh`, () => {
        return HttpResponse.json(
          { detail: "INVALID_REFRESH_TOKEN" },
          { status: 401 },
        );
      }),
    );

    setAccessToken("expired-token");
    setRefreshToken("expired-token");

    await expect(apiClient.get("/users/me")).rejects.toThrow();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("does not retry on non-401 errors", async () => {
    server.use(
      http.get(`${BASE}/users/me`, () => {
        return HttpResponse.json({ detail: "Forbidden" }, { status: 403 });
      }),
    );

    setAccessToken("some-token");
    setRefreshToken("valid-refresh");

    await expect(apiClient.get("/users/me")).rejects.toThrow();
    // Refresh token should not have been consumed
    expect(getRefreshToken()).toBe("valid-refresh");
  });
});

describe("clearRefreshTimer", () => {
  afterEach(() => {
    clearRefreshTimer();
    setAccessToken(null);
    setRefreshToken(null);
  });

  it("does not throw when no timer is set", () => {
    expect(() => clearRefreshTimer()).not.toThrow();
  });

  it("clears the proactive refresh timer", () => {
    // Create a JWT with exp far in the future to schedule a timer
    const payload = { exp: Math.floor(Date.now() / 1000) + 3600 };
    const fakeJwt = `header.${btoa(JSON.stringify(payload))}.signature`;
    setAccessToken(fakeJwt);
    // Timer is now scheduled — clearing should not throw
    clearRefreshTimer();
    expect(getAccessToken()).toBe(fakeJwt);
  });
});

describe("proactive refresh scheduling", () => {
  afterEach(() => {
    clearRefreshTimer();
    setAccessToken(null);
    setRefreshToken(null);
    vi.restoreAllMocks();
  });

  it("skips proactive refresh when token is already close to expiry", () => {
    // Token expiring in 30s (less than the 60s buffer)
    const payload = { exp: Math.floor(Date.now() / 1000) + 30 };
    const fakeJwt = `header.${btoa(JSON.stringify(payload))}.signature`;

    const spy = vi.spyOn(globalThis, "setTimeout");
    setAccessToken(fakeJwt);

    // setTimeout should not be called for scheduling (the clearTimeout is called in clearRefreshTimer)
    const scheduleCalls = spy.mock.calls.filter(
      (call) => typeof call[1] === "number" && call[1] > 0,
    );
    // No positive-delay setTimeout should be called since delayMs <= 0
    expect(
      scheduleCalls.every((call) => (call[1] as number) <= 0),
    ).toBe(true);
  });

  it("handles invalid token format gracefully", () => {
    // Should not throw for a malformed JWT
    expect(() => setAccessToken("not-a-jwt")).not.toThrow();
  });
});
