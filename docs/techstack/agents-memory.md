# Agent Team & Memory System

## 6 AI Subagents

| Agent | Model | Trigger | Role |
|---|---|---|---|
| `@spec-writer` | opus | `/athena:spec` | OpenAPI-first feature spec |
| `@qa` | sonnet | `/athena:qa`, auto | Security review + test suite + 80% gate |
| `@best-practice` | opus | Architecture questions | Deep architecture advice, decision log |
| `@debugger` | sonnet | On errors (auto) | 5-phase root cause analysis |
| `@deployer` | sonnet | `/athena:deploy` | 6-gate protocol, Zeabur |
| `@memory-curator` | opus | `/athena:promote` | Extract wisdom -> template tier |

### QA Review Levels

```
RED Critical (must fix before merge)
   - import jwt (PyJWT), not python-jose
   - import bcrypt, not passlib
   - Access token only in tokenCache.ts
   - Protected routes have Depends(get_current_user)
   - No hardcoded secrets

YELLOW Warning (should fix)
   - openapi.yaml edited first?
   - React Query cache tier correct?
   - MSW handler for new endpoint?
   - Alembic migration if models changed?

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
| Auth & Identity | users, sessions, JWT, OAuth | Built-in |
| Domain Modules | Auto-discovered from server/app/domains/ | Customizable |

Domain modules share the Auth layer's JWT middleware. They only add new Alembic migrations and FastAPI routers -- no auth core changes.
