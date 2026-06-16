---
description: "(planning) Drift check → Drizzle schema ↔ Zod validation ↔ Server Action / Route Handler / UI consistency."
allowed-tools: Read, Bash, Grep, Glob
---

# /athena:audit — Schema ↔ Validation ↔ Surface Drift Audit

Perform a consistency check across the data layer of the Next.js app. There is no
OpenAPI contract — the alignment that matters now is **Drizzle schema ↔ shared Zod
validation ↔ the Server Actions / Route Handlers / UI that consume them**.

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

### Step 6: Summary
Report:
- Tables: {count} · Zod schemas: {count} · Server Actions: {count} · Route Handlers: {count}
- Fully aligned: {count}
- Unvalidated inputs: {list}
- Orphan validations: {list}
- Enum drift: {list}
- RBAC gaps: {list}
- Untested surfaces: {list}

## Output
Write the audit report to stdout (not to a file). The user decides what to do with the findings.

## Rules
- This is a **read-only** audit — do NOT modify any source files.
- Do NOT write the report to a file unless the user explicitly asks.
- If `$ARGUMENTS` is provided, use it to filter (e.g., `billing` audits only the
  billing schema/validation/actions; `auth` only the auth surface).
