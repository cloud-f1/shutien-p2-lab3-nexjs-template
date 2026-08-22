import { test, expect, type Page } from "@playwright/test"

import { loginAs, SEED_EDITOR } from "./helpers/auth"

// E338 — mobile viewport (390×844, the iPhone 12/13 mini-class size named in
// the epic) acceptance tests for the responsive list kit: the items list must
// render cards instead of a table below the `md` breakpoint, a card must be
// clickable (opens the edit modal), and the fixed bottom tab bar (E323/E336,
// wired into the dashboard layout by this epic) must not cover list content.
const OVERFLOW_PREFIX = "E338 卡片溢位"

async function createItem(page: Page, title: string) {
  await page.getByRole("button", { name: "新增項目" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await dialog.locator('input[name="title"]').fill(title)
  await dialog.getByRole("button", { name: "建立" }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByText(title, { exact: true })).toBeVisible()
}

/**
 * Deletes every row whose title still starts with OVERFLOW_PREFIX. Run before
 * AND after the overflow test (not just tracked-title cleanup) so it's
 * self-healing against leftovers from a previously interrupted/failed run —
 * the overflow assertion below depends on an exact starting count, so stray
 * leftovers would silently corrupt it otherwise.
 */
async function sweepOverflowItems(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto("/dashboard/items")

  // Show every row on one page (leftovers from a bad run could exceed the
  // default pageSize of 10) so the delete loop below can see them all.
  const pageSizeSelect = page.getByRole("combobox", { name: "每頁列數" })
  await pageSizeSelect.click()
  await page.getByRole("option", { name: "50" }).click()

  for (let guard = 0; guard < 40; guard++) {
    const row = page.getByRole("row", { name: new RegExp(OVERFLOW_PREFIX) }).first()
    if ((await row.count()) === 0) break
    await row.getByRole("button", { name: "刪除" }).click()
    const confirm = page.getByRole("dialog")
    await expect(confirm).toBeVisible()
    await confirm.getByRole("button", { name: "刪除" }).click()
    await expect(confirm).not.toBeVisible()
  }
  await expect(page.getByRole("row", { name: new RegExp(OVERFLOW_PREFIX) })).toHaveCount(0)
}

test.describe("Items list — mobile viewport (E338)", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await loginAs(page, SEED_EDITOR.email, SEED_EDITOR.password)
    await page.goto("/dashboard/items")
  })

  test("renders cards (not a table) below md, and tapping one opens the edit modal", async ({ page }) => {
    // No <table> element at all in mobile-card mode.
    await expect(page.getByRole("table")).toHaveCount(0)

    const cardList = page.locator('[data-slot="data-table-mobile-cards"]')
    await expect(cardList).toBeVisible()

    const firstCard = cardList.getByRole("button").first()
    await expect(firstCard).toBeVisible()

    // Tapping a card opens the edit modal (seeded editor items exist).
    await firstCard.click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(dialog).not.toBeVisible()
  })

  test("a full page of cards genuinely overflows the viewport, and none of it is covered by the fixed tab bar", async ({
    page,
  }) => {
    // The seeded editor account has only 2 items — nowhere near a 390×844
    // fold, so a geometry assertion against that content would pass whether
    // or not the tab-bar-clearance padding exists (a vacuous check). Fill the
    // list to the DataTable's default pageSize (10) so it genuinely overflows
    // and the last card must be scrolled to, making the assertion below one
    // that removing the padding can actually fail.
    await sweepOverflowItems(page)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/dashboard/items")

    try {
      for (let i = 0; i < 8; i++) {
        await createItem(page, `${OVERFLOW_PREFIX} ${Date.now()}-${i}`)
      }

      const cardList = page.locator('[data-slot="data-table-mobile-cards"]')
      const cards = cardList.getByRole("button")
      await expect(cards).toHaveCount(10) // 2 seeded + 8 created = a full default page
      await expect(page.getByText("第 1 / 1 頁")).toBeVisible() // confirms no pagination is hiding cards

      // Confirm the list actually overflows the viewport before trusting the
      // no-overlap assertion below — otherwise this is the same vacuous check
      // this test exists to replace.
      const cardListBox = await cardList.boundingBox()
      expect(cardListBox).not.toBeNull()
      expect(cardListBox!.y + cardListBox!.height).toBeGreaterThan(844)

      // Scroll all the way to the bottom of the document — the true worst
      // case a real user hits — not just "until the last card is visible"
      // (`scrollIntoViewIfNeeded()` stops at the minimum scroll distance,
      // which can leave slack above the fold and make this assertion pass
      // regardless of whether tab-bar-clearance padding exists).
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

      // The pagination footer's "下一頁" button — not the last card, and not
      // the "共 N 筆" text next to it — is the true bottom-most content on
      // the page: the footer row is `items-center`, so the short text label
      // sits vertically centered *above* the taller 32px nav buttons beside
      // it. Both the last-card version of this assertion and a "共 N 筆"-text
      // version stayed green after removing `pb-16` in manual testing (proof
      // below in the epic summary) because neither actually reaches the
      // lowest real pixel on the page — only this button does.
      const footer = page.getByRole("button", { name: "下一頁" })
      await footer.scrollIntoViewIfNeeded()

      // The breadcrumb also renders a "項目" link/listitem on this page, so
      // scope to the fixed bottom nav specifically rather than searching by
      // link text (which resolves to 2+ elements — a Playwright strict-mode
      // violation).
      const tabBar = page.locator("nav.fixed.inset-x-0.bottom-0")
      await expect(tabBar).toBeVisible()
      await expect(tabBar.getByRole("link", { name: "項目" })).toBeVisible()

      const footerBox = await footer.boundingBox()
      const tabBarBox = await tabBar.boundingBox()
      expect(footerBox).not.toBeNull()
      expect(tabBarBox).not.toBeNull()
      // The footer's bottom edge must be at or above the tab bar's top edge.
      expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(tabBarBox!.y + 1)
    } finally {
      // Desktop-width cleanup — the mobile card has no delete affordance —
      // so the shared seed DB isn't left polluted for other e2e specs (same
      // convention as items-crud.spec.ts), regardless of whether the
      // assertions above passed or threw.
      await sweepOverflowItems(page)
    }
  })
})
