# Spec Log — @spec-writer
> **Tier 1 Project Memory** · Owner: `@spec-writer`  
> Updated on each `/athena:spec` command completion.

---

## Current State

`docs/epics/e35-rbac-team-scoping.md` — RBAC & Team Scoping spec (ready for implement)
Last verified: 2026-03-30

---

## Completed Specs

### E35 RBAC & Team Scoping — 2026-03-14
- **Feature:** Team-based RBAC with viewer/editor/admin/owner roles
- **Spec file:** `docs/epics/e35-rbac-team-scoping.md`
- **OpenAPI additions:** 9 endpoints (teams tag), 8 schemas
- **New paths:** `/teams`, `/teams/{team_id}`, `/teams/{team_id}/members`, `/teams/{team_id}/members/{user_id}`
- **New schemas:** TeamRole, TeamCreate, TeamRead, TeamReadWithRole, TeamUpdate, TeamMemberCreate, TeamMemberRead, TeamMemberUpdate
- **DB tables:** `teams` (id, name, slug, timestamps), `team_members` (id, team_id, user_id, role, timestamps)
- **Dependencies design:** `require_role(min_role)` factory, `get_team_membership()` dependency
- **Domain:** `server/app/domains/teams/` (models, schemas, endpoints, dependencies)

### dev-docs-vite — 2026-03-07
- **Feature:** Standalone React + Vite documentation site
- **Spec file:** `docs/specs/dev-docs-vite.md`
- **Decision:** Standalone `dev-docs/` folder (not inside `client/`)
- **Deps:** React 18 + Vite only (no router, no state libs)
- **Theming:** Dark (default from DEVELOPER_DOCS.html) + light mode via CSS variables
- **19 section components**, 4 reusable UI primitives (CodeBlock, Callout, Table, FlowSteps)

---

## Track 1 — Auth & Identity (fastapi-users)

Implemented via `fastapi-users` library — no individual specs needed (library provides standard routes).

| Feature | Endpoints | Status |
|---|---|---|
| Auth register | `POST /auth/register` | ✅ Implemented |
| Auth login | `POST /auth/jwt/login` (form-data) | ✅ Implemented |
| Auth logout | `POST /auth/jwt/logout` | ✅ Implemented |
| Forgot password | `POST /auth/forgot-password` | ✅ Implemented |
| Reset password | `POST /auth/reset-password` | ✅ Implemented |
| Email verify | `POST /auth/verify` · `POST /auth/request-verify-token` | ✅ Implemented |
| Google OAuth | `GET /auth/google/authorize` · `GET /auth/google/callback` | ✅ Implemented |
| GitHub OAuth | `GET /auth/github/authorize` · `GET /auth/github/callback` | ✅ Implemented |
| User profile | `GET /users/me` · `PATCH /users/me` | ✅ Implemented |
| Admin users | `GET /users/{id}` · `PATCH /users/{id}` · `DELETE /users/{id}` | ✅ Implemented |
| Health | `GET /health` (DB probe + version) | ✅ Implemented |

---

## Next Action

```
Run /athena:spec when a new feature epic requires API design.
All Track 1 auth endpoints are implemented. E35 RBAC spec is ready for implement.
```

Last verified: 2026-03-30

<!-- Template for future entries:
## spec-writer — [ISO timestamp]
Branch: [branch] | Feature: [feature-name]

### Specs Completed
- [feature]: docs/specs/[feature].md — [N endpoints, N schemas]

### openapi.yaml Changes
- Added paths: [list]
- New schemas: [list]

### Current State
openapi.yaml: [N paths, N schemas total]

### Next Action
[what to implement next]

### Promote?
[GENERALIZABLE / PROJECT-SPECIFIC + reason]
-->

---

## spec — 2026-05-30 — Cycle 21 Phase 47–49 (11 epics, `/athena:plan`)
Branch: `main` | Commit: `9a7753a`

11 epic specs rendered via `/athena:plan approve` + "no limit 5 epics" override (parallel Sonnet workflow, grounded in the 2-workflow enhancement audit):
- **Phase 47 Foundation Truth**: E193 pipeline-event instrumentation · E194 skill-drift purge · E195 generator + design-system realignment · E196 state-file truth · E197 memory-loop closure
- **Phase 48 Ultracode Orchestration**: E198 effort/cost dial · E199 no-silent-caps + metrics · E200 Workflow-native qa panel (POC, depth B) · E201 Workflow-native batch pipeline
- **Phase 49 Template↔Plugin**: E202 dogfood-vs-canonical decision · E203 athena-core hardening

Epic files at `docs/epics/e{193..203}-*.md`. These are **tooling/meta-system** epics — no product endpoints, so the openapi-first `/athena:spec` flow does not apply (Phase 47–49 add zero API surface).

> ⚠️ NOTE: this log was itself stale (last real entry 2026-03-30, E35) and lines 9/24 reference `server/app/domains/teams/` which does NOT exist on disk — corroborates the doc-truth drift the completeness audit flagged (folds into the proposed Foundation-truth reconciliation).

### Pending follow-up (completeness audit, awaiting human gate)
Recommended Phase 47 additions: **guard self-test canary + Rule 18/19/20 branch-regex fix** (QA/migration/contract gates fail-open on real `feat/E{n}` branches); **expand E193** with Rule 6 read-only + dual-openapi reconcile; one **doc-truth reconciliation** epic.
