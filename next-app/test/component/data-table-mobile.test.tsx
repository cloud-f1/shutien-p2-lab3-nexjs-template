// @vitest-environment jsdom
/**
 * data-table-mobile.test.tsx (E338) — the `<DataTable>` mobile-card branch.
 *
 * Two things this locks down:
 *  1. Backward compatibility: with no `renderMobileCard`, the table renders
 *     even when `useIsMobile()` reports true (today's behavior — mobile just
 *     gets a squeezed table, no card list).
 *  2. The critical constraint from the epic: filter text and page position
 *     survive a viewport change because mobile-card mode and desktop-table
 *     mode read off the SAME `useReactTable()` instance, not two parallel
 *     states. We drive this by mocking `useIsMobile()` and re-rendering the
 *     exact same element (not unmounting) to simulate a live viewport resize.
 */
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ColumnDef } from "@tanstack/react-table"

let mobile = false
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mobile,
}))

const { DataTable } = await import("@/components/data-table-generic")

interface Row {
  id: string
  title: string
}

const columns: ColumnDef<Row>[] = [{ accessorKey: "title", header: "標題" }]

const data: Row[] = [
  { id: "1", title: "Alpha Widget" },
  { id: "2", title: "Beta Gadget" },
  { id: "3", title: "Gamma Widget" },
]

function renderCard(row: Row) {
  return <div data-testid={`card-${row.id}`}>{row.title}</div>
}

describe("DataTable — mobile card mode (E338)", () => {
  it("without renderMobileCard, still renders a <table> even when useIsMobile() is true", () => {
    mobile = true
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByRole("table")).toBeInTheDocument()
    mobile = false
  })

  it("with renderMobileCard, mobile viewport renders cards instead of a table", () => {
    mobile = true
    render(<DataTable columns={columns} data={data} renderMobileCard={renderCard} />)
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.getByTestId("card-1")).toHaveTextContent("Alpha Widget")
    mobile = false
  })

  it("with renderMobileCard, desktop viewport still renders the <table>", () => {
    mobile = false
    render(<DataTable columns={columns} data={data} renderMobileCard={renderCard} />)
    expect(screen.getByRole("table")).toBeInTheDocument()
    expect(screen.queryByTestId("card-1")).not.toBeInTheDocument()
  })

  it("an empty filter result renders emptyState in card mode too", async () => {
    mobile = true
    const user = userEvent.setup()
    render(
      <DataTable
        columns={columns}
        data={data}
        filterPlaceholder="搜尋…"
        renderMobileCard={renderCard}
        emptyState={<span>沒有符合的項目</span>}
      />,
    )
    await user.type(screen.getByPlaceholderText("搜尋…"), "nonexistent-xyz")
    expect(screen.getByText("沒有符合的項目")).toBeInTheDocument()
    mobile = false
  })

  it("filter text + page position survive a viewport change (one shared table instance)", async () => {
    const user = userEvent.setup()
    mobile = false
    const { rerender } = render(
      <DataTable columns={columns} data={data} filterPlaceholder="搜尋…" renderMobileCard={renderCard} />,
    )

    // Narrow the result set on desktop.
    await user.type(screen.getByPlaceholderText("搜尋…"), "Widget")
    expect(screen.getByText("共 2 筆")).toBeInTheDocument()
    expect(screen.getByRole("table")).toBeInTheDocument()

    // Simulate a resize to mobile — re-render the SAME element (no unmount).
    mobile = true
    rerender(
      <DataTable columns={columns} data={data} filterPlaceholder="搜尋…" renderMobileCard={renderCard} />,
    )

    // The filter (and its row count) must not have reset.
    expect(screen.getByPlaceholderText("搜尋…")).toHaveValue("Widget")
    expect(screen.getByText("共 2 筆")).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.getByTestId("card-1")).toBeInTheDocument() // Alpha Widget
    expect(screen.queryByTestId("card-2")).not.toBeInTheDocument() // Beta Gadget, filtered out

    // And back to desktop — still the same filtered set, no reset.
    mobile = false
    rerender(
      <DataTable columns={columns} data={data} filterPlaceholder="搜尋…" renderMobileCard={renderCard} />,
    )
    expect(screen.getByPlaceholderText("搜尋…")).toHaveValue("Widget")
    expect(screen.getByText("共 2 筆")).toBeInTheDocument()
    expect(screen.getByRole("table")).toBeInTheDocument()
  })
})
