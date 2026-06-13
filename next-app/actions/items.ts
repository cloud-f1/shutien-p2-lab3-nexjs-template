"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { itemsTable } from "@/lib/schema"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

type State = { error?: string } | null

export async function createItem(prevState: State, formData: FormData): Promise<State> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const title = formData.get("title")
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return { error: "Title is required" }
  }

  await db.insert(itemsTable).values({ title: title.trim(), userId: session.user.id })

  revalidatePath("/dashboard")
  redirect("/dashboard")
}

export async function deleteItem(id: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  await db
    .delete(itemsTable)
    .where(and(eq(itemsTable.id, id), eq(itemsTable.userId, session.user.id)))

  revalidatePath("/dashboard")
}

export async function updateItem(id: string, prevState: State, formData: FormData): Promise<State> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const title = formData.get("title")
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return { error: "Title is required" }
  }

  await db
    .update(itemsTable)
    .set({ title: title.trim(), updatedAt: new Date() })
    .where(and(eq(itemsTable.id, id), eq(itemsTable.userId, session.user.id)))

  revalidatePath("/dashboard")
  redirect("/dashboard")
}
