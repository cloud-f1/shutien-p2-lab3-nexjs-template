// Pure notification helpers — NO db import, so unit-testable in isolation
// (lib/db.ts throws at import without DATABASE_URL; unit tests stay db-free).

/** Unread count from an already-fetched list. */
export function unreadCountFrom(notifications: { readAt: Date | null }[]): number {
  return notifications.filter((n) => n.readAt == null).length
}
