/**
 * E2E auth test helpers — API shortcuts for setup/teardown.
 * Uses Playwright's built-in request context (not Axios).
 */
import type { APIRequestContext } from "@playwright/test";

const API_URL = "http://localhost:8080";

/** Register a user via API (skip UI for speed). */
export async function apiRegister(
  request: APIRequestContext,
  email: string,
  password: string,
) {
  const resp = await request.post(`${API_URL}/auth/register`, {
    data: { email, password },
  });
  return { status: resp.status(), data: await resp.json() };
}

/** Login via API and return tokens. */
export async function apiLogin(
  request: APIRequestContext,
  email: string,
  password: string,
) {
  const resp = await request.post(`${API_URL}/auth/jwt/login`, {
    form: { username: email, password },
  });
  return { status: resp.status(), data: await resp.json() };
}

/** Get last email token from dev-only endpoint. */
export async function getLastEmailToken(
  request: APIRequestContext,
): Promise<{ token: string | null; email: string | null }> {
  const resp = await request.get(`${API_URL}/auth/test/last-email-token`);
  return resp.json();
}

/** Request email verification token via API. */
export async function apiRequestVerify(
  request: APIRequestContext,
  email: string,
) {
  return request.post(`${API_URL}/auth/request-verify-token`, {
    data: { email },
  });
}

/** Request password reset via API. */
export async function apiForgotPassword(
  request: APIRequestContext,
  email: string,
) {
  return request.post(`${API_URL}/auth/forgot-password`, {
    data: { email },
  });
}

/** Generate unique email for test isolation. */
export function testEmail(prefix: string): string {
  return `e2e-${prefix}-${Date.now()}@test.com`;
}

/** Standard test password meeting validation requirements. */
export const TEST_PASSWORD = "E2eTest#Pass1";
