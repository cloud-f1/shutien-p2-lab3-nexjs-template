"use server"

import { and, eq, isNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { requireAuth } from "@/lib/permissions"
import { notificationsTable } from "@/lib/schema"

/** Mark one of the current user's notifications read (owner-scoped). */
export async function markRead(id: string) {
  const session = await requireAuth()
  await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, session.user.id)))
  revalidatePath("/dashboard")
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
