// @vitest-environment jsdom
/**
 * filter-chip.test.tsx (E338) — `<FilterChip>` a11y/interaction + the
 * `useFilterChipQuery` URL-sync hook that backs the items list's quick
 * filters (`?status=` — the exact param name this epic defines for E337 to
 * consume later).
 */
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const replaceMock = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/dashboard/items",
}))

const { FilterChip, FilterChipBar, useFilterChipQuery } = await import("@/components/filter-chip")

function Harness({ initial }: { initial?: string }) {
  const [status, setStatus] = useFilterChipQuery("status", initial)
  return (
    <FilterChipBar>
      <FilterChip active={status === undefined} onClick={() => setStatus(undefined)}>
        全部
      </FilterChip>
      <FilterChip active={status === "edited"} tone="info" onClick={() => setStatus("edited")}>
        已編輯
      </FilterChip>
      <FilterChip active={status === "new"} onClick={() => setStatus("new")}>
        未編輯
      </FilterChip>
    </FilterChipBar>
  )
}

describe("FilterChip", () => {
  it("is a real, keyboard-reachable <button> that reflects active state via aria-pressed", () => {
    render(
      <FilterChip active onClick={() => {}}>
        已編輯
      </FilterChip>,
    )
    const chip = screen.getByRole("button", { name: "已編輯" })
    expect(chip).toHaveAttribute("aria-pressed", "true")
    expect(chip.tagName).toBe("BUTTON")
  })
})

describe("useFilterChipQuery — chip ↔ URL query sync", () => {
  it("opening with ?status=edited already shows that chip as selected", () => {
    render(<Harness initial="edited" />)
    expect(screen.getByRole("button", { name: "已編輯" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "全部" })).toHaveAttribute("aria-pressed", "false")
  })

  it("clicking a chip updates the URL via the `status` query param and flips active state", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole("button", { name: "已編輯" }))

    expect(replaceMock).toHaveBeenCalledWith("/dashboard/items?status=edited", { scroll: false })
    expect(screen.getByRole("button", { name: "已編輯" })).toHaveAttribute("aria-pressed", "true")
  })

  it("clicking 全部 (undefined) removes the query param entirely", async () => {
    const user = userEvent.setup()
    replaceMock.mockClear()
    render(<Harness initial="edited" />)

    await user.click(screen.getByRole("button", { name: "全部" }))

    expect(replaceMock).toHaveBeenCalledWith("/dashboard/items", { scroll: false })
    expect(screen.getByRole("button", { name: "全部" })).toHaveAttribute("aria-pressed", "true")
  })
})
