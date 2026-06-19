#!/usr/bin/env node
/*
 * tour-app.cjs — logged-in Playwright tour of the RUNNING AI App Template (Next.js),
 * capturing per-page / per-tab / per-modal screenshots for the user guide builder
 * skill (user-guide-builder) and the mockup-to-epics pipeline.
 *
 * Unlike scripts/mockup/shot.cjs (static HTML mockup via file://), this drives the live
 * Next.js app at http://localhost:3000: it logs in via email+password (Auth.js Credentials),
 * walks every dashboard page and every tab/section/modal, and writes PNGs to
 * dev-docs/public/screenshots/.
 *
 * Login credentials (this template uses email + password, not badge number):
 *   Admin:  admin@example.com  / Admin123!
 *   Editor: editor@example.com / Editor123!
 *   Viewer: viewer@example.com / Viewer123!
 *
 * Prereq: app running (`docker compose up --build -d` or `pnpm dev`) on :3000
 *         with demo data seeded (`pnpm db:seed`).
 * Usage:  node scripts/mockup/tour-app.cjs [baseURL]   (default http://localhost:3000)
 *
 * Each step is isolated in try/catch so one missing element never aborts the tour;
 * the run prints a ✓/✗ ledger so a failed shot is visible, not silently skipped.
 */
const fs = require('fs')
const path = require('path')

function resolvePlaywright() {
  const root = path.resolve(__dirname, '..', '..', 'next-app')
  const candidates = [
    path.join(root, 'node_modules', 'playwright-core', 'index.js'),
    path.join(root, 'node_modules', 'playwright', 'index.js'),
  ]
  const pnpmDir = path.join(root, 'node_modules', '.pnpm')
  if (fs.existsSync(pnpmDir)) {
    for (const d of fs.readdirSync(pnpmDir)) {
      if (d.startsWith('playwright-core@')) {
        candidates.push(path.join(pnpmDir, d, 'node_modules', 'playwright-core', 'index.js'))
      }
    }
  }
  for (const c of candidates) if (fs.existsSync(c)) return c
  throw new Error('playwright-core not found under next-app/. Run `pnpm install` in next-app first.')
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const OUT = path.resolve(__dirname, '..', '..', 'dev-docs', 'public', 'screenshots')
const BASE = process.argv[2] || 'http://localhost:3000'
const ledger = []

async function main() {
  const { chromium } = require(resolvePlaywright())
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()

  // helper: screenshot full page
  const shot = async (name, opts = {}) => {
    try {
      await sleep(opts.wait ?? 700)
      await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: opts.fullPage ?? true })
      ledger.push(`✓ ${name}`)
    } catch (e) {
      ledger.push(`✗ ${name} — ${e.message.split('\n')[0]}`)
    }
  }
  const go = async (url) => { await page.goto(BASE + url, { waitUntil: 'networkidle' }).catch(() => {}) }
  const clickText = async (txt) => {
    try { await page.getByText(txt, { exact: false }).first().click({ timeout: 4000 }); await sleep(600); return true }
    catch { return false }
  }
  const clickRole = async (role, name) => {
    try { await page.getByRole(role, { name, exact: false }).first().click({ timeout: 4000 }); await sleep(600); return true }
    catch { return false }
  }

  // Login via email + password (Auth.js Credentials — this template's login form)
  const login = async (email, password) => {
    await go('/login')
    // Auth.js Credentials login form uses email + password inputs
    await page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 25000 })
    // Try name="email" first, fall back to type="email"
    const emailInput = page.locator('input[name="email"]').first()
    const emailAlt = page.locator('input[type="email"]').first()
    if (await emailInput.count() > 0) {
      await emailInput.fill(email)
    } else {
      await emailAlt.fill(email)
    }
    await page.fill('input[name="password"], input[type="password"]', password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**', { timeout: 20000 }).catch(() => {})
    await sleep(1000)
  }

  // ── 0. Login screen (logged out) ──────────────────────────────────
  await go('/login')
  await shot('00-login', { fullPage: false })

  // ── Admin — full surface ───────────────────────────────────────────
  await login('admin@example.com', 'Admin123!')

  await go('/dashboard')
  await shot('01-dashboard')

  await go('/dashboard/items')
  await shot('02-items')

  // new-item create modal (CRUD pattern: ?new=1 opens modal)
  await go('/dashboard/items?new=1')
  await sleep(800)
  await shot('03-items-new-modal', { fullPage: false })
  await page.keyboard.press('Escape').catch(() => {})

  await go('/dashboard/settings')
  await shot('04-settings')

  await go('/dashboard/system')
  await shot('05-system')

  await go('/dashboard/admin')
  await shot('06-admin')

  // account settings
  await go('/dashboard/account')
  await shot('07-account')

  // ── Editor — restricted view (no admin) ───────────────────────────
  await ctx.clearCookies()
  await login('editor@example.com', 'Editor123!')
  await go('/dashboard')
  await shot('11-editor-dashboard')
  await go('/dashboard/items')
  await shot('12-editor-items')

  // ── Viewer — read-only (no create button) ─────────────────────────
  await ctx.clearCookies()
  await login('viewer@example.com', 'Viewer123!')
  await go('/dashboard')
  await shot('21-viewer-dashboard')
  await go('/dashboard/items')
  await shot('22-viewer-items')

  // ── Mobile (admin) ────────────────────────────────────────────────
  await ctx.close()
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 })
  const mpage = await mctx.newPage()
  const mlogin = async () => {
    await mpage.goto(BASE + '/login', { waitUntil: 'networkidle' }).catch(() => {})
    await mpage.waitForSelector('input[name="email"], input[type="email"]', { timeout: 25000 })
    const emailInput = mpage.locator('input[name="email"]').first()
    if (await emailInput.count() > 0) {
      await emailInput.fill('admin@example.com')
    } else {
      await mpage.fill('input[type="email"]', 'admin@example.com')
    }
    await mpage.fill('input[name="password"], input[type="password"]', 'Admin123!')
    await mpage.click('button[type="submit"]')
    await mpage.waitForURL('**/dashboard**', { timeout: 15000 }).catch(() => {})
    await sleep(800)
  }
  await mlogin()
  await mpage.goto(BASE + '/dashboard', { waitUntil: 'networkidle' }).catch(() => {})
  await sleep(700)
  await mpage.screenshot({ path: path.join(OUT, '30-mobile-dashboard.png'), fullPage: true })
    .then(() => ledger.push('✓ 30-mobile-dashboard'))
    .catch((e) => ledger.push('✗ 30-mobile-dashboard — ' + e.message.split('\n')[0]))
  await mpage.goto(BASE + '/dashboard/items', { waitUntil: 'networkidle' }).catch(() => {})
  await sleep(700)
  await mpage.screenshot({ path: path.join(OUT, '31-mobile-items.png'), fullPage: true })
    .then(() => ledger.push('✓ 31-mobile-items'))
    .catch((e) => ledger.push('✗ 31-mobile-items — ' + e.message.split('\n')[0]))

  await browser.close()
  console.log('\n=== tour ledger ===')
  console.log(ledger.join('\n'))
  console.log(`\n${ledger.filter((l) => l.startsWith('✓')).length} captured, ${ledger.filter((l) => l.startsWith('✗')).length} failed → ${OUT}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
