"use server"

import { db } from "@/lib/db"
import { itemsTable } from "@/lib/schema"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireEditor } from "@/lib/permissions"

type State = { error?: string } | null

export async function createItem(prevState: State, formData: FormData): Promise<State> {
  // Viewers are read-only — requireEditor() redirects them away.
  const session = await requireEditor()

  const title = formData.get("title")
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return { error: "請輸入標題" }
  }
  if (title.trim().length > 255) {
    return { error: "標題過長（最多 255 個字元）。" }
  }

  await db.insert(itemsTable).values({ title: title.trim(), userId: session.user.id })

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

  const title = formData.get("title")
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return { error: "請輸入標題" }
  }
  if (title.trim().length > 255) {
    return { error: "標題過長（最多 255 個字元）。" }
  }

  const result = await db
    .update(itemsTable)
    .set({ title: title.trim(), updatedAt: new Date() })
    .where(and(eq(itemsTable.id, id), eq(itemsTable.userId, session.user.id)))

  if (result.count === 0) {
    return { error: "找不到項目，或您沒有權限編輯。" }
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/items")
  return null // success — the modal closes + the list revalidates
}
