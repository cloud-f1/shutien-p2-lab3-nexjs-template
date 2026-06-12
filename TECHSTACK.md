# {{PROJECT_DISPLAY}} — Tech Stack Summary

> **React 18 . FastAPI . PostgreSQL**
> SDD + TDD . Domain Modules . 7-Agent Team
> Upload this file to restore full context in any Claude session.
> Product overview → [PRD.md](docs/PRD.md)

---

## How to Use This Document

```
Restore context:
  Option A (Claude Code):  SessionStart hook auto-loads session-summary.md + primer
  Option B (Any interface): Upload this TECHSTACK.md -> full context in one file
  Option C (Checkpoint):   "Update your document" -> agent writes current state
```

## Detailed Docs (split for context control)

| Topic | File |
|---|---|
| Architecture + project structure | [docs/techstack/architecture.md](docs/techstack/architecture.md) |
| Server (FastAPI, DB, security) | [docs/techstack/server.md](docs/techstack/server.md) |
| Client (React, cache, auth flow) | [docs/techstack/client.md](docs/techstack/client.md) |
| OpenAPI contract + SDD/TDD | [docs/techstack/openapi-workflow.md](docs/techstack/openapi-workflow.md) |
| Deployment (Zeabur, env vars) | [docs/techstack/deployment.md](docs/techstack/deployment.md) |
| Agent team + memory system | [docs/techstack/agents-memory.md](docs/techstack/agents-memory.md) |

---

## Quick Reference

### Stack

| Layer | Tech |
|---|---|
| Client | React 18 + Vite + TypeScript + Zustand + React Query |
| Server | FastAPI 0.115 + Python 3.12 + Pydantic v2 |
| Auth | PyJWT 2.9 (`import jwt`) + bcrypt 4.x (`import bcrypt`) |
| DB | PostgreSQL 15 + SQLAlchemy 2.x async + Alembic |
| Testing | pytest (asyncio_mode=auto) + Vitest + MSW + Playwright |
| Deploy | Zeabur (server + client as separate services) |

### Non-Negotiable Rules

1. `docs/openapi.yaml` edited FIRST -- never write code before the spec
2. `import jwt` (PyJWT) -- never python-jose (unmaintained, CVEs)
3. `import bcrypt` -- never passlib (unmaintained since 2023)
4. Access token in `tokenCache.ts` (in-memory) -- never localStorage
5. React Query tiers from `cacheConfig.ts` -- never hardcode staleTime
6. Folders: `server/` and `client/` -- never `backend/` or `frontend/`
7. Coverage gate: >= 80% both suites -- blocks deploy

### Token Design

| Token | TTL | Storage |
|---|---|---|
| Access (JWT HS256) | 15 min | `tokenCache.ts` in-memory |
| Refresh | 30 days | httpOnly cookie (prod) / localStorage (dev) |

### Cache Tiers

| Tier | staleTime | Data Type |
|---|---|---|
| STATIC | 1 hr | User profile, settings |
| SEMI_DYNAMIC | 15 min | Domain list data |
| SECURITY | 5 min | Sessions, auth state |
| REALTIME | 1 min | Live updates |

### Core Tables

```
users          UUID PK, email, password_hash (nullable for social), is_verified
sessions       UUID PK, user_id FK, refresh_token_hash, expires_at
social_accounts UUID PK, user_id FK, provider, provider_user_id
# Domain tables are auto-discovered from server/app/domains/
```

### Agent Team (6 agents — consolidated from 8)

| Agent | Model | Trigger | Doc |
|---|---|---|---|
| @spec-writer | opus | /athena:spec | spec-log.md |
| @qa | sonnet | /athena:qa, auto | review-log.md + test-status.md |
| @best-practice | opus | auto | decisions.md |
| @debugger | sonnet | auto | debug-log.md |
| @deployer | sonnet | /athena:deploy | deploy-log.md |
| @memory-curator | sonnet | /athena:promote | template-memory/ |

### Domain Architecture

| Layer | Content | Status |
|---|---|---|
| Auth & Identity | users, sessions, JWT, OAuth | Built-in |
| Domain Modules | Auto-discovered from server/app/domains/ | Customizable |

### Security Defenses

| Threat | Defense |
|---|---|
| XSS token theft | Access token in-memory only |
| Refresh replay | Token rotation on every refresh |
| Email enumeration | forgot-password always returns 200 |
| Brute force | slowapi 5 req/min on auth routes |
| Sequential ID | UUID v4 primary keys |

### Key Commands

```bash
/athena:spec "feature"   # Design OpenAPI spec
/athena:implement feat   # TDD: RED -> GREEN -> REFACTOR
/athena:qa               # Code review + test suite (--review-only | --test-only)
/athena:pr               # Pre-PR pipeline
/athena:deploy           # 6-gate Zeabur deploy
/athena:save             # All agents checkpoint
/athena:load             # Restore full context
/athena:promote          # Extract wisdom -> template tier
```

### Environment Variables

```
# Server (server/.env)
DATABASE_URL, SECRET_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
ALLOWED_ORIGINS, DEBUG, SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM

# Client (client/.env.local)
VITE_API_URL          # Baked at BUILD TIME, set before build
```

---

*{{PROJECT_DISPLAY}} . Tech Stack Summary . v3.0.0*
*Detailed docs in docs/techstack/ . Agent memory in docs/context/*
