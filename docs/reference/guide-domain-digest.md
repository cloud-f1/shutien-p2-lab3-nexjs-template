# Domain Digest — AI Coding Template

> A values-and-rules cheat-sheet for THIS template's own reference domains. Every number,
> enum, and rule below carries a **source** — the file (and, where it stays stable, the
> line range) that actually defines it — so nobody has to reverse-engineer behavior from
> the UI or guess at a threshold. **SSOT rule: when this digest and the source file it
> cites disagree, the source file wins.** Fix the digest, don't edit the code to match a
> stale doc. (If your fork also carries a separate business PRD / domain-knowledge doc
> outside this repo, that document is the source of *intent*; the code you point this
> digest at is the source of *current behavior*. Reconcile drift between the two — never
> let this digest become a third, independently-wrong copy.)
>
> This is the fact sheet the `user-guide-builder` skill's page writers quote from so the
> published manual's numbers stay correct — read it (or its per-fork replacement) before
> writing manual pages. It also demonstrates the format a fork should follow once `items`
> is replaced with a real domain.

## Format

Each domain section below uses the same five categories where they apply:

1. **分類 / Categories** — enums, kinds, or classifications the domain uses.
2. **狀態機 / State machine** — if a record has a lifecycle, its states + what triggers
   each transition, and which transitions are forbidden or manual-only.
3. **計算規則 / Calculation rules** — any derived value and the formula that produces it.
4. **權限例外 / Permission exceptions** — places where access doesn't follow the generic
   admin/editor/viewer matrix (e.g. "own records only", "nullable owner for guest flows").
5. **邊界值 / Boundary values** — min/max lengths, defaults, clamps.

Every line ends with a source pointer. A category is omitted from a domain's section when
it genuinely doesn't apply (e.g. `items` has no state machine) rather than left blank.

---

## Domain: items (`next-app/lib/schema/items.ts`, `next-app/actions/items.ts`)

The template's simplest reference CRUD domain — one table, no lifecycle.

**分類** — none; a flat list, no type/category column.

**權限例外**
- Create requires `requireEditor()` — viewers are redirected before the insert runs
  (source: `next-app/actions/items.ts` `createItem`).
- Delete requires `canEdit` (editor or admin) via the `defineAction()` factory **AND** an
  ownership-scoped `WHERE` clause (`eq(itemsTable.id, id), eq(itemsTable.userId, ctx.actorId)`)
  — an editor cannot delete another user's item even though their role generally permits
  deleting items; role and ownership are both required (source: `next-app/actions/items.ts`
  `deleteItemAction`, comment: "Ownership-scoped WHERE matching zero rows means the item
  doesn't exist or belongs to another user").
- Rows cascade-delete when their owning user is deleted (source: `next-app/lib/schema/items.ts`,
  `userId` FK `onDelete: "cascade"`).

**邊界值**
- `title`: required, 1–255 characters (source: `next-app/lib/validations/items.ts`
  `createItemSchema`/`updateItemSchema` — `z.string().min(1, "請輸入標題").max(255, "標題過長")`).

---

## Domain: library / 內容庫 (`next-app/lib/entitlements.ts`, `.../dashboard/library/`)

Not a table of its own — a **derived, read-only view** computed live from paid `orders`.

**分類** — none directly; membership is keyed by `products.entitlementKey`, a free-text
tag set per product (source: `next-app/lib/schema/billing.ts` `productsTable.entitlementKey`).

**計算規則**
- A user is entitled to a product iff they have an `orders` row with `status = "paid"`
  whose joined `products.entitlement_key` matches the product's key — computed with a live
  `INNER JOIN` on every check, not cached (source: `next-app/lib/entitlements.ts`
  `hasEntitlement()`).
- The library list itself is exactly "every product this user has a PAID order for" —
  there is no separate entitlements table; **an order IS the entitlement** (source:
  `next-app/lib/entitlements.ts` file header comment).

**權限例外**
- No role gating at all — this is a per-user ownership view, not an RBAC-gated one. It is
  a **live DB read per request**, the same posture as the RBAC live-role re-read in
  `lib/permissions.ts`, specifically so a refund can revoke access immediately rather than
  waiting for a cached flag to expire (source: `next-app/lib/entitlements.ts` file header:
  "never cache ownership into a token/session where a refund can't revoke it").
- `hasEntitlement()` defensively returns `false` (never throws) for an empty `userId` or
  `entitlementKey` (source: `next-app/lib/entitlements.ts` `hasEntitlement()` guard clause).

---

## Domain: orders (`next-app/lib/schema/billing.ts`)

One-time purchases (distinct from the recurring `subscriptions` table, which follows the
Stripe/ECPay provider's own state machine and isn't duplicated here).

**分類**
- `provider`: free-text gateway identifier set per order, e.g. `"stripe"`, `"ecpay"`
  (source: `next-app/lib/schema/billing.ts` `ordersTable.provider` comment).
- `currency`: ISO-4217 three-letter code, defaults to `"TWD"` (source: `ordersTable.currency`).

**狀態機**
- States: `pending → paid`, `pending → failed`, and `refunded` (source:
  `next-app/lib/schema/billing.ts` `ORDER_STATUSES = ["pending", "paid", "failed", "refunded"]`).
- An order is created `pending`, transitions to `paid` **exactly once** on settlement, or
  to `failed` on a declined payment; `refunded` is a manual terminal state reached only by
  an operator action, never automatically (source: `ordersTable` doc comment directly above
  `ORDER_STATUSES`).
- Idempotent settlement rides the existing `payment_events.provider_event_id` UNIQUE
  constraint — there is no separate idempotency-key table for orders (source: `ordersTable`
  doc comment: "Idempotent settlement rides the existing... UNIQUE constraint — no new
  idempotency machinery").

**計算規則**
- `orders.amount` is a **snapshot** of `products.amount` at order-creation time (smallest
  currency unit — cents for USD, 1:1 for TWD), not a live re-read of the product's current
  price (source: `ordersTable.amount` comment).
- `orders.utm` (nullable JSONB) captures first-party UTM attribution from the sales-page
  visit and carries it through checkout; orders predating this feature (or direct traffic)
  have no `utm` value (source: `ordersTable.utm` comment, feature E334).

**權限例外**
- `orders.userId` is **nullable** — guest checkout is allowed; a guest order links only by
  `customerEmail`, not a user account (source: `ordersTable.userId` comment).

**邊界值**
- `currency` defaults to `"TWD"` when not specified (source: `ordersTable.currency` default).
- `amount` is an integer in the smallest currency unit (no fractional units) — same
  convention as `products.amount` (source: `productsTable.amount` comment).

---

## Fork-author filling guide

When you replace `items` with your own domain (or add a second one), give it the same five
categories, sourced the same way:

1. **Find the schema first** — `next-app/lib/schema/*.ts` is where enums, state columns,
   and defaults are declared; Drizzle enums (`pgEnum(...)`) are almost always a category or
   a state machine waiting to be documented.
2. **Find the validation layer** — `next-app/lib/validations/*.ts` (Zod schemas) is where
   boundary values (`min`/`max`/`default`) live; quote the schema, not a guess.
3. **Find the Server Action / `defineAction()` call** — `next-app/actions/*.ts` and any
   `lib/define-action.ts` usage is where permission exceptions hide (ownership-scoped
   `WHERE` clauses, role checks stacked with ownership checks, nullable-owner guest flows).
4. **Cite a file, not a memory** — every bullet above ends with a source pointer for a
   reason: six months from now nobody (human or agent) should have to re-derive "why is
   this 255 and not 200" from git blame. If you can't point at a line, don't assert the
   value — leave a `[TODO: confirm against code]` marker instead of guessing.
5. **Don't duplicate a doc↔code contract test.** If a value is already pinned by
   `next-app/lib/doc-contract.test.ts` (effort tiers, the RBAC capability matrix, plan
   prices, `StatusBadge` tones), point at the constant instead of copying its value here —
   see that test file's header comment for the full list and the reasoning.
6. **State the SSOT rule for your fork explicitly** at the top of your version of this
   file, the same way this one does — say which side wins when the digest and the code
   disagree (usually: the code, unless you have an external business-requirements doc that
   is genuinely authoritative over intent).
