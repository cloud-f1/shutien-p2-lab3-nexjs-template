"use server"

import { db } from "@/lib/db"
import { itemsTable } from "@/lib/schema"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireAuth, requireEditor } from "@/lib/permissions"
import { validateItemTitle } from "@/lib/items-utils"
import { toJson } from "@/lib/export-utils"

type State = { error?: string } | null

export async function createItem(prevState: State, formData: FormData): Promise<State> {
  // Viewers are read-only — requireEditor() redirects them away.
  const session = await requireEditor()

  const validated = validateItemTitle(formData.get("title"))
  if ("error" in validated) {
    return { error: validated.error }
  }

  await db.insert(itemsTable).values({ title: validated.title, userId: session.user.id })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/items")
  return null // success — the modal closes + the list revalidates
}

export async function deleteItem(id: string): Promise<State> {
  const session = await requireEditor()

  const result = await db
    .delete(itemsTable)
    .where(and(eq(itemsTable.id, id), eq(itemsTable.userId, session.user.id)))

  // Ownership-scoped WHERE matching zero rows means the item doesn't exist or
  // belongs to another user — surface that instead of silently "succeeding".
  // (postgres-js exposes rows-affected as `.count`.)
  if (result.count === 0) {
    return { error: "找不到項目，或您沒有權限刪除。" }
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/items")
  return null
}

export async function updateItem(id: string, prevState: State, formData: FormData): Promise<State> {
  const session = await requireEditor()

  const validated = validateItemTitle(formData.get("title"))
  if ("error" in validated) {
    return { error: validated.error }
  }

  const result = await db
    .update(itemsTable)
    .set({ title: validated.title, updatedAt: new Date() })
    .where(and(eq(itemsTable.id, id), eq(itemsTable.userId, session.user.id)))

  if (result.count === 0) {
    return { error: "找不到項目，或您沒有權限編輯。" }
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/items")
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
