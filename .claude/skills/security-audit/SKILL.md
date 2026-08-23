---
name: security-audit
description: >-
  Security checklist for THIS Next.js 16 + Auth.js v5 (JWT) + Drizzle + shadcn SaaS template.
  Use when running /athena:qa --review-only (the @reviewer security pass), auditing a Server
  Action or Route Handler, reviewing a PR that touches auth/RBAC/billing-webhooks/API-keys,
  or when someone asks "is this secure", "security review", "check for IDOR", or "audit this
  endpoint". Encodes this stack's real attack surface — Server Actions as public POST endpoints,
  stale-JWT-role privilege gaps, webhook signature verification, IDOR on owner-scoped rows —
  as a repeatable checklist, not generic OWASP prose. Also folds in the former
  frontend-review.md security block (now retired).
---

# Security Audit — AI-Coding-Template (Next.js SaaS)

Grounded in this repo's actual files. If a file path below doesn't exist in a fork, treat the
item as N/A rather than inventing one.

## 1. Server Actions are PUBLIC POST endpoints — Block

Every `"use server"` function is reachable as a POST regardless of which UI element calls it.
**Hiding a button client-side is not a control.** Stop-verifier's Rule 2
(`scripts/hooks/stop-verifier.sh`) already machine-checks this, but a human/agent review still
needs to reason about *which* guard and *whether it's the right tier*:

- First line of every mutating action must be a guard from `lib/permissions.ts`
  (`requireAuth` / `requireAdmin` / `requireEditor`) **or** the action must be built with
  `defineAction()` (`lib/define-action.ts`), which guards in-pipeline (step 1, before validation).
  Note: `lib/permissions.ts` currently only exports `requireAuth`, `requireAdmin`, `requireEditor`,
  and `getLiveRole` — the `requireRole()`/`requireFlag()`/bare `guard()` names Rule 2's error
  message mentions as acceptable alternatives are not implemented as of this writing; treat any
  reference to them as future-proofing, not a real API to look up.
- Check the guard matches the actual sensitivity: an editor-tier action (`requireEditor`) gating
  something that should be admin-only (`requireAdmin`) is a real finding, not a nitpick.
  Reference: `actions/items.ts` (`createItem`/`updateItem` → `requireEditor`), `actions/webhooks.ts`
  (`exportWebhooks` → `requireAdmin`).
- Genuine pre-auth exceptions (login, register, password-reset request) must carry the
  `// stop-verifier:public-action` marker — confirm the marker is on an action that truly has no
  session yet, not slapped on to silence the hook.
- **Every input must be Zod-validated** — never trust a client-supplied id/role/enum. `defineAction()`
  makes this structural (`schema: z.object({...})`, step 2); hand-written actions must validate
  by hand (see `createItem`/`updateItem` in `actions/items.ts`, which trim the raw `FormData`
  value then call `.safeParse()` against the shared `itemTitleSchema` in
  `lib/validations/items.ts` — E352). Flag any action that reads
  `formData.get(...)` or a raw object param and passes it to a DB call unchecked.

## 2. Role checks MUST re-read from the DB — Block

The JWT snapshots `role` at sign-in (`lib/auth.ts`, `session: { strategy: "jwt" }`). A demoted
user's existing token still claims the old role until re-login. The fix already lives in
`lib/permissions.ts`'s `getLiveRole(userId)` (queries `getUserById`) — `requireAdmin`/`requireEditor`
call it, and `defineAction()`'s guard step calls it too. **Flag any code path that branches on
`session.user.role` directly** for an authorization decision instead of calling `getLiveRole`/
`requireAdmin`/`requireEditor` — that's a live privilege-escalation-after-demotion bug, not style.
`lib/is-admin.ts`'s pure `isAdmin(role)`/`canEdit(role)` are UI-only helpers (zero imports, client-safe)
— using them to *gate a mutation* instead of merely hiding a button is the same class of bug.

## 3. IDOR — row-level ownership on update/delete — Block

Every action that mutates a row scoped to a user must filter `WHERE` by both the row id **and**
the owner column, and must treat "0 rows affected" as "not found or not yours" (never leak which
case it was). Verified pattern in `actions/items.ts`:

```ts
.where(and(eq(itemsTable.id, id), eq(itemsTable.userId, ctx.actorId)))
// result.count === 0 → { error: "找不到項目，或您沒有權限刪除。" } — same message either way
```

Same pattern in `actions/webhooks.ts` (`setWebhookActive`/`deleteWebhook`, scoped on
`webhooksTable.userId`) and `actions/api-keys.ts` (scoped on `apiKeysTable.userId`). Flag any
update/delete `.where()` that only checks the id — that lets any authenticated user mutate any
other user's row by guessing/enumerating ids. For `defineAction()`-based actions, this ownership
check belongs in the `authorize` hook (loads the row, verifies ownership, returns `{ ok: resource }`)
so the handler never has to re-derive it — see the E323 doc comment in `lib/define-action.ts`.
If `@saas/rbac-scoped-visibility` is installed, cross-check `lib/rbac-scoped-visibility/visibility.ts`'s
`canSeeAssignedRow()` is actually composed into the action, not just imported.

## 4. Webhook endpoints — signature/MAC verification — Block

Two provider patterns exist under `app/api/billing/*`:

- **Stripe** (`app/api/billing/stripe/webhook/route.ts`): reads the **raw body via
  `request.text()` before any JSON parsing** (required for signature verification), extracts the
  `stripe-signature` header, calls `getStripeProvider().verifyWebhook(rawBody, headers)`, and
  returns 400 on `!verifyResult.valid` *before* touching the payload. Flag any webhook handler
  that parses JSON first, or that processes the payload before the verify-result check.
- **ECPay** (`app/api/billing/ecpay/return/route.ts`, `.../period/route.ts`): same raw-body-first
  shape, verifies `CheckMacValue` (SHA256) via the ECPay provider, returns ECPay's expected
  `"0|CheckMacValue invalid"` 400 body on failure (ECPay's own ack-format contract, not a generic
  JSON error — don't "fix" this to `NextResponse.json`).
- Idempotency: Stripe path uses `payment_events.provider_event_id` with `onConflictDoNothing` +
  SQLSTATE 23505 detection (`lib/billing/idempotency-utils.ts`) — flag any webhook processing that
  isn't idempotent against provider retries.
- If a fork adds a new billing/webhook provider, the checklist is: raw body read → signature/MAC
  verify → reject before parse → idempotency key → then business logic.

## 5. API-key / route-handler auth — Block

`lib/api-auth-utils.ts` is the pure, DB-free half (`extractBearer()`, `hasScope()`,
`requireScope()`) — unit-testable in isolation, intentionally has zero imports. The DB-backed half
(prefix lookup + hash compare) is `lib/api-keys.ts`'s `verifyApiKey()`. Any new public Route
Handler that accepts an `Authorization: Bearer` key must: extract via `extractBearer()`, resolve +
verify via `verifyApiKey()` (never compare a raw key against a stored plaintext — it's hashed),
then `requireScope(scopes, "read" | "write")` before the handler's business logic. Flag any route
handler that inlines its own bearer-parsing regex instead of reusing `extractBearer()` (drift risk),
or that checks scopes with a raw `.includes()` instead of `hasScope()`/`requireScope()`.

## 6. Injection — Block on any hit

Drizzle parameterizes all `eq()`/`and()`/query-builder calls by default — this is not a checklist
item to re-verify per-PR, it's structural. The only injection surface is raw SQL: grep for
`sql.raw(` or template-interpolated `` sql`...${var}...` `` in `next-app/lib` and `next-app/actions`.
As of this audit, this template has **zero** `sql.raw` usage in application code — any new
occurrence is a Block finding by default; it must use bound parameters
(`` sql`... ${sql.raw(staticIdentifierOnly)} ...` `` style, or better, stay in the query builder)
and needs an explicit justification in the PR description for why the builder couldn't express it.

## 7. Secrets — Block

- `NEXT_PUBLIC_*` env vars are baked into the client bundle at build time — grep any new
  `NEXT_PUBLIC_*` for API keys/secrets/DSNs that aren't meant to be public. Legit examples in this
  repo: `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ENABLE_DEMO_LOGIN`,
  `NEXT_PUBLIC_SENTRY_DSN` (Sentry DSNs are designed to be public — the client can't do damage
  with one). Server-only secrets (`AUTH_SECRET`, `DATABASE_URL`, `STRIPE_SECRET_KEY`,
  `ECPAY_HASH_KEY`/`ECPAY_HASH_IV`, `SENTRY_DSN` without `NEXT_PUBLIC_`) must never gain the prefix.
- `.env`/`.env.local` must never be committed — check `.gitignore` covers them; check no PR diff
  adds a literal secret value (grep for suspicious high-entropy strings near `KEY=`/`SECRET=`/`TOKEN=`).
- Seed data: `drizzle/seed.ts` must refuse to run when `NODE_ENV==='production'` (unless an explicit
  override) — static demo passwords (`Admin123!` etc.) reaching a prod DB is a Critical finding.

## 8. Authorization-flag vs ownership confusion — Block

A capability flag that grants "can edit structure" (e.g. `canEdit(role)` / `requireEditor()`)
must not implicitly authorize an **assignment-scoped completion action**. In any domain where
rows can be assigned to a specific user (a task, a case, an item with an owner/assignee), a
"mark complete" / "mark done" action must gate on the actor **being the assignee**
(an `isAssigned`-style check), not on the broader edit-structure flag. The classic bug shape is
an OR-condition:

```ts
// looks like "editor OR assignee can complete" — actually lets ANY editor complete
// a task that isn't theirs, bypassing the assignee-only rule:
if (!canEdit(role) && !isAssigned) return { error: "..." }
```

That reads as defense-in-depth but is the opposite: it lets a higher-privilege role (an
editor/supervisor) perform an action a lower-privilege assignee should hold exclusively —
e.g. a supervisor "completing" a task never assigned to them, breaking an
audit/accountability rule like "supervisor view is read-only; only the assignee decides the
outcome." Fix: split the two capabilities. "Can edit structure" (add/remove fields, reassign,
change metadata) stays gated on the role flag (`canEdit`/`requireEditor`). "Can
complete/mark-done" gates on `isAssigned` **alone** (or an explicit act-on-behalf-of
allowlist) — never OR'd with the edit flag. With this template's `defineAction()` factory
(`lib/define-action.ts`), the ownership/assignment check belongs in the `authorize` resource
hook (load the row, check `resource.assigneeId === ctx.actorId`), kept structurally separate
from the role-level `allow`. Flag any completion-type action whose guard is
`!hasEditFlag && !isAssigned` (or logically equivalent) — that's a privilege-escalation
finding, not a style nitpick.

## 9. Never trust a `<Select>`'s implied constraint — Block

A `<Select>` that only offers a subset of valid options in a given context (e.g. a "kind"
field limited to certain values only when a parent record has a specific category) is a UI
convenience, not a security or data-integrity control. Any authenticated user can call the
Server Action directly with a value the `<Select>` never exposed — client-side option lists
are not validated server-side by construction. Every field whose valid range depends on
another row's state must be **re-checked in the Server Action / `authorize` hook against the
actual DB row**, not inferred from "the form wouldn't have allowed that." Example in this
template's shape: a hypothetical `addSubItem` action that should only be callable when the
parent `items` row has `category === "special"` — the action must re-load the parent and
assert `parentItem.category === "special"` before inserting, even though the create-dialog's
`<Select>` only shows the sub-item option for that category client-side. Flag any mutating
action whose only enforcement of a category/type/kind constraint is "the form doesn't offer
the other option" — that is a Server Action, reachable directly, validated only by a `<Select>`
that was never a boundary.

## 10. Gaps this template ships with (note, don't silently assume fixed)

- **File upload validation**: no binary file-upload endpoint exists in `next-app/actions` or
  `app/api` at the time of writing. The optional `@saas/csv-io` module (`registry/csv-io/`) does
  text/CSV import with a row cap and per-row error handling (`lib/csv-io/import.ts`'s `parseCsv()`)
  — if installed, confirm the row cap is still enforced and the dialog doesn't accept arbitrary
  MIME types. If a fork adds real file upload (avatars, attachments), it needs: MIME/type allowlist,
  size cap, and — since this is Server Actions, not multipart route handlers by default — explicit
  review of how `FormData` file entries are validated before any storage write.
- **Open redirect on callbackUrl**: this template does not currently read/pass a `callbackUrl`
  query param through `signIn()`/`redirect()` in `actions/auth.ts` or the `(auth)/login` page —
  Auth.js's own `redirect` callback (`auth.config.ts`/`lib/auth.ts`) is the relevant surface if a
  fork adds one. If you find a `callbackUrl`/`next`/`redirect_to` param being redirected to without
  validating it's same-origin, that is a High finding.
- **Rate limiting**: `lib/rate-limit.ts` is a real, working in-memory fixed-window limiter
  (`rateLimitGuard(key, limit, windowMs)`) already wired into `actions/auth.ts` (2FA attempts),
  `actions/webhooks.ts` (create/toggle/delete/test-send), and others — check any *new* mutating
  action that's abuse-prone (auth, outbound HTTP like `sendTestEvent`, bulk export) calls it. Known,
  documented gap (not a bug to "fix" reflexively): it's single-process, in-memory — state doesn't
  survive restart or scale across replicas. `docs/deployment/rate-limiting.md` has the Redis/Upstash
  migration path for forks that need it; don't flag the in-memory nature itself as a finding unless
  the PR is specifically about horizontal scaling.

## 11. Frontend security (folded in from the retired frontend-review.md)

- `NEXT_PUBLIC_*` env vars containing API keys or secrets → server-only vars have no
  `NEXT_PUBLIC_` prefix (duplicate of §7, kept here since it's a common frontend-diff catch).
- API keys or secrets referenced in a Client Component (`"use client"`) → must live in a Server
  Component, Server Action, or Route Handler instead.
- User input rendered without escaping (raw HTML injection, `dangerouslySetInnerHTML` with
  unsanitized input) → XSS risk. Use safe React nodes/JSX; if HTML rendering is genuinely required,
  it must go through a sanitizer, not raw interpolation.
- `target="_blank"` without `rel="noopener noreferrer"` → tabnabbing (the new tab can navigate the
  opening page via `window.opener`).
- Auth guards implemented only on the client (`useSession()` + redirect logic) instead of
  server-side (`proxy.ts` for the coarse logged-in gate, `requireAdmin`/`requireEditor` for
  authorization) — client-side-only auth is bypassable by disabling JS or calling the Server Action
  directly.

## Severity Rubric

- **Critical** — remotely exploitable without auth, or a privilege escalation with no
  precondition (e.g. missing Rule-2 guard on an admin-tier mutation; unsigned webhook accepted;
  secret committed to git; seed passwords reachable in prod).
- **High** — exploitable by an authenticated low-privilege user against another user/tenant's
  data (IDOR missing an ownership filter; stale-JWT role check instead of `getLiveRole`; open
  redirect; missing rate limit on an auth-adjacent endpoint).
- **Medium** — requires an unusual precondition, is a defense-in-depth gap, or is a hardening
  item rather than an active exploit path (missing Zod validation on a field that's also
  constrained elsewhere; XSS in a low-trust internal-only surface; `target="_blank"` without
  `rel=`; a11y items that don't gate a security boundary).

## Output Format

This skill feeds `@reviewer`'s `/athena:qa --review-only` pass. `@reviewer` has no Write/Edit
tool — it returns its `## Round N` section as its **final message**, and the dispatcher
(`/athena:qa --review-only` or `scripts/reviewer-loop.sh`) appends it to
`docs/context/review-findings.md`. Produce findings in the **same Round-N shape
`.claude/agents/reviewer.md` already defines**; do not invent a different report shape and do not
attempt to write the file yourself:

```markdown
## Round N — [ISO timestamp]
Verdict: CLEAN / ISSUES / BLOCKED
Security: [findings summary, or "none"]
...
Open findings:
- [ ] (CRITICAL) [file:line — concise description]
- [ ] (HIGH) [file:line — concise description]
- [ ] (MEDIUM) [file:line — concise description]

Action needed: [what must be fixed before merge, or "none — LGTM"]
```

Note `.claude/agents/reviewer.md`'s existing template only shows HIGH/MED tags — extend it with
CRITICAL for the cases in §Severity Rubric above; do not downgrade a Critical to HIGH to fit the
old two-tier habit. Read `.claude/agents/reviewer.md` for the full contract (idempotent per round,
never reproduce prior rounds in your output, return-not-write) — this skill supplies the
*checklist content*, not the output mechanics, which stay owned by that agent file.
