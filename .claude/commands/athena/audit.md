---
description: "(planning) Drift check → Drizzle schema ↔ Zod validation ↔ Server Action / Route Handler / UI consistency, plus doc↔code constant drift + brand/identity staleness."
allowed-tools: Read, Bash, Grep, Glob
---

# /athena:audit — Schema ↔ Validation ↔ Surface ↔ Docs Drift Audit

Perform a consistency check across the Next.js app. Two planes:

- **Data-layer drift** (the core): **Drizzle schema ↔ shared Zod validation ↔ the Server
  Actions / Route Handlers / UI that consume them** (Steps 1–5 below). There is no OpenAPI
  contract in this stack — this is the alignment that matters.
- **Knowledge drift** (Step 6): the things that silently rot *outside* the type system —
  **doc↔code constant drift** (a doc restates a threshold/enum/flag the code no longer
  backs) and **brand/identity staleness** (a fork's old product name / repo slug / docs
  domain surviving in live identity files after a rebrand). These have no compiler to
  catch them, so the audit is the safety net.

## Sources

1. **Drizzle schema** (`next-app/lib/schema/{auth,items,billing,system}.ts`, barrel
   `lib/schema/index.ts`) — the tables, columns, `pgEnum`s, and constraints.
2. **Shared Zod validation** (`next-app/lib/validations/*.ts`) — the schemas used by
   both the client (RHF) and the server (Server Actions) to validate input.
3. **Surfaces** — `next-app/actions/*.ts` (Server Actions, `"use server"`),
   `next-app/app/api/**/route.ts` (Route Handlers), and the forms/pages under
   `app/` + `components/` that submit to them.

## Audit Steps

### Step 1: Extract the schema
Read `lib/schema/*.ts`. List every table, its columns (name + Drizzle type +
nullable/default), every `pgEnum` with its allowed values, and the constraints
(PK / UNIQUE / FK / index).

### Step 2: Extract the validation
Read `lib/validations/*.ts`. List every exported Zod schema, its fields, and any
enum allowlists (e.g. `VALID_ROLES`). Note which Drizzle table each maps to.

### Step 3: Extract the surfaces
- Grep `actions/*.ts` for exported Server Actions and the tables they mutate
  (`db.insert/update/delete(...)`), plus the RBAC guard on the first line
  (`requireAuth` / `requireEditor` / `requireAdmin`).
- Grep `app/api/**/route.ts` for Route Handlers and their methods.
- Note which UI forms (`app/`, `components/`) post to each action.

### Step 4: Cross-reference
Produce a gap report as a markdown table:

| Table / Field | Schema | Zod | Surface | Status |
|---------------|--------|-----|---------|--------|
| `items.title` | ✅ | ✅ | ✅ action+form | Aligned |
| `invitations.role` | ✅ (enum) | ✅ `VALID_ROLES` | ✅ | Aligned |
| `webhooks.secret` | ✅ | ❌ | ✅ action | NO validation |
| (zod `legacyField`) | ❌ | ✅ | — | Zod field with no column |

### Step 5: Drift checks
Flag each of these:
- **Unvalidated input** — a Server Action writes a table column with no corresponding
  Zod field (input reaches the DB unchecked).
- **Orphan validation** — a Zod field with no matching DB column (stale schema).
- **Enum drift** — a `pgEnum`'s values disagree with the Zod enum allowlist and/or the
  TS union type (e.g. `roleEnum ["admin","editor","viewer"]` vs `VALID_ROLES`).
- **RBAC gap** — a mutating Server Action (`db.insert/update/delete`) whose first line
  is NOT a `requireAuth`/`requireEditor`/`requireAdmin` guard (defense-in-depth; UI
  hiding is not a control — Server Actions are public POST endpoints).
- **Untested surface** — a Route Handler or Server Action with no test under `lib/**`,
  `e2e/`, or a co-located `*.test.ts`.

**Fork note (RBAC gap check, Step 5):** a downstream fork/product may add a **second RBAC guard
family** alongside `lib/permissions.ts` (a product-layer permissions module, or a
resource-scoped `defineAction()`-style factory's `authorize` hook). When present, check the
**union** of guard families actually used in the codebase before flagging an action as
ungated — grep the fork's actual guard call sites, don't assume only the template's canonical
`requireAuth`/`requireEditor`/`requireAdmin` names are in play.

### Step 6: Knowledge drift (docs ↔ code, brand/identity)
Two checks for things the type system can't catch. Run when `$ARGUMENTS` is empty or
contains `docs`/`brand`; skip for a scoped data-layer run (e.g. `auth`).

**6a · Doc↔code constant drift.** Hard numbers/enums live in code (Drizzle `pgEnum`s,
`lib/validations/*.ts` allowlists, constants in `lib/*.ts`) and get **restated in prose**
elsewhere — `docs/`, `dev-docs/` (VitePress user guide), README, skills, or code comments.
Nothing keeps the two in sync once they diverge.

**Run the automated guard FIRST** — `cd next-app && pnpm test doc-contract`
(`lib/doc-contract.test.ts`, E341). It already pins the four contracts most likely to rot
silently, each with an inline comment naming its doc source:
- **Effort-tier knobs** (E198) — `CLAUDE.md` § Effort Tiers vs `scripts/effort/resolve.sh`.
- **RBAC capability matrix** — `docs/qa/manual-test-plan/README.md` § 4 vs `lib/team-utils.ts`
  (`CAPABILITIES`/`PERMISSION_MATRIX`), plus a guard that `PERMISSION_MATRIX`'s role keys
  track the `Role` union (`lib/schema`) via `roleEnum.enumValues`.
- **Plans / pricing** — `config/pricing.json` vs `lib/billing/pricing.ts` (tier slugs/prices/
  currency, marketing-page wiring) + `lib/usage-utils.ts` (UNLIMITED-by-default convention).
- **Status tones** — `.claude/skills/design-system/SKILL.md` § StatusBadge Tones vs
  `components/status-badge.tsx` `TONES`.

If it's green, **do not re-derive those four by hand** — trust the test and move on. If it's
red, the failing assertion's inline comment tells you the doc file + section to fix (fix
BOTH the code constant and the doc, never just the test).

**Then hand-compare what the test structurally cannot cover** — prose the type system can't
touch and that isn't (yet) a doc-contract entry:
- **Stop-verifier rule count/table** — the rule table in `scripts/hooks/CLAUDE.md` vs the
  rules actually implemented in `scripts/hooks/stop-verifier.sh` (rule numbers, blocking
  vs warning, exemption markers).
- Process descriptions, screenshots, example commands, and any other threshold a fork's
  `docs/` prose asserts that isn't pinned yet (cron cadence, coverage gate %, page size
  defaults) — trace it back to the code constant and flag disagreement either direction
  (doc says X, code says Y — OR code changed and the doc was never updated).

Flag any number/enum the docs assert that the code no longer backs (or vice versa).
*(Best-practice follow-up: when a hand-compared item recurs across audits, promote it to a
`doc-contract.test.ts` entry — see the 判準 in `docs/context/qa-patterns.md` § "doc↔code
契約測試" and the `testing-strategy` skill § 6b.)*

**6b · Brand/identity staleness.** Drive this off the template's single-knob branding
source of truth: `next-app/lib/branding.ts` (`APP_NAME` — defaults to `NEXT_PUBLIC_APP_NAME`,
falling back to `"AI App Template"` if unset). A fork that rebrands often updates the
*current* product name but leaves the **old** repo slug / product name / docs domain
buried in live identity files — a grep for the *new* name never surfaces these survivors.
1. Read `next-app/lib/branding.ts` to establish the CURRENT product name (the `APP_NAME`
   default, or `NEXT_PUBLIC_APP_NAME` if set in env files).
2. Grep the live identity set for strings that look like a product name / repo slug /
   docs domain but do NOT match the current one: root `README.md`, `CLAUDE.md`,
   `package.json` (`name`/`description`/repo URL fields), `next-app/package.json`,
   `dev-docs/.vitepress/config.mts`, `dev-docs/index.md`. Look especially at: `git clone`
   command lines, CI/star badges, `socialLinks`, `editLink`, page `title`/`description`
   frontmatter, and any hardcoded product name in JSX/markdown that isn't importing
   `APP_NAME` from `lib/branding.ts`.
3. Exclude append-only history — do NOT flag `docs/epics/**`, `docs/releases/**`,
   `docs/context/**`, or `CHANGELOG.md` (these are historical record, not live identity).
Flag survivors as `file:line` + the stale string. Pairs with the `rebrand` skill.

### Step 7: Summary
Report:
- Tables: {count} · Zod schemas: {count} · Server Actions: {count} · Route Handlers: {count}
- Fully aligned: {count}
- Unvalidated inputs: {list}
- Orphan validations: {list}
- Enum drift: {list}
- RBAC gaps: {list}
- Untested surfaces: {list}
- **Doc↔code constant drift: {list}** (the doc-stated value vs the code value)
- **Brand/identity staleness: {list}** (file:line + the stale string)

## Output
Write the audit report to stdout (not to a file). The user decides what to do with the findings.

## Rules
- This is a **read-only** audit — do NOT modify any source files.
- Do NOT write the report to a file unless the user explicitly asks.
- If `$ARGUMENTS` is provided, use it to filter (e.g., `billing` audits only the
  billing schema/validation/actions; `auth` only the auth surface).
- This command covers the **data-layer + docs/brand** half of drift. For the
  **UI-surface** half — dead links, orphan pages, missing tabs/sections/deep-links,
  RBAC-vs-nav mismatches — run `/athena:align` instead (or in addition).
