// @saas/rbac-scoped-visibility — assignment-scoped row-level visibility (E325).
//
// Ported from a fork's case-visibility pattern, generalized: a role that has "full
// visibility" sees every row; every other role sees only rows it is explicitly
// assigned to. The M:N assignment table pattern lives in ./schema.ts.
//
// PURE — zero db import, zero framework import — independently unit-testable. Fail
// -closed: a missing user/id, or a scoped role with no assignment, resolves to
// false/empty rather than throwing. The caller is responsible for the live role read
// (e.g. `getLiveRole()` from `@/lib/permissions`, E323) — this module only supplies
// the predicate, not the fetch. Compose it with `defineAction()`'s `authorize` hook
// (E323) — see the install-rbac-scoped-visibility skill for the exact wiring.

export interface ScopedVisibilityUser<TRole = string> {
  id: string
  role: TRole | null | undefined
}

export interface ScopedVisibilityOptions<TRole = string> {
  /**
   * Returns true when `role` bypasses row-level scoping and sees every row (e.g. an
   * admin/manager-tier role). Wire this to your own permission matrix — a static
   * `(role) => role === "admin"` check, or a call into `@/lib/permissions` /
   * `@/lib/is-admin`.
   */
  hasFullVisibility: (role: TRole | null | undefined) => boolean
}

/**
 * Can `user` see a row whose assignees are `assigneeIds`?
 *
 * - A role with full visibility (per `options.hasFullVisibility`) → always true.
 * - Every other role → true only if `assigneeIds` includes `user.id`.
 * - Fail-closed: no `user`/`user.id`, or a scoped role with no `assigneeIds` → false.
 *
 * @param user        The current caller (id + role).
 * @param assigneeIds The row's assigned-user ids (e.g. from `resourceAssigneesTable`).
 * @param options     `hasFullVisibility` — the role bypass predicate.
 */
export function canSeeAssignedRow<TRole = string>(
  user: ScopedVisibilityUser<TRole> | null | undefined,
  assigneeIds: readonly string[] | null | undefined,
  options: ScopedVisibilityOptions<TRole>,
): boolean {
  if (!user?.id) return false
  if (options.hasFullVisibility(user.role)) return true
  if (!assigneeIds) return false
  return assigneeIds.includes(user.id)
}

/**
 * Narrow an in-memory list of rows down to the ones `user` may see. Prefer scoping the
 * DB query itself when the row set is large (join against the assignment table); this
 * helper is for the common case where rows + their assignee ids are already loaded.
 */
export function filterAssignedRows<TRole, TRow extends { assigneeIds?: readonly string[] | null }>(
  rows: readonly TRow[],
  user: ScopedVisibilityUser<TRole> | null | undefined,
  options: ScopedVisibilityOptions<TRole>,
): TRow[] {
  return rows.filter((row) => canSeeAssignedRow(user, row.assigneeIds ?? null, options))
}
