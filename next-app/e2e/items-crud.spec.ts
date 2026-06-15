import { test, expect } from "@playwright/test"

import { loginAs, SEED_EDITOR } from "./helpers/auth"

// E273 — Items CRUD is modal-based (create/edit/delete) over a paginated,
// filterable DataTable. This drives the full modal loop as an editor and cleans
// up after itself so the shared seed DB isn't polluted.
test.describe("Items CRUD (modals + data table)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, SEED_EDITOR.email, SEED_EDITOR.password)
    await page.goto("/dashboard/items")
  })

  test("create → appears in table → delete via confirm modal", async ({ page }) => {
    const title = `E2E 測試項目 ${Date.now()}`

    // Create via modal (no page navigation)
    await page.getByRole("button", { name: "新增項目" }).click()
    const createDialog = page.getByRole("dialog")
    await expect(createDialog).toBeVisible()
    await createDialog.locator('input[name="title"]').fill(title)
    await createDialog.getByRole("button", { name: "建立" }).click()

    // URL stays on the list; the new row shows up
    await expect(page).toHaveURL(/\/dashboard\/items/)
    await expect(page.getByText(title)).toBeVisible()

    // Filter narrows the table to the new row
    await page.getByPlaceholder("搜尋項目…").fill(title)
    await expect(page.getByText(title)).toBeVisible()
    await page.getByPlaceholder("搜尋項目…").clear()

    // Delete via the confirm modal
    const row = page.getByRole("row", { name: new RegExp(title) })
    await row.getByRole("button", { name: "刪除" }).click()
    const confirm = page.getByRole("dialog")
    await expect(confirm).toBeVisible()
    await confirm.getByRole("button", { name: "刪除" }).click()

    await expect(page.getByText(title)).toHaveCount(0)
  })

  test("data table shows pagination controls + page-size selector", async ({ page }) => {
    await expect(page.getByText(/共 \d+ 筆/)).toBeVisible()
    await expect(page.getByText(/第 \d+ \/ \d+ 頁/)).toBeVisible()
    await expect(page.getByLabel("每頁列數")).toBeVisible()
  })
})
