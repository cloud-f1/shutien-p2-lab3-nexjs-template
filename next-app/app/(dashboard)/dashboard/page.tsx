import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { itemsTable } from "@/lib/schema"
import { eq } from "drizzle-orm"
import Link from "next/link"
import { DeleteButton } from "@/components/delete-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const session = await auth()
  const userId = session!.user!.id!

  // Parallel: fetch the item list and the total count concurrently (no waterfall).
  // db.$count() returns a Promise<number> directly — the previous select()/from()
  // wrapper returned one row PER item and yielded [] for users with zero items,
  // crashing the destructure on `count`.
  const [items, count] = await Promise.all([
    db.select().from(itemsTable).where(eq(itemsTable.userId, userId)).orderBy(itemsTable.createdAt),
    db.$count(itemsTable, eq(itemsTable.userId, userId)),
  ])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {session!.user?.name}
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/items/create">+ New Item</Link>
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{count}</p>
          </CardContent>
        </Card>
      </div>

      {/* Items list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <p className="text-muted-foreground">No items yet.</p>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/items/create">Create your first item</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between px-6 py-3">
                  <span className="text-sm">{item.title}</span>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/dashboard/items/${item.id}/edit`}>Edit</Link>
                    </Button>
                    <DeleteButton id={item.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
