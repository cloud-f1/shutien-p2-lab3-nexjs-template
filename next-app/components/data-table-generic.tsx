"use client"

/**
 * Reusable client-side data table (E273) — the project convention for list views.
 * Wraps TanStack Table with a global filter box, page-size selector, and
 * pagination controls. Domain tables pass `columns` + `data` (+ optional toolbar);
 * everything else (filter/paginate/count) is handled here. Client-side: fine for
 * the typical few-hundred-row dashboard list; swap to server-side if a table grows.
 *
 * E338 additions (all optional, fully backward-compatible — omit all of them
 * and rendering/behavior is byte-identical to before):
 *  - `renderMobileCard` — below the `md` breakpoint (`useIsMobile()`), if
 *    provided, swaps the `<table>` for a card list. Filter/sort/pagination
 *    state lives on ONE `useReactTable()` instance regardless of which mode
 *    renders, so typing a filter on mobile and resizing to desktop (or vice
 *    versa) preserves the exact same filtered rows + page position.
 *  - `dense` — tighter row padding (`py-1.5` vs the default `p-2`) for
 *    data-heavy admin tables.
 *  - `chips` — a slot rendered under the filter/toolbar row (e.g.
 *    `<FilterChipBar>`); the table has no opinion on what it contains.
 *  - `emptyState` — replaces the plain-text empty row/card in both modes.
 */
import { useState, type ReactNode } from "react"
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  /** Show a global filter box with this placeholder; omit to hide the filter. */
  filterPlaceholder?: string
  /** Rendered to the right of the filter row (e.g. a "新增" button). */
  toolbar?: ReactNode
  /** Empty-state message. */
  emptyLabel?: string
  pageSize?: number
  /**
   * Below the `md` breakpoint, if provided, renders each row as a card via
   * this instead of a `<table>` row. Omit to keep the table on all
   * viewports (today's behavior).
   */
  renderMobileCard?: (row: TData) => ReactNode
  /** Tighter row padding for data-heavy tables. */
  dense?: boolean
  /** Quick-filter row rendered under the filter/toolbar bar (e.g. `<FilterChipBar>`). */
  chips?: ReactNode
  /** Replaces the plain-text empty row/card in both table and card mode. */
  emptyState?: ReactNode
}

export function DataTable<TData, TValue>({
  columns,
  data,
  filterPlaceholder,
  toolbar,
  emptyLabel = "尚無資料。",
  pageSize = 10,
  renderMobileCard,
  dense = false,
  chips,
  emptyState,
}: DataTableProps<TData, TValue>) {
  const [globalFilter, setGlobalFilter] = useState("")
  const [sorting, setSorting] = useState<SortingState>([])
  const isMobile = useIsMobile()

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, sorting },
    initialState: { pagination: { pageSize } },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const total = table.getFilteredRowModel().rows.length

  return (
    <div className="space-y-4">
      {(filterPlaceholder || toolbar) && (
        <div className="flex items-center justify-between gap-2">
          {filterPlaceholder ? (
            <div className="relative max-w-xs flex-1">
              <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={filterPlaceholder}
                className="pl-8"
                aria-label={filterPlaceholder}
              />
            </div>
          ) : (
            <span />
          )}
          {toolbar}
        </div>
      )}

      {chips}

      {isMobile && renderMobileCard ? (
        <div className="rounded-xl border" data-slot="data-table-mobile-cards">
          {table.getRowModel().rows.length ? (
            <div className="divide-border divide-y">
              {table.getRowModel().rows.map((row) => (
                <div key={row.id}>{renderMobileCard(row.original)}</div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground p-6 text-center text-sm">
              {emptyState ?? emptyLabel}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className={cn(dense && "py-1.5")}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-muted-foreground h-24 text-center">
                    {emptyState ?? emptyLabel}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-muted-foreground text-sm">共 {total} 筆</p>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">每頁</span>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(v) => table.setPageSize(Number(v))}
            >
              <SelectTrigger size="sm" className="w-18" aria-label="每頁列數">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 50].map((n) => (
                  <SelectItem key={n} value={`${n}`}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-sm font-medium">
            第 {table.getState().pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)} 頁
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">上一頁</span>
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">下一頁</span>
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
