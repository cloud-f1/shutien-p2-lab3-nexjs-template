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
    await expect(page.getByText(/welcome back/i)).toBeVisible()
  })

  test("register page loads", async ({ page }) => {
    await page.goto("/register")
    await expect(page.getByText(/create an account/i)).toBeVisible()
  })

  test("register form validates email format client-side", async ({ page }) => {
    await page.goto("/register")
    await page.fill('input[name="email"]', "not-an-email")
    await page.fill('input[name="name"]', "Test")
    await page.fill('input[name="password"]', "Test123!")
    await page.click('button[type="submit"]')
    // RHF should show an inline error without navigating
    await expect(page.locator("text=/invalid email/i")).toBeVisible()
    await expect(page).toHaveURL(/\/register/)
  })

  test("login with seed admin credentials succeeds", async ({ page }) => {
    await page.goto("/login")
    await page.fill('input[name="email"]', SEED_ADMIN.email)
    await page.fill('input[name="password"]', SEED_ADMIN.password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
  })

  test("dashboard shows admin badge for admin user", async ({ page }) => {
    await page.goto("/login")
    await page.fill('input[name="email"]', SEED_ADMIN.email)
    await page.fill('input[name="password"]', SEED_ADMIN.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/)
    await expect(page.locator("text=admin").first()).toBeVisible()
  })

  test("sign out returns to login", async ({ page }) => {
    await page.goto("/login")
    await page.fill('input[name="email"]', SEED_ADMIN.email)
    await page.fill('input[name="password"]', SEED_ADMIN.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/)

    await page.click("text=Sign out")
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })
})
