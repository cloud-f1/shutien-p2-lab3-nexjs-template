# E64 — DBA Skill + /athena:dba Command

> **Phase**: 20 — DBA Schema Management
> **Priority**: P1 | **Points**: 18
> **Depends on**: E62, E63 (skill documents the patterns those epics establish)
> **Source**: Migrated from ai-clock-work E92 — AI agents lack schema management knowledge

---

## Problem Statement

AI agents generate migrations by copying patterns from existing migration files. Since existing migrations may use inconsistent UUID representations and boolean defaults, the AI copies whichever pattern it finds first. There is no skill/context document teaching the correct patterns. Additionally, there's no command to quickly diff the SQLAlchemy model layer against the current database schema.

## Stories

### E64-S01: DBA Skill Document (5 pts)

**Task**: Finalize `.claude/skills/dba-migrations.md` — the skill document that teaches AI agents the correct migration patterns. (Already migrated as scaffold — needs validation against actual project state after E62/E63.)

**Content covers**:
- UUID type in migrations: `sa.Uuid()` (not CHAR/String/GUID)
- Boolean defaults: `sa.text("false")` / `sa.text("true")`
- FK constraints: always include `ondelete` policy
- Two-layer UUID design: GUID (models) vs sa.Uuid() (migrations)
- Pre-migration checklist, common errors, debugging guide

**Acceptance Criteria**:
- Given an AI agent starts a session
- When it loads the DBA skill
- Then it knows the correct UUID type, boolean default, and FK patterns
- And the skill is auto-loaded by `.claude/settings.json`

### E64-S02: Update server-patterns.md (3 pts)

**Task**: Remove any outdated advice from `.claude/skills/server-patterns.md` that references `String(36)` or `CHAR(36)` for UUID columns. Replace with correct patterns and cross-reference to DBA skill.

**Acceptance Criteria**:
- Given `server-patterns.md`
- When I search for `CHAR(36)` or `String(36)`
- Then zero matches are found
- And the Alembic section references the DBA skill for migration patterns

### E64-S03: /athena:dba Command (5 pts)

**Task**: Finalize `.claude/commands/athena/dba.md` — a multi-subcommand DBA tool. (Already migrated as scaffold — needs validation.)

**Subcommands**: `inspect`, `inspect NNN`, `lint`, `history`, `diagnose <error>`, `fix NNN`, `status`, `new <desc>`

**Acceptance Criteria**:
- Given migrations exist in `server/alembic/versions/`
- When I run `/athena:dba inspect`
- Then it shows a table of all migrations with tables, columns, indexes, and issues
- And `/athena:dba status` shows current head + linter status
- And `/athena:dba diagnose DatatypeMismatchError` suggests the exact fix

### E64-S04: Pre-Migration Hook (5 pts)

**Task**: Add a PreToolUse hook (or extend existing `pre-bash-guard.sh`) that triggers when `alembic revision` is run. The hook:
1. Warns if `--autogenerate` is not used (manual migrations are error-prone)
2. After generation, runs the E62 linter on the new file

**Acceptance Criteria**:
- Given I run `alembic revision -m "manual migration"` (without --autogenerate)
- When the hook fires
- Then it warns: "Consider using --autogenerate for type safety"
- And after any `alembic revision --autogenerate`, the linter runs on the new file

## Risk Notes

- **Low risk**: Skill documents and commands don't modify production code
- **Hook complexity**: Must distinguish between `alembic revision` and `alembic upgrade`
- **Skill loading**: Verify `.claude/settings.json` auto-loads the new skill

## Dependency Chain

```
E62 + E63 (patterns established) → E64-S01 (skill) ∥ E64-S02 (update old skill)
E64-S01 → E64-S03 (command) ∥ E64-S04 (hook)
```
