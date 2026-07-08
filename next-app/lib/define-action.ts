// E323 — Server-Action factory. Collapses the boilerplate every mutation repeats
//   guard(login + live role) → validate(Zod) → authorize → handler → audit → revalidate
// into one cross-cutting pipeline (Command pattern). Two goals:
//   1. Guards run through a SINGLE path (replaces each action file's hand-written
//      requireEditor()/requireAdmin() call) so authentication stays consistent.
//   2. Audit becomes a factory guarantee — the audit field is mandatory-but-nullable
//      (return `null` to explicitly exempt), so it can't be silently forgotten.
//
// Design boundary: handlers hold only business logic; the outward-facing action can
// keep a thin wrapper to preserve an existing signature
//   (e.g. deleteItem(id) → deleteItemAction({ id })).

import type { ZodType, z } from "zod"
import { revalidatePath } from "next/cache"

import { auth } from "@/lib/auth"
import { getLiveRole } from "@/lib/permissions"
import { logAudit } from "@/lib/audit"
import type { Role } from "@/lib/schema"

/** Action execution context — authenticated + live role (re-read from the DB). */
export interface ActionCtx {
  actorId: string
  role: Role
}

/** logAudit's parameter type (single source of truth — avoids re-declaring it). */
type AuditEntry = Parameters<typeof logAudit>[0]

export type ActionResult<O> = { error: string } | ({ ok: true } & O)

/**
 * Report an unexpected exception to Sentry — only when SENTRY_DSN is set, so the
 * template still runs with no observability config (matches instrumentation.ts's
 * env-gated Sentry, E293). Business-level `{ error }` returns never reach here
 * (that is normal control flow, not an exception); only genuinely thrown errors
 * are reported. A reporting failure is swallowed so it can't mask the re-throw.
 */
async function reportUnexpected(err: unknown): Promise<void> {
  if (!process.env.SENTRY_DSN) return
  try {
    const Sentry = await import("@sentry/nextjs")
    Sentry.captureException(err)
  } catch {
    // reporting failure must not mask the original error
  }
}

/** handler success shape: business data + the audit entry to write (`null` exempts). */
export type HandlerOutcome<O> = { data: O; audit: AuditEntry | null }

export interface DefineActionConfig<
  S extends ZodType,
  O extends Record<string, unknown>,
  R = undefined,
> {
  /**
   * Role-level gate (the flag/role layer). Return `true` to allow; omit = login only.
   * Compose the template's helpers, e.g. `allow: canEdit` or `allow: isAdmin`.
   */
  allow?: (role: Role) => boolean
  /** Message when `allow` denies (defaults to a generic message). */
  denyMessage?: string
  /** Input validation schema. */
  schema: S
  /**
   * Resource-level authorization hook. Runs after `allow` passes + input validates;
   * for the "has the capability but only on specific rows" case (e.g. an editor may
   * only mutate rows they own). Return `{ error }` to reject (handler + audit skipped);
   * return `{ ok: resource }` to pass the already-loaded resource into the handler
   * (saving a re-query). Omit to keep pure role behaviour — the handler's 3rd arg is
   * then `undefined`.
   */
  authorize?: (input: z.output<S>, ctx: ActionCtx) => Promise<{ error: string } | { ok: R }>
  /** Paths to revalidate on success. */
  revalidate?: string[]
  /**
   * Business logic (`input` is the schema's OUTPUT type; `resource` is `authorize`'s
   * `ok` value, or `undefined` with no authorize). Return `{ error }` to fail (no audit,
   * no revalidate); on success return `{ data, audit }` — `audit` is type-forced to be
   * present (`null` to explicitly exempt). That is the "audit can't be forgotten"
   * guarantee: the handler holds the full before/after state, so it decides the entry.
   */
  handler: (
    input: z.output<S>,
    ctx: ActionCtx,
    resource: R,
  ) => Promise<{ error: string } | HandlerOutcome<O>>
}

/**
 * Build a factory-guarded Server Action. Returns `(rawInput) => ActionResult<O>`.
 */
export function defineAction<
  S extends ZodType,
  O extends Record<string, unknown>,
  R = undefined,
>(cfg: DefineActionConfig<S, O, R>): (raw: unknown) => Promise<ActionResult<O>> {
  return async (raw: unknown): Promise<ActionResult<O>> => {
    try {
      // 1) guard — login + live role (always re-read from the DB, never trust the JWT).
      const session = await auth()
      const actorId = session?.user?.id
      if (!actorId) return { error: "請先登入。" }
      const role = await getLiveRole(actorId)
      if (!role) return { error: "請先登入。" }
      if (cfg.allow && !cfg.allow(role)) {
        return { error: cfg.denyMessage ?? "您沒有執行此操作的權限。" }
      }
      const ctx: ActionCtx = { actorId, role }

      // 2) validate
      const parsed = cfg.schema.safeParse(raw)
      if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? "輸入有誤。" }
      }

      // 3) resource-level authorization (omit = role-only)
      let resource = undefined as R
      if (cfg.authorize) {
        const verdict = await cfg.authorize(parsed.data, ctx)
        if ("error" in verdict) return verdict
        resource = verdict.ok
      }

      // 4) business
      const out = await cfg.handler(parsed.data, ctx, resource)
      if ("error" in out) return out

      // 5) audit (factory guarantee; `null` explicitly exempts)
      if (out.audit) await logAudit(out.audit)

      // 6) revalidate
      for (const path of cfg.revalidate ?? []) revalidatePath(path)

      return { ok: true, ...out.data }
    } catch (err) {
      // Unexpected exceptions (DB drop, a throw inside the handler…) → report to
      // Sentry then re-throw. Business-level `{ error }` (auth/validation/not-found)
      // returns normally and never reaches here.
      await reportUnexpected(err)
      throw err
    }
  }
}
