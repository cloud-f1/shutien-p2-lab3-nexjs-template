// E339 — record-detail pattern exemplar. This page does ALL fetching and
// authorization; every `_detail/*` child receives its data as props only —
// none of them import `db` (enforced by convention here, checked with
// `grep -rn "from \"@/lib/db\"\|drizzle-orm" _detail/` before every merge).
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { eq } from "drizzle-orm"
import { cache } from "react"

import { db } from "@/lib/db"
import { itemsTable, usersTable, type Role } from "@/lib/schema"
import { canEdit, getLiveRole, requireAuth } from "@/lib/permissions"
import { getAuditLogForTarget } from "@/lib/audit"
import { Header } from "./_detail/header"
import { SideCard } from "./_detail/side-card"
import { ActivityCard } from "./_detail/activity-card"
import { ReadonlyBanner } from "./_detail/readonly-banner"
import type { ActivityEntryVM, ItemDetailVM } from "./_detail/types"

// `cache()` (React, per-request dedup) — generateMetadata() and the page
// component both call this AND resolveViewer() below; in a real Next.js
// request they run against the SAME request, so this collapses what would
// otherwise be 2x the DB/session round-trips into 1x. Outside a Next.js
// request scope (e.g. calling the functions directly in an integration
// test) this degrades to "no memoization" — still correct, just uncached.
const loadItemRow = cache(async (id: string) => {
  const [row] = await db
    .select({
      id: itemsTable.id,
      title: itemsTable.title,
      userId: itemsTable.userId,
      createdAt: itemsTable.createdAt,
      updatedAt: itemsTable.updatedAt,
      ownerEmail: usersTable.email,
    })
    .from(itemsTable)
    .leftJoin(usersTable, eq(itemsTable.userId, usersTable.id))
    .where(eq(itemsTable.id, id))
    .limit(1)
  return row ?? null
})

interface Viewer {
  userId: string
  role: Role
}

/**
 * ONE ownership predicate — shared by `generateMetadata()` AND the page body
 * below. This must not be written twice: in the App Router,
 * `generateMetadata()` and the page component resolve INDEPENDENTLY. A
 * `notFound()` thrown in the page body does NOT retroactively cancel
 * metadata that generateMetadata() already computed for the same request —
 * they are two separate entry points into the same route, not one guarded
 * by the other. See docs/playbooks/list-detail-edit.md §5 for the incident
 * this fixes: without its own check here, generateMetadata() leaked a
 * non-owner's real item title into the rendered `<title>` even though the
 * page body correctly 404'd.
 *
 * Mirrors the ownership model actions/items.ts already enforces at the DB
 * layer (`WHERE user_id = <actor>`) rather than inventing a parallel rule.
 */
function canViewItem(row: { userId: string }, viewer: Viewer): boolean {
  return row.userId === viewer.userId || viewer.role === "admin"
}

// Live-role viewer identity (E323 convention: re-read the role from the DB,
// never trust the JWT-snapshotted session role for a security decision) —
// shared by generateMetadata() and the page body via the same `cache()`
// reasoning as loadItemRow above.
const resolveViewer = cache(async (): Promise<Viewer> => {
  const session = await requireAuth()
  const role = (await getLiveRole(session.user.id)) ?? session.user.role
  return { userId: session.user.id, role }
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const row = await loadItemRow(id)
  if (!row) return { title: "項目" }

  // SECURITY: generateMetadata() has its OWN authorization check — see the
  // canViewItem() doc comment above for why this can't be inherited from
  // the page body's guard. A viewer who fails this gets a generic title,
  // never the record's real one.
  const viewer = await resolveViewer()
  if (!canViewItem(row, viewer)) return { title: "項目" }

  return { title: `${row.title} · 項目` }
}

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const viewer = await resolveViewer()

  const row = await loadItemRow(id)
  if (!row) notFound()

  // IDOR guard: a non-owner who is not admin gets notFound() — NEVER
  // redirect(), which would leak that the id exists to someone who can't
  // see it. Same canViewItem() predicate generateMetadata() uses above.
  if (!canViewItem(row, viewer)) notFound()

  const isOwner = row.userId === viewer.userId

  // Edit/delete affordance mirrors that SAME ownership-scoped WHERE clause:
  // updateItem/deleteItem only ever match rows owned by the caller, so even
  // an admin viewing someone else's item cannot mutate it through them —
  // showing edit/delete buttons here would promise something the action
  // can't deliver. Only the true owner (with an editor/admin role) gets them.
  // NOTE for future readers: this affordance check controls the UI only —
  // it is not itself the authorization boundary. The real gate is the
  // ownership-scoped SQL in actions/items.ts; hiding a button here is a UX
  // courtesy, not a security control (the server action would reject the
  // mutation regardless of what the client renders).
  const canMutate = isOwner && canEdit(viewer.role)

  const item: ItemDetailVM = {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toLocaleString("zh-TW"),
    updatedAt: row.updatedAt.toLocaleString("zh-TW"),
    // Same "saved again since creation" semantics as the list — see
    // _items-table.tsx's ItemRow.edited doc comment.
    edited: row.updatedAt.getTime() !== row.createdAt.getTime(),
    ownerEmail: row.ownerEmail,
  }

  const auditRows = await getAuditLogForTarget("item", id)
  const activity: ActivityEntryVM[] = auditRows.map((entry) => ({
    id: entry.id,
    action: entry.action,
    actorEmail: entry.actorEmail,
    createdAt: entry.createdAt.toLocaleString("zh-TW"),
  }))

  return (
    <div className="max-w-5xl space-y-6 p-6">
      <Link
        href="/dashboard/items"
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        ← 返回項目列表
      </Link>

      {!isOwner && (
        <ReadonlyBanner
          reason={`你正在以管理員身分檢視 ${item.ownerEmail ?? "其他使用者"} 的項目 — 唯讀，無法編輯或刪除。`}
        />
      )}

      <Header item={item} canMutate={canMutate} />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <ActivityCard entries={activity} />
        </div>
        <div>
          <SideCard item={item} />
        </div>
      </div>
    </div>
  )
}
