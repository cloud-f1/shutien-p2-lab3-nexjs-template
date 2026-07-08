// @vitest-environment jsdom
/**
 * item-form.test.tsx — the Dialog-form reference component test (E321).
 *
 * `ItemForm` is what `ItemDialog` (app/(dashboard)/dashboard/items/_item-dialog.tsx)
 * renders inside its shadcn `<Dialog>` — CRUD modals close via the form's
 * `onSuccess` callback, never a redirect (see CLAUDE.md's CRUD-modal convention).
 * This locks that wiring: the action's `null` (success) / `{ error }` shapes must
 * drive `onSuccess` vs. an inline error, and client Zod validation must block a
 * blank submit before the Server Action is ever called.
 *
 * `@/actions/items` has a top-level `"use server"` + `import { db } from
 * "@/lib/db"`, which throws under plain vitest without DATABASE_URL — so the
 * action module is mocked here (component tests never touch a real DB; that is
 * the integration layer's job — see test/int/items.int.test.ts).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mockCreateItem = vi.fn()
const mockUpdateItem = vi.fn()
vi.mock("@/actions/items", () => ({
  createItem: (...args: unknown[]) => mockCreateItem(...args),
  updateItem: (...args: unknown[]) => mockUpdateItem(...args),
}))

const { ItemForm } = await import("@/app/(dashboard)/dashboard/items/_item-form")

describe("ItemForm (the Dialog form ItemDialog renders)", () => {
  beforeEach(() => {
    mockCreateItem.mockReset()
    mockUpdateItem.mockReset()
  })

  it("action returns null (success) → calls onSuccess with the typed title", async () => {
    mockCreateItem.mockResolvedValue(null)
    const onSuccess = vi.fn()
    const user = userEvent.setup()

    render(<ItemForm submitLabel="建立" onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText("標題"), "New Widget")
    await user.click(screen.getByRole("button", { name: "建立" }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(mockCreateItem).toHaveBeenCalledTimes(1)
    const submittedFormData = mockCreateItem.mock.calls[0][1] as FormData
    expect(submittedFormData.get("title")).toBe("New Widget")
  })

  it("action returns { error } → shows the message inline and never calls onSuccess", async () => {
    mockCreateItem.mockResolvedValue({ error: "找不到項目，或您沒有權限刪除。" })
    const onSuccess = vi.fn()
    const user = userEvent.setup()

    render(<ItemForm submitLabel="建立" onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText("標題"), "Blocked Widget")
    await user.click(screen.getByRole("button", { name: "建立" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("找不到項目，或您沒有權限刪除。")
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it("client-side Zod validation blocks a blank title — the Server Action is never called", async () => {
    const user = userEvent.setup()
    render(<ItemForm submitLabel="建立" />)

    await user.click(screen.getByRole("button", { name: "建立" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("請輸入標題")
    expect(mockCreateItem).not.toHaveBeenCalled()
  })
})
