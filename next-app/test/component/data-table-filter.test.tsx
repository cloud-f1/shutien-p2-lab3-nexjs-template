// @vitest-environment jsdom
/**
 * data-table-filter.test.tsx — the reusable `<DataTable>` (E273 list-view
 * convention, components/data-table-generic.tsx) reference component test.
 *
 * Every domain list view (items, users, api-keys, …) renders through this one
 * component, so its filter/pagination wiring is high-leverage: a regression
 * here silently breaks every list page's search box at once. This locks the
 * global-filter → visible-rows → row-count wiring with plain data, independent
 * of any one domain's columns.
 */
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table-generic"

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

describe("DataTable — global filter", () => {
  it("typing into the filter box narrows visible rows and updates the row count", async () => {
    const user = userEvent.setup()
    render(<DataTable columns={columns} data={data} filterPlaceholder="搜尋…" />)

    expect(screen.getByText("Alpha Widget")).toBeInTheDocument()
    expect(screen.getByText("Beta Gadget")).toBeInTheDocument()
    expect(screen.getByText("Gamma Widget")).toBeInTheDocument()
    expect(screen.getByText("共 3 筆")).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText("搜尋…"), "Widget")

    expect(screen.getByText("Alpha Widget")).toBeInTheDocument()
    expect(screen.getByText("Gamma Widget")).toBeInTheDocument()
    expect(screen.queryByText("Beta Gadget")).not.toBeInTheDocument()
    expect(screen.getByText("共 2 筆")).toBeInTheDocument()
  })

  it("a filter matching nothing renders the empty-state message, not a blank table", async () => {
    const user = userEvent.setup()
    render(
      <DataTable
        columns={columns}
        data={data}
        filterPlaceholder="搜尋…"
        emptyLabel="尚無資料。"
      />,
    )

    await user.type(screen.getByPlaceholderText("搜尋…"), "nonexistent-xyz")

    expect(screen.getByText("尚無資料。")).toBeInTheDocument()
    expect(screen.getByText("共 0 筆")).toBeInTheDocument()
  })
})
