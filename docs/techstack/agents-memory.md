# Agent Team & Memory System

## 6 AI Subagents

| Agent | Model | Trigger | Role |
|---|---|---|---|
| `@spec-writer` | opus | `/athena:spec` | Feature spec (Server Actions / Route Handlers + Zod) |
| `@qa` | sonnet | `/athena:qa`, auto | Security review + test suite + 80% gate |
| `@best-practice` | opus | Architecture questions | Deep architecture advice, decision log |
| `@debugger` | sonnet | On errors (auto) | 5-phase root cause analysis |
| `@deployer` | sonnet | `/athena:deploy` | Multi-gate protocol, Zeabur / Cloud Run |
| `@memory-curator` | opus | `/athena:promote` | Extract wisdom -> template tier |

### QA Review Levels

```
RED Critical (must fix before merge)
   - Session is JWT; AUTH_SECRET set; no token in JS-readable storage
   - Password hashing via bcryptjs (lib/password.ts)
   - Protected routes guarded by proxy.ts + requireAuth/requireAdmin
   - RBAC re-reads role from DB (lib/permissions.ts), not just the JWT
   - No hardcoded secrets

YELLOW Warning (should fix)
   - Server Action validates with shared Zod (lib/validations/*)?
   - Default to Server Component; "use client" only where needed?
   - Drizzle migration generated if schema/* changed?
   - CRUD uses modal + <DataTable>, action returns success (no redirect)?

GREEN Suggestion (nice to have)
   - Naming clarity
   - Duplicate logic extraction
   - TypeScript strictness
```

## Memory System

### Context Restore Options

**A -- Claude Code (automatic):** SessionStart hook loads `docs/context/session-summary.md` + template primer.

**B -- Any Claude interface:** Upload `TECHSTACK.md` -> full context in one file.

**C -- Checkpoint anytime:** Say "update your document" -> agent writes to its designated doc.

### Agent -> Document Map

| Agent | Write-back Target |
|---|---|
| All agents | `docs/context/session-summary.md` |
| `@spec-writer` | `docs/context/spec-log.md` |
| `@qa` | `docs/context/review-log.md` + `docs/context/test-status.md` |
| `@best-practice` | `docs/context/decisions.md` + `TECHSTACK.md` |
| `@debugger` | `docs/context/debug-log.md` |
| `@deployer` | `docs/context/deploy-log.md` |
| `@memory-curator` | `~/.claude/template-memory/*.md` |

## Domain Architecture

| Layer | Content | Status |
|---|---|---|
| Auth & Identity | users, accounts, JWT sessions, RBAC (admin/editor/viewer) | Built-in |
| Domain Modules | Drizzle schema (lib/schema/*) + Server Actions (actions/*) + app/ routes | Customizable |

Domain modules share the Auth layer: routes are gated by `proxy.ts` (edge) and
`requireAuth`/`requireAdmin` (`lib/permissions.ts`), and mutations run through
Server Actions. A new domain adds a Drizzle table (+ generated SQL migration), a
Server Action file, and its `app/` pages -- no auth core changes.
