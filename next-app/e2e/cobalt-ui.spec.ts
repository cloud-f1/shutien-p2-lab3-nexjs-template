import { test, expect } from "@playwright/test"

import { loginAs, SEED_ADMIN } from "./helpers/auth"

test.describe("Landing page (Cobalt design)", () => {
  test("renders hero + nav anchors", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("h1").first()).toBeVisible()
    // marketing nav anchors (E261/E266)
    await expect(page.locator('a[href="#pricing"]').first()).toBeVisible()
    await expect(page.locator('a[href="#solutions"]').first()).toBeVisible()
  })

  test("pricing section + monthly/yearly toggle", async ({ page }) => {
    await page.goto("/#pricing")
    const pricing = page.locator("#pricing")
    await expect(pricing).toBeVisible()
    // toggle exists and is clickable (E266)
    const yearly = pricing.getByRole("button", { name: /每年/ })
    await expect(yearly).toBeVisible()
    await yearly.click()
    await expect(yearly).toHaveAttribute("aria-pressed", "true")
  })

  test("use-cases + testimonials sections render", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("#solutions")).toBeVisible()
    await expect(page.locator("#testimonials")).toBeVisible()
  })
})

test.describe("Auth split-screen", () => {
  test("login shows the brand testimonial panel on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto("/login")
    await expect(page.getByText("AI App Template").first()).toBeVisible()
    await expect(page.locator("blockquote")).toBeVisible()
  })
})

test.describe("App shell (topbar on all dashboard routes)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, SEED_ADMIN.email, SEED_ADMIN.password)
  })

  test("command palette trigger is present on /dashboard AND /dashboard/settings", async ({ page }) => {
    // E263 + the topbar-in-layout fix: the ⌘K trigger must appear on every route.
    await expect(page.getByRole("button", { name: "開啟命令面板" })).toBeVisible()
    await page.goto("/dashboard/settings")
    await expect(page.getByRole("button", { name: "開啟命令面板" })).toBeVisible()
  })

  test("⌘K opens the command palette", async ({ page }) => {
    await page.keyboard.press("ControlOrMeta+k")
    await expect(page.getByPlaceholder(/輸入指令或搜尋/)).toBeVisible()
  })

  test("notifications dropdown opens", async ({ page }) => {
    await page.getByRole("button", { name: "通知" }).click()
    await expect(page.getByText("通知").first()).toBeVisible()
  })
})

test.describe("Settings tabs", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, SEED_ADMIN.email, SEED_ADMIN.password)
    await page.goto("/dashboard/settings")
  })

  test("tabs switch to Appearance", async ({ page }) => {
    await page.getByRole("tab", { name: "外觀" }).click()
    await expect(page.getByRole("button", { name: /深色 主題/ })).toBeVisible()
  })

  test("profile + password fields are on the default tab", async ({ page }) => {
    // both must be visible without switching tabs (e2e visibility contract)
    await expect(page.locator('input[name="name"]')).toBeVisible()
    await expect(page.locator('input[name="currentPassword"]')).toBeVisible()
  })
})
