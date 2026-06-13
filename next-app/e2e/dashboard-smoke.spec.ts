import { test, expect } from "@playwright/test"
import { loginAs, SEED_ADMIN, SEED_USER } from "./helpers/auth"

test.describe("Dashboard smoke", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, SEED_ADMIN.email, SEED_ADMIN.password)
  })

  test("dashboard page loads with expected heading", async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.locator("h1, h2").first()).toBeVisible()
  })

  test("sidebar is rendered", async ({ page }) => {
    // The shadcn Sidebar primitive renders a <div data-slot="sidebar">, not a
    // <nav> element. Assert on the sidebar slot + a known nav link inside it.
    const sidebar = page.locator('[data-slot="sidebar"]').first()
    await expect(sidebar).toBeVisible()
    await expect(sidebar.locator("a[href='/dashboard']").first()).toBeVisible()
  })

  test("admin user sees admin nav link", async ({ page }) => {
    await expect(page.locator("a[href='/dashboard/admin']")).toBeVisible()
  })

  test("settings page loads", async ({ page }) => {
    await page.goto("/dashboard/settings")
    await expect(page).toHaveURL(/\/dashboard\/settings/)
    await expect(page.locator("h1, h2").first()).toBeVisible()
  })

  test("settings profile form renders name field", async ({ page }) => {
    await page.goto("/dashboard/settings")
    await expect(page.locator('input[name="name"]')).toBeVisible()
  })

  test("settings password form renders current-password field", async ({ page }) => {
    await page.goto("/dashboard/settings")
    await expect(page.locator('input[name="currentPassword"]')).toBeVisible()
  })

  test("admin page lists users", async ({ page }) => {
    await page.goto("/dashboard/admin")
    await expect(page).toHaveURL(/\/dashboard\/admin/)
    // Table should render at least one row (the seed admin)
    await expect(page.locator("table tbody tr").first()).toBeVisible()
  })

  test("admin page shows role selector", async ({ page }) => {
    await page.goto("/dashboard/admin")
    await expect(page.locator("[role='combobox']").first()).toBeVisible()
  })

  test("health endpoint returns ok", async ({ request }) => {
    const resp = await request.get("/api/health")
    expect(resp.ok()).toBeTruthy()
    const body = await resp.json()
    expect(body).toMatchObject({ status: "ok" })
  })
})

test.describe("RBAC — non-admin user", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, SEED_USER.email, SEED_USER.password)
  })

  test("can reach the dashboard", async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test("does NOT see the admin nav link", async ({ page }) => {
    await expect(page.locator("a[href='/dashboard/admin']")).toHaveCount(0)
  })

  test("visiting /dashboard/admin is redirected to /dashboard", async ({ page }) => {
    await page.goto("/dashboard/admin")
    // requireAdmin() in the admin page redirects non-admins to /dashboard
    await expect(page).toHaveURL(/\/dashboard(?!\/admin)/)
  })
})
