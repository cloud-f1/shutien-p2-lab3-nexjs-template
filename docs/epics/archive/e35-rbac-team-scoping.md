# E35: RBAC & Team Scoping

> **Phase**: 13 | **Size**: L (21 SP) | **Priority**: P0
> **Depends on**: no deps
> **Source**: Strategy Cycle 2 — COMPLY finding #1 (OWASP A01), RESEARCH gap #1

---

## Problem Statement

Currently any authenticated user can access/modify any resource. The `is_superuser` flag from fastapi-users exists but there's no role-based access control, no team/org model, and no resource ownership checks. This is OWASP A01 (Broken Access Control) — the #1 web security risk. Every SaaS competitor (SaaStr Kit, Shipfast, Bedrock) ships RBAC out of the box.

## Stories

### S1: Role Model & Migration
**As a** SaaS developer,
**I want** a roles system with viewer/editor/admin levels,
**So that** I can control what each user can do.

**Acceptance Criteria:**
- [ ] OpenAPI spec updated FIRST with role-related schemas
- [ ] `Role` enum: `viewer`, `editor`, `admin`, `owner`
- [ ] `TeamMember` model: user_id, team_id, role (FK relationships)
- [ ] `Team` model: id, name, slug, created_at, owner_id
- [ ] Alembic migration for new tables
- [ ] Default: first user in a team gets `owner` role

### S2: Team CRUD Endpoints
**As a** team owner,
**I want** to create/manage teams and invite members,
**So that** I can organize my SaaS workspace.

**Acceptance Criteria:**
- [ ] `POST /api/v1/teams` — create team (creator becomes owner)
- [ ] `GET /api/v1/teams` — list user's teams
- [ ] `GET /api/v1/teams/{team_id}` — get team details
- [ ] `PATCH /api/v1/teams/{team_id}` — update team (owner/admin only)
- [ ] `DELETE /api/v1/teams/{team_id}` — delete team (owner only)
- [ ] `GET /api/v1/teams/{team_id}/members` — list members
- [ ] `POST /api/v1/teams/{team_id}/members` — invite member with role
- [ ] `PATCH /api/v1/teams/{team_id}/members/{user_id}` — change role
- [ ] `DELETE /api/v1/teams/{team_id}/members/{user_id}` — remove member
- [ ] Only owner/admin can manage members

### S3: Resource Ownership Middleware
**As a** domain developer,
**I want** a `@require_role` decorator and ownership check middleware,
**So that** I can protect endpoints with one line of code.

**Acceptance Criteria:**
- [ ] `require_role(min_role)` FastAPI dependency for endpoint-level checks
- [ ] `get_team_membership()` dependency for retrieving user's role in a team
- [ ] Domain endpoints (places, portfolios) scoped to team — user A cannot see user B's resources
- [ ] 403 Forbidden returned for unauthorized access (not 404)
- [ ] Superuser bypasses all checks

### S4: Client-Side Role Guards
**As a** frontend developer,
**I want** React components that show/hide UI based on user role,
**So that** the UI reflects the user's permissions.

**Acceptance Criteria:**
- [ ] `useCurrentTeam()` hook — returns active team + user's role
- [ ] `<RoleGuard role="admin">` component — conditionally renders children
- [ ] Team switcher in dashboard sidebar
- [ ] Invite flow UI (email + role picker)

### S5: Tests
**Acceptance Criteria:**
- [ ] Server: role dependency tests, ownership middleware tests, team CRUD tests
- [ ] Client: RoleGuard tests, team switcher tests
- [ ] Coverage >= 80% on new code

## Risk Notes

- Scope creep: multi-tenancy (data isolation per team at DB level) is NOT in scope — just scoping via FK
- fastapi-users `is_superuser` continues to work as a global bypass
- Existing endpoints need ownership checks added retroactively

---

## Technical Design

### Database Models

#### `teams` table
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `GUID` (UUIDMixin) | PK, default uuid4 |
| `name` | `String(100)` | NOT NULL |
| `slug` | `String(100)` | NOT NULL, UNIQUE, INDEX |
| `created_at` | `DateTime(tz)` | TimestampMixin |
| `updated_at` | `DateTime(tz)` | TimestampMixin |

#### `team_members` table
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `GUID` (UUIDMixin) | PK, default uuid4 |
| `team_id` | `GUID` | FK → teams.id, ON DELETE CASCADE |
| `user_id` | `GUID` | FK → user.id, ON DELETE CASCADE |
| `role` | `String(20)` | NOT NULL, CHECK IN (viewer, editor, admin, owner) |
| `created_at` | `DateTime(tz)` | TimestampMixin |
| `updated_at` | `DateTime(tz)` | TimestampMixin |

**Constraints:**
- `UNIQUE(team_id, user_id)` — one membership per user per team
- `INDEX(team_id)`, `INDEX(user_id)` for join performance

#### Role Enum (Python)
```python
class Role(str, Enum):
    viewer = "viewer"    # read-only access
    editor = "editor"    # read + write resources
    admin = "admin"      # manage members + resources
    owner = "owner"      # full control, can delete team
```

Role hierarchy: `viewer < editor < admin < owner`

### Domain Structure

New domain: `server/app/domains/teams/`
```
teams/
  __init__.py
  models.py      # Team, TeamMember, Role enum
  schemas.py     # Pydantic schemas (from OpenAPI)
  endpoints.py   # Team CRUD + member management
  dependencies.py  # require_role, get_team_membership
```

### Middleware / Dependencies Design

```python
# dependencies.py — FastAPI dependencies, NOT decorators

async def get_team_membership(
    team_id: uuid.UUID,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
) -> TeamMember:
    """Get user's membership in a team. Raises 403 if not a member.
    Superuser bypasses and gets synthetic owner membership."""

def require_role(min_role: Role):
    """Factory that returns a FastAPI dependency checking minimum role.
    Usage: member = Depends(require_role(Role.admin))"""
```

**Integration with existing endpoints:**
- Domain endpoints accept `team_id` header or query param (`X-Team-Id`)
- `get_team_scoped_user()` dependency: resolves user + active team context
- Existing `Place.user_id` / `Portfolio.user_id` queries become team-scoped:
  `WHERE team_id = :team_id` instead of `WHERE user_id = :user_id`
- NOTE: Adding `team_id` FK to places/portfolios is a **migration** — existing rows get NULL (nullable FK, backfill later)

### Migration Plan

1. **Migration 1**: Create `teams` + `team_members` tables (no existing table changes)
2. **Migration 2**: Add nullable `team_id` FK to `places` and `portfolios` tables
3. Backfill script (optional, post-deploy): create personal team for each user, assign their resources

### OpenAPI Additions

See `docs/openapi.yaml` — new tag `teams`, 9 endpoints, 8 schemas added.

### QA Patterns Checklist (from qa-patterns.md)

- [ ] `satisfies z.ZodType<ApiType>` on TeamRead, TeamMemberRead, etc. Zod schemas
- [ ] Explicit return types on exported service functions
- [ ] ARIA attrs on team switcher, role picker, invite dialog
- [ ] MSW handlers for all 9 team endpoints
- [ ] `userEvent` in all client tests
- [ ] Coverage >= 80% per module
