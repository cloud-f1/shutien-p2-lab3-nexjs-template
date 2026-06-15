import { test, expect } from "@playwright/test"
import { loginAs, SEED_ADMIN, SEED_EDITOR, SEED_VIEWER } from "./helpers/auth"

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

test.describe("RBAC — viewer (read-only, non-admin)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, SEED_VIEWER.email, SEED_VIEWER.password)
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

  test("does NOT see any New Item affordance (read-only)", async ({ page }) => {
    // Create is modal-based (?new=1); viewers (canEdit=false) get no entry
    // point — no sidebar/dashboard create link.
    await expect(page.locator("a[href='/dashboard/items?new=1']")).toHaveCount(0)
  })

  test("can view the items list but sees no create button", async ({ page }) => {
    // Viewers may read their own items list (requireAuth), but the toolbar
    // "新增項目" button is gated by canEdit() and must not render.
    await page.goto("/dashboard/items")
    await expect(page).toHaveURL(/\/dashboard\/items/)
    await expect(page.locator("h1, h2").first()).toBeVisible()
    await expect(page.getByRole("button", { name: "新增項目" })).toHaveCount(0)
  })
})

test.describe("RBAC — editor (can edit, non-admin)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, SEED_EDITOR.email, SEED_EDITOR.password)
  })

  test("can reach the dashboard", async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test("does NOT see the admin nav link", async ({ page }) => {
    await expect(page.locator("a[href='/dashboard/admin']")).toHaveCount(0)
  })

  test("visiting /dashboard/admin is redirected to /dashboard", async ({ page }) => {
    await page.goto("/dashboard/admin")
    await expect(page).toHaveURL(/\/dashboard(?!\/admin)/)
  })

  test("DOES see a New Item affordance", async ({ page }) => {
    // Editors can create items — at least one create entry point (the ?new=1
    // modal link in the sidebar / dashboard header) renders.
    await expect(page.locator("a[href='/dashboard/items?new=1']").first()).toBeVisible()
  })

  test("can reach /dashboard/items and see a create button", async ({ page }) => {
    await page.goto("/dashboard/items")
    await expect(page).toHaveURL(/\/dashboard\/items/)
    await expect(page.getByRole("button", { name: "新增項目" })).toBeVisible()
  })

  test("opening the create modal shows the form", async ({ page }) => {
    // Editors pass requireEditor(); ?new=1 auto-opens the create Dialog, so the
    // title field renders inside the modal (no standalone /create page anymore).
    await page.goto("/dashboard/items?new=1")
    await expect(page).toHaveURL(/\/dashboard\/items/)
    await expect(page.locator('input[name="title"]')).toBeVisible()
  })
})
