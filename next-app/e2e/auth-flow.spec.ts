import { test, expect } from "@playwright/test"
import { SEED_ADMIN } from "./helpers/auth"

test.describe("Auth flow", () => {
  test("unauthenticated visit to /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login/)
  })

  test("login page loads", async ({ page }) => {
    await page.goto("/login")
    // shadcn CardTitle renders as <div data-slot="card-title">, not a heading —
    // assert on the visible text instead of an h1/h2 selector.
    await expect(page.getByText("歡迎回來")).toBeVisible()
  })

  test("register page loads", async ({ page }) => {
    await page.goto("/register")
    await expect(page.getByText("建立帳戶").first()).toBeVisible()
  })

  test("register form validates email format client-side", async ({ page }) => {
    await page.goto("/register")
    await page.fill('input[name="email"]', "not-an-email")
    await page.fill('input[name="name"]', "Test")
    await page.fill('input[name="password"]', "Test123!")
    await page.click('button[type="submit"]')
    // RHF should show an inline error without navigating
    await expect(page.getByText("電子郵件格式不正確")).toBeVisible()
    await expect(page).toHaveURL(/\/register/)
  })

  test("login with seed admin credentials succeeds", async ({ page }) => {
    await page.goto("/login")
    await page.fill('input[name="email"]', SEED_ADMIN.email)
    await page.fill('input[name="password"]', SEED_ADMIN.password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
  })

  test("admin user has admin access in the new sidebar UI", async ({ page }) => {
    await page.goto("/login")
    await page.fill('input[name="email"]', SEED_ADMIN.email)
    await page.fill('input[name="password"]', SEED_ADMIN.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/)
    // The sidebar-01 layout no longer renders a standalone "admin" role badge.
    // An admin's privileged status is surfaced via the Admin nav link, which
    // is only rendered for users whose role is "admin" (see AppSidebar).
    // Scope to the SIDEBAR nav link. E337's admin-only stat card ("已驗證使用者")
    // also links to /dashboard/admin, so a bare href selector matches two
    // elements and trips Playwright strict mode. Both links are correct — the
    // test just has to say which one it means.
    await expect(
      page.locator("a[data-sidebar='menu-button'][href='/dashboard/admin']"),
    ).toBeVisible()
  })

  test("sign out returns to login", async ({ page }) => {
    await page.goto("/login")
    await page.fill('input[name="email"]', SEED_ADMIN.email)
    await page.fill('input[name="password"]', SEED_ADMIN.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/)

    // Sign-out now lives inside the nav-user dropdown (components/nav-user.tsx):
    // open the dropdown via the footer trigger, then click the "Log out" item,
    // which submits a <form action={handleSignOut}>.
    await page
      .locator('[data-slot="sidebar-footer"] button[data-slot="dropdown-menu-trigger"]')
      .click()
    await page.getByRole("menuitem", { name: "登出" }).click()
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
  })
})
