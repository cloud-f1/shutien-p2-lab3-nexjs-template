import { and, desc, eq, isNull } from "drizzle-orm"

import { db } from "@/lib/db"
import { notificationsTable, type Notification } from "@/lib/schema"

export { unreadCountFrom } from "@/lib/notifications-utils"

export type NotificationType = "info" | "success" | "warning" | "error"

/** Recent notifications for a user, newest first. */
export async function getRecentNotifications(userId: string, limit = 8): Promise<Notification[]> {
  return db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit)
}

/** Count of unread notifications for a user. */
export async function getUnreadCount(userId: string): Promise<number> {
  return db.$count(
    notificationsTable,
    and(eq(notificationsTable.userId, userId), isNull(notificationsTable.readAt)),
  )
}

/** Emit a notification (called by other features — invites, key revocation, etc.). */
export async function createNotification(input: {
  userId: string
  title: string
  body?: string
  type?: NotificationType
}): Promise<void> {
  await db.insert(notificationsTable).values({
    userId: input.userId,
    title: input.title,
    body: input.body,
    type: input.type ?? "info",
  })
}
