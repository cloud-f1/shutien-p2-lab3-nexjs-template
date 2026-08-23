"use server"

import { db } from "@/lib/db"
import { itemsTable } from "@/lib/schema"
import { eq, and } from "drizzle-orm"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { requireAuth, requireEditor, canEdit } from "@/lib/permissions"
import { defineAction } from "@/lib/define-action"
import { logAudit } from "@/lib/audit"
import { validateItemTitle } from "@/lib/items-utils"
import { updateItemSchema } from "@/lib/validations/items"
import { toJson } from "@/lib/export-utils"

type State = { error?: string } | null

export async function createItem(prevState: State, formData: FormData): Promise<State> {
  // Viewers are read-only — requireEditor() redirects them away.
  const session = await requireEditor()

  const validated = validateItemTitle(formData.get("title"))
  if ("error" in validated) {
    return { error: validated.error }
  }

  const [created] = await db
    .insert(itemsTable)
    .values({ title: validated.title, userId: session.user.id })
    .returning({ id: itemsTable.id })

  // E339 — record-detail activity card reads this via getAuditLogForTarget.
  await logAudit({
    actorId: session.user.id,
    action: "item.created",
    targetType: "item",
    targetId: created.id,
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/items")
  return null // success — the modal closes + the list revalidates
}

// E323 — reference migration to the defineAction() factory. The pipeline
// (guard → validate → authorize → handler → audit → revalidate) is provided by the
// factory; the handler holds only the delete + the audit entry it can't forget. The
// thin `deleteItem(id)` wrapper below preserves the existing `(id) => State` signature
// its callers (components/delete-button.tsx) already depend on.
const deleteItemAction = defineAction({
  allow: canEdit, // viewers are read-only; editors + admins may delete
  schema: z.object({ id: z.string().min(1) }),
  revalidate: ["/dashboard", "/dashboard/items"],
  handler: async ({ id }, ctx) => {
    const result = await db
      .delete(itemsTable)
      .where(and(eq(itemsTable.id, id), eq(itemsTable.userId, ctx.actorId)))

    // Ownership-scoped WHERE matching zero rows means the item doesn't exist or
    // belongs to another user — surface that instead of silently "succeeding".
    // (postgres-js exposes rows-affected as `.count`.)
    if (result.count === 0) {
      return { error: "找不到項目，或您沒有權限刪除。" }
    }

    return {
      data: {},
      audit: { actorId: ctx.actorId, action: "item.deleted", targetType: "item", targetId: id },
    }
  },
})

export async function deleteItem(id: string): Promise<State> {
  const result = await deleteItemAction({ id })
  return "ok" in result ? null : { error: result.error }
}

export async function updateItem(id: string, prevState: State, formData: FormData): Promise<State> {
  const session = await requireEditor()

  // E348 — updateItemSchema is now the single validation contract for this path
  // (previously updateItem() used the separately hand-rolled validateItemTitle(),
  // which had drifted into being updateItemSchema's only real-world "shadow"
  // implementation — see docs/epics/e348-update-item-contract-drift.md). The raw
  // FormData value is trimmed before .safeParse() so the schema's min/max checks
  // see exactly what validateItemTitle() used to check (it trimmed internally);
  // a non-string/null value (FormData.get() can return string | File | null)
  // passes through untrimmed and is rejected by the schema's invalid_type_error.
  const rawTitle = formData.get("title")
  const parsed = updateItemSchema.safeParse({
    title: typeof rawTitle === "string" ? rawTitle.trim() : rawTitle,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "請輸入標題" }
  }
  const { title } = parsed.data

  const result = await db
    .update(itemsTable)
    .set({ title, updatedAt: new Date() })
    .where(and(eq(itemsTable.id, id), eq(itemsTable.userId, session.user.id)))

  if (result.count === 0) {
    return { error: "找不到項目，或您沒有權限編輯。" }
  }

  // E339 — record-detail activity card reads this via getAuditLogForTarget.
  await logAudit({
    actorId: session.user.id,
    action: "item.updated",
    targetType: "item",
    targetId: id,
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/items")
  revalidatePath(`/dashboard/items/${id}`)
  return null // success — the modal closes + the list revalidates
}

/**
 * Export the current user's items as JSON (all authenticated users).
 * Returns the JSON string, suggested filename, and content-type so the client
 * can trigger a browser download without a streaming response.
 */
export async function exportItems(): Promise<
  | { success: true; data: string; filename: string; contentType: string }
  | { success: false; error: string }
> {
  let session
  try {
    session = await requireAuth()
  } catch {
    return { success: false, error: "請先登入。" }
  }

  const items = await db
    .select({
      id: itemsTable.id,
      title: itemsTable.title,
      createdAt: itemsTable.createdAt,
      updatedAt: itemsTable.updatedAt,
    })
    .from(itemsTable)
    .where(eq(itemsTable.userId, session.user.id))
    .orderBy(itemsTable.createdAt)

  const rows = items.map((item) => ({
    id: item.id,
    title: item.title,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }))

  const data = toJson(rows)
  const filename = `items-${new Date().toISOString().slice(0, 10)}.json`

  return { success: true, data, filename, contentType: "application/json" }
}
