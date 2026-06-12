import { test, expect } from "@playwright/test";
import { apiRegister, testEmail, TEST_PASSWORD } from "./fixtures/auth";

// ─── Helpers ─────────────────────────────────────────────────────────

/** Register a user via API, then log in via UI and land on dashboard. */
async function loginViaSeedAccount(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
) {
  const email = testEmail("dash");
  await apiRegister(request, email, TEST_PASSWORD);

  await page.goto("/signin");
  await page.locator("#si-email").fill(email);
  await page.locator("#si-pw").fill(TEST_PASSWORD);
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  return email;
}

// ─── Dashboard Smoke Tests ───────────────────────────────────────────

test.describe("Dashboard Smoke", () => {
  test("login → dashboard overview renders sidebar and content", async ({
    page,
    request,
  }) => {
    await loginViaSeedAccount(page, request);

    // Should redirect to /dashboard/overview (E112 route map)
    await expect(page).toHaveURL(/dashboard\/overview|dashboard$/, {
      timeout: 10000,
    });

    // Sidebar nav renders with items
    const sidebar = page.locator("nav[aria-label='Dashboard navigation']");
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    const navItems = sidebar.locator(".nav-item");
    await expect(navItems.first()).toBeVisible();
    const navCount = await navItems.count();
    expect(navCount).toBeGreaterThanOrEqual(4);

    // Overview content renders — at least one heading or data element
    const mainContent = page.locator(".dashboard-content, main, [class*='content']");
    await expect(mainContent.first()).toBeVisible({ timeout: 10000 });

    // At least one meaningful element rendered (heading, stat card, or text content)
    const contentIndicator = page
      .getByRole("heading")
      .or(page.locator(".stat-card"))
      .or(page.locator(".view-header"));
    await expect(contentIndicator.first()).toBeVisible({ timeout: 10000 });
  });

  test("navigate to /dashboard/health — renders content", async ({
    page,
    request,
  }) => {
    await loginViaSeedAccount(page, request);

    await page.goto("/dashboard/health");
    await expect(page).toHaveURL(/dashboard\/health/);

    // Sidebar still visible
    const sidebar = page.locator("nav[aria-label='Dashboard navigation']");
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Health view renders content (not blank/error)
    const heading = page.getByRole("heading");
    await expect(heading.first()).toBeVisible({ timeout: 10000 });

    // No uncaught error overlay
    await expect(page.locator("text=Something went wrong")).not.toBeVisible();
  });

  test("navigate to /dashboard/commands — renders content", async ({
    page,
    request,
  }) => {
    await loginViaSeedAccount(page, request);

    await page.goto("/dashboard/commands");
    await expect(page).toHaveURL(/dashboard\/commands/);

    // Sidebar still visible
    const sidebar = page.locator("nav[aria-label='Dashboard navigation']");
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Commands view renders content (not blank/error)
    const heading = page.getByRole("heading");
    await expect(heading.first()).toBeVisible({ timeout: 10000 });

    // No uncaught error overlay
    await expect(page.locator("text=Something went wrong")).not.toBeVisible();
  });

  test("sidebar navigation links work between views", async ({
    page,
    request,
  }) => {
    await loginViaSeedAccount(page, request);

    // Click on "System Health" nav item via sidebar
    const sidebar = page.locator("nav[aria-label='Dashboard navigation']");
    await sidebar.getByText("System Health").click();
    await expect(page).toHaveURL(/dashboard\/health/, { timeout: 10000 });

    // Click on "Slash Commands" nav item
    await sidebar.getByText("Slash Commands").click();
    await expect(page).toHaveURL(/dashboard\/commands/, { timeout: 10000 });

    // Click back to Overview
    await sidebar.getByText("Overview").click();
    await expect(page).toHaveURL(/dashboard\/overview/, { timeout: 10000 });
  });
});
