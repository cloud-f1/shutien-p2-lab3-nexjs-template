"use client"

import Link from "next/link"
import { type ColumnDef } from "@tanstack/react-table"
import { ArrowRightIcon } from "lucide-react"

import { DataTable } from "@/components/data-table-generic"
import { Button } from "@/components/ui/button"

export type LibraryRow = {
  slug: string
  name: string
  description: string
  purchasedAt: string
}

export function LibraryTable({ items }: { items: LibraryRow[] }) {
  const columns: ColumnDef<LibraryRow>[] = [
    {
      accessorKey: "name",
      header: "內容",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          {row.original.description ? (
            <span className="text-muted-foreground text-xs">{row.original.description}</span>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "purchasedAt",
      header: "購買時間",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.purchasedAt}</span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">操作</span>,
      enableGlobalFilter: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/dashboard/library/${row.original.slug}`}>
              開啟 <ArrowRightIcon className="size-4" />
            </Link>
          </Button>
        </div>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={items}
      filterPlaceholder="搜尋內容…"
      emptyLabel="您尚未購買任何內容。"
    />
  )
}
