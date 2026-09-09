"use server"

import { and, eq, isNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { requireAuth } from "@/lib/permissions"
import { notificationsTable } from "@/lib/schema"

/** Mark one of the current user's notifications read (owner-scoped). */
export async function markRead(id: string): Promise<{ error?: string }> {
  const session = await requireAuth()
  const result = await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, session.user.id)))

  // E368 — no audit event on this one, but silently "succeeding" for another
  // user's notification id still misreports the outcome to the caller.
  if (result.count === 0) {
    return { error: "找不到通知。" }
  }

  revalidatePath("/dashboard")
  return {}
}

/** Mark all of the current user's unread notifications read. */
export async function markAllRead() {
  const session = await requireAuth()
  await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(
      and(eq(notificationsTable.userId, session.user.id), isNull(notificationsTable.readAt)),
    )
  revalidatePath("/dashboard")
}
