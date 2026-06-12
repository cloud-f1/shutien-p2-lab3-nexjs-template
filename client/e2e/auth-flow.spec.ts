import { test, expect } from "@playwright/test";
import {
  apiRegister,
  getLastEmailToken,
  apiForgotPassword,
  testEmail,
  TEST_PASSWORD,
} from "./fixtures/auth";

// ─── Reusable selectors ──────────────────────────────────────────────

/** Fill sign-in form fields (works around strict mode for password toggle). */
async function fillSignIn(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.locator("#si-email").fill(email);
  await page.locator("#si-pw").fill(password);
}

/** Fill sign-up form fields. */
async function fillSignUp(
  page: import("@playwright/test").Page,
  opts: { name: string; email: string; password: string },
) {
  await page.locator("#su-name").fill(opts.name);
  await page.locator("#su-email").fill(opts.email);
  await page.locator("#su-pw").fill(opts.password);
}

// ─── Group 1: UI Smoke Tests (no backend needed) ────────────────────

test.describe("UI Smoke", () => {
  test("landing page loads and has sign in link", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Claude Agent Template|AI-Coding-Template/i);
    const signInLink = page.getByRole("link", { name: /sign in/i });
    await expect(signInLink).toBeVisible();
  });

  test("sign in page renders form", async ({ page }) => {
    await page.goto("/signin");
    await expect(page.locator("#si-email")).toBeVisible();
    await expect(page.locator("#si-pw")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("sign up page renders form", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator("#su-email")).toBeVisible();
    await expect(page.locator("#su-pw")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("forgot password page renders form", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.locator("#fp-email")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("unauthenticated user redirected from dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/signin/);
  });

  test("navigate from landing to sign in", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/signin/);
    await expect(page.locator("#si-email")).toBeVisible();
  });

  test("navigate from sign in to sign up", async ({ page }) => {
    await page.goto("/signin");
    await page.getByRole("link", { name: /sign up|create account/i }).click();
    await expect(page).toHaveURL(/signup/);
  });

  test("navigate from sign in to forgot password", async ({ page }) => {
    await page.goto("/signin");
    await page.getByRole("link", { name: /forgot/i }).click();
    await expect(page).toHaveURL(/forgot-password/);
  });

  test("legal pages accessible", async ({ page }) => {
    await page.goto("/privacy");
    await expect(
      page.getByRole("heading", { name: /privacy policy/i }),
    ).toBeVisible({ timeout: 10000 });

    await page.goto("/terms");
    await expect(
      page.getByRole("heading", { name: /terms of service/i }),
    ).toBeVisible({ timeout: 10000 });
  });
});

// ─── Group 2: Registration + Email Verification ─────────────────────

test.describe("Registration + Verification", () => {
  test("register new user via UI shows success banner", async ({
    page,
  }) => {
    const email = testEmail("reg");

    await page.goto("/signup");
    await fillSignUp(page, { name: "Test User", email, password: TEST_PASSWORD });
    await page.getByRole("checkbox").check();
    await page.locator('button[type="submit"]').click();

    // Success banner should appear
    await expect(page.getByRole("alert")).toContainText(/account created|check/i, {
      timeout: 10000,
    });
  });

  test("duplicate email shows error banner", async ({ page, request }) => {
    const email = testEmail("dup");
    await apiRegister(request, email, TEST_PASSWORD);

    await page.goto("/signup");
    await fillSignUp(page, { name: "Dup User", email, password: TEST_PASSWORD });
    await page.getByRole("checkbox").check();
    await page.locator('button[type="submit"]').click();

    await expect(page.getByRole("alert")).toContainText(
      /already exists/i,
      { timeout: 10000 },
    );
  });

  test("verify email with valid token", async ({ page, request }) => {
    const email = testEmail("verify");
    await apiRegister(request, email, TEST_PASSWORD);

    const { token } = await getLastEmailToken(request);
    expect(token).toBeTruthy();

    await page.goto(`/verify-email?token=${token}`);

    await expect(
      page.getByText(/verified|success/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test("invalid verify token shows error", async ({ page }) => {
    await page.goto("/verify-email?token=invalid-token-abc123");

    await expect(
      page.getByText(/invalid|expired|error|failed/i),
    ).toBeVisible({ timeout: 10000 });
  });
});

// ─── Group 3: Login + Dashboard + Logout ─────────────────────────────

test.describe("Login + Dashboard + Logout", () => {
  let email: string;

  test.beforeAll(async ({ request }) => {
    email = testEmail("login");
    await apiRegister(request, email, TEST_PASSWORD);
  });

  test("login with valid credentials reaches dashboard", async ({ page }) => {
    await page.goto("/signin");
    await fillSignIn(page, email, TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test("invalid credentials show error banner", async ({ page }) => {
    await page.goto("/signin");
    await fillSignIn(page, email, "WrongPass#99");
    await page.locator('button[type="submit"]').click();

    await expect(page.getByRole("alert")).toContainText(
      /invalid|wrong|failed/i,
      { timeout: 5000 },
    );
  });

  test("logout redirects to signin", async ({ page }) => {
    // Login first
    await page.goto("/signin");
    await fillSignIn(page, email, TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });

    // Find and click logout — may be in a dropdown
    const logoutBtn = page.getByRole("button", { name: /log\s?out|sign\s?out/i });
    if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutBtn.click();
    } else {
      // Open user dropdown then click logout
      const userDropdown = page.locator("[aria-haspopup]").first();
      if (await userDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
        await userDropdown.click();
        await page
          .getByText(/log\s?out|sign\s?out/i)
          .first()
          .click();
      }
    }

    await expect(page).toHaveURL(/signin/, { timeout: 10000 });
  });
});

// ─── Group 4: Password Reset Flow ───────────────────────────────────

test.describe("Password Reset", () => {
  test("forgot password shows success banner", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.locator("#fp-email").fill("any-email@test.com");
    await page.locator('button[type="submit"]').click();

    // Always shows success (email enumeration prevention)
    await expect(page.getByRole("alert")).toContainText(
      /sent|reset|check/i,
      { timeout: 10000 },
    );
  });

  test("reset password with valid token", async ({ page, request }) => {
    const email = testEmail("reset");
    await apiRegister(request, email, TEST_PASSWORD);

    await apiForgotPassword(request, email);
    const { token } = await getLastEmailToken(request);
    expect(token).toBeTruthy();

    await page.goto(`/reset-password?token=${token}`);

    // Fill new password — use locator for password inputs
    const pwInputs = page.locator('input[type="password"]');
    const count = await pwInputs.count();
    if (count >= 2) {
      await pwInputs.nth(0).fill("NewSecure#Pass2");
      await pwInputs.nth(1).fill("NewSecure#Pass2");
    } else if (count === 1) {
      await pwInputs.first().fill("NewSecure#Pass2");
    }

    await page.locator('button[type="submit"]').click();

    // Should show success or redirect to signin
    await expect(
      page.getByText(/success|reset|changed/i).or(page.locator("text=/signin/")),
    ).toBeVisible({ timeout: 10000 });
  });

  test("reset password with invalid token shows error", async ({ page }) => {
    await page.goto("/reset-password?token=bad-token-xyz");

    const pwInputs = page.locator('input[type="password"]');
    const count = await pwInputs.count();
    if (count >= 1) {
      await pwInputs.first().fill("NewSecure#Pass2");
      if (count >= 2) {
        await pwInputs.nth(1).fill("NewSecure#Pass2");
      }
      await page.locator('button[type="submit"]').click();
    }

    await expect(
      page.getByText(/invalid|expired|error|failed|bad/i),
    ).toBeVisible({ timeout: 10000 });
  });
});

// ─── Group 5: Protected Routes + OAuth ───────────────────────────────

test.describe("Protected Routes + OAuth", () => {
  test("unauthenticated dashboard access redirects to signin", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/signin/);
  });

  test("Google OAuth authorize returns redirect URL", async ({ request }) => {
    const resp = await request.get(
      "http://localhost:8080/auth/google/authorize",
    );
    const status = resp.status();
    if (status === 200) {
      const data = await resp.json();
      expect(data.authorization_url).toContain("accounts.google.com");
    } else {
      // OAuth not configured in dev — endpoint exists but can't generate URL
      expect([200, 400, 422]).toContain(status);
    }
  });
});
