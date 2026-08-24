/**
 * E307 — TOTP 2FA end-to-end tests.
 *
 * Covers the full 2FA flow (E297 implementation):
 *   1. Enable 2FA from Settings → Security (QR / manual secret, verify in-test code)
 *   2. Log out → log in with password → assert redirect to /login/2fa challenge
 *   3. Enter a valid TOTP code → assert dashboard landing
 *   4. Backup-code login path (single-use enforcement)
 *   5. Negative: wrong code stays on /login/2fa with an error
 *
 * TOTP codes are computed in-test via otplib (same library used by totp-utils.ts),
 * so the test never needs a real authenticator app.
 *
 * User lifecycle: tests use SEED_EDITOR (editor@example.com / Editor123!) as the
 * 2FA subject so the admin account remains clean for other specs. Each test that
 * enables 2FA disables it in an afterEach teardown to keep the DB clean between runs.
 */
import { test, expect } from "@playwright/test"
import { generateSync } from "otplib"

import { SEED_EDITOR } from "./helpers/auth"

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Compute the current TOTP token for a given base32 secret (matches totp-utils.ts). */
function liveTotpCode(secret: string): string {
  return generateSync({ secret, strategy: "totp", period: 30 })
}

/**
 * The form's OWN error alert. Next.js renders a persistent
 * `#__next-route-announcer__` with `role="alert"` on every page, so a bare
 * getByRole("alert") resolves to it (or to both) and trips strict mode.
 */
function formAlert(page: import("@playwright/test").Page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)')
}

/** Log in with email + password (does NOT wait for dashboard — caller decides). */
async function fillLoginForm(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("/login")
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
}

// ─── shared state (captured during "enable 2FA" test, used in later tests) ───

let capturedSecret = ""
let capturedBackupCodes: string[] = []

// ─── suite ───────────────────────────────────────────────────────────────────

/**
 * These tests MUST run in order because each one depends on state left by the
 * previous one (2FA enabled, backup codes captured, etc.). Playwright serialises
 * tests within a describe block in source order by default; we also disable
 * parallel execution for this suite to be safe.
 */
test.describe.serial("Two-Factor Authentication (TOTP)", () => {
  /**
   * Disable 2FA ONCE, after the whole serial chain, so the seed user is left clean.
   *
   * This deliberately is NOT an afterEach: every test from #2 onward depends on the
   * state test #1 leaves behind (2FA enabled + capturedSecret). Tearing down after
   * each test cleared exactly that state and broke the chain at test #2. Per-run
   * cleanliness is guaranteed by `pnpm db:e2e-setup` (drop → create → migrate →
   * seed) anyway; this teardown is just politeness for a re-run against a live DB.
   */
  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage()
    try {
      // Need a valid TOTP code to disable — without the secret we cannot clean up.
      if (!capturedSecret) return

      await page.goto("/login")
      await page.fill('input[name="email"]', SEED_EDITOR.email)
      await page.fill('input[name="password"]', SEED_EDITOR.password)
      await page.click('button[type="submit"]')
      // 2FA is on, so password login lands on the challenge — clear it with a code.
      await page.waitForURL(/\/login\/2fa/, { timeout: 10000 })
      await page.fill('input[id="token"]', liveTotpCode(capturedSecret))
      await page.getByRole("button", { name: "驗證", exact: true }).click()
      await page.waitForURL(/\/dashboard/, { timeout: 10000 })

      await page.goto("/dashboard/settings", { timeout: 5000 })

      // "停用 2FA" lives INSIDE the 安全性 tab panel, so the tab must be opened
      // BEFORE probing for the button — checking first always saw it hidden and
      // returned early, leaving 2FA enabled on the seed user and breaking the
      // next run's password login (it redirects to /login/2fa).
      await page.getByRole("tab", { name: "安全性" }).click()
      const disableBtnSecurity = page.getByRole("button", { name: "停用 2FA" })
      const isSecurityVisible = await disableBtnSecurity
        .isVisible()
        .catch(() => false)
      if (!isSecurityVisible) return

      await disableBtnSecurity.click()

      // ConfirmDialog input for the TOTP code
      const disableInput = page.locator('input[inputmode="numeric"]').last()
      await disableInput.fill(liveTotpCode(capturedSecret))
      await page.getByRole("button", { name: "停用" }).last().click()

      // Wait for the "啟用 2FA" button to reappear
      await expect(page.getByRole("button", { name: "啟用 2FA" })).toBeVisible({ timeout: 5000 })

      // Reset captured state
      capturedSecret = ""
      capturedBackupCodes = []
    } catch {
      // Best-effort cleanup — don't fail the run on teardown errors
    } finally {
      await page.close()
    }
  })

  // ── 1. Enable 2FA ─────────────────────────────────────────────────────────

  test("enable 2FA from Settings → Security", async ({ page }) => {
    // Log in as editor
    await page.goto("/login")
    await page.fill('input[name="email"]', SEED_EDITOR.email)
    await page.fill('input[name="password"]', SEED_EDITOR.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })

    // Navigate to Settings → Security tab
    await page.goto("/dashboard/settings")
    await page.getByRole("tab", { name: "安全性" }).click()

    // Should show "尚未啟用" status and "啟用 2FA" button
    await expect(page.getByText("尚未啟用")).toBeVisible()
    await page.getByRole("button", { name: "啟用 2FA" }).click()

    // Setup dialog opens with QR code and manual secret
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText("設定兩步驟驗證")).toBeVisible()

    // Capture the manual secret from the <code> block
    const secretEl = dialog.locator("code")
    await expect(secretEl).toBeVisible()
    const secret = (await secretEl.textContent()) ?? ""
    expect(secret.length).toBeGreaterThan(10)
    capturedSecret = secret.trim()

    // Compute a live TOTP code and enter it
    const token = liveTotpCode(capturedSecret)
    await dialog.locator('input[id="totp-setup-token"]').fill(token)
    await dialog.getByRole("button", { name: "啟用" }).click()

    // Backup codes dialog appears
    const backupDialog = page.getByRole("dialog")
    await expect(backupDialog.getByRole("heading", { name: "備用碼" })).toBeVisible({
      timeout: 8000,
    })

    // Capture backup codes from the grid
    const codeSpans = backupDialog.locator(".font-mono span")
    const count = await codeSpans.count()
    expect(count).toBe(10)
    capturedBackupCodes = []
    for (let i = 0; i < count; i++) {
      const code = (await codeSpans.nth(i).textContent()) ?? ""
      capturedBackupCodes.push(code.trim())
    }
    expect(capturedBackupCodes[0]).toMatch(/[a-z0-9]{4}-[a-z0-9]{4}/)

    // Dismiss backup codes dialog
    await backupDialog.getByRole("button", { name: "我已儲存" }).click()

    // Status should now show "已啟用"
    await expect(page.getByText("已啟用")).toBeVisible({ timeout: 5000 })
  })

  // ── 2. Login with password → 2FA challenge redirect ───────────────────────

  test("login with password redirects to /login/2fa when 2FA is enabled", async ({ page }) => {
    // Ensure we have a captured secret (means 2FA was enabled in previous test)
    expect(capturedSecret).toBeTruthy()

    await fillLoginForm(page, SEED_EDITOR.email, SEED_EDITOR.password)

    // Should redirect to the 2FA challenge page, NOT dashboard
    await expect(page).toHaveURL(/\/login\/2fa/, { timeout: 10000 })
    // exact: true — Next.js's route announcer also renders "兩步驟驗證 · <app name>",
    // so a substring match resolves to 2 elements and trips strict mode.
    await expect(page.getByText("兩步驟驗證", { exact: true })).toBeVisible()
  })

  // ── 3. Valid TOTP code → dashboard ────────────────────────────────────────

  test("valid TOTP code on /login/2fa completes login and lands on dashboard", async ({ page }) => {
    expect(capturedSecret).toBeTruthy()

    // Trigger the 2FA challenge
    await fillLoginForm(page, SEED_EDITOR.email, SEED_EDITOR.password)
    await expect(page).toHaveURL(/\/login\/2fa/, { timeout: 10000 })

    // Fill the 6-digit token
    const token = liveTotpCode(capturedSecret)
    await page.fill('input[id="token"]', token)

    // Submit by clicking the button (not Enter, to match the form's onSubmit handler)
    await page.getByRole("button", { name: "驗證", exact: true }).click()

    // Should land on dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
  })

  // ── 4. Negative: wrong TOTP code stays on /login/2fa with error ───────────

  test("wrong TOTP code stays on /login/2fa with an error message", async ({ page }) => {
    expect(capturedSecret).toBeTruthy()

    await fillLoginForm(page, SEED_EDITOR.email, SEED_EDITOR.password)
    await expect(page).toHaveURL(/\/login\/2fa/, { timeout: 10000 })

    // Enter a clearly wrong code
    await page.fill('input[id="token"]', "000000")
    await page.getByRole("button", { name: "驗證", exact: true }).click()

    // Should stay on /login/2fa with an error
    await expect(page).toHaveURL(/\/login\/2fa/)
    await expect(formAlert(page)).toBeVisible()
    await expect(formAlert(page)).toContainText("驗證碼錯誤")
  })

  // ── 5. Backup-code login path (single-use) ────────────────────────────────

  test("backup code on /login/2fa (改用備用碼 mode) completes login", async ({ page }) => {
    expect(capturedBackupCodes.length).toBeGreaterThan(0)

    await fillLoginForm(page, SEED_EDITOR.email, SEED_EDITOR.password)
    await expect(page).toHaveURL(/\/login\/2fa/, { timeout: 10000 })

    // Switch to backup-code mode
    await page.getByRole("button", { name: "改用備用碼" }).click()
    await expect(page.getByText("請輸入一組備用碼")).toBeVisible()

    // Use the first backup code
    const backupCode = capturedBackupCodes[0]
    await page.fill('input[id="code"]', backupCode)
    await page.getByRole("button", { name: "驗證", exact: true }).click()

    // Should land on dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
  })

  test("backup code is single-use — second use returns an error", async ({ page }) => {
    expect(capturedBackupCodes.length).toBeGreaterThan(0)

    await fillLoginForm(page, SEED_EDITOR.email, SEED_EDITOR.password)
    await expect(page).toHaveURL(/\/login\/2fa/, { timeout: 10000 })

    // Switch to backup mode and reuse the SAME backup code (already consumed above)
    await page.getByRole("button", { name: "改用備用碼" }).click()
    const usedCode = capturedBackupCodes[0]
    await page.fill('input[id="code"]', usedCode)
    await page.getByRole("button", { name: "驗證", exact: true }).click()

    // Should stay on /login/2fa with an error
    await expect(page).toHaveURL(/\/login\/2fa/)
    await expect(formAlert(page)).toBeVisible()
    await expect(formAlert(page)).toContainText("備用碼無效或已使用")
  })
})
