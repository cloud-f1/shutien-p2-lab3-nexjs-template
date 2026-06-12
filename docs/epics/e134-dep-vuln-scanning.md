# E134 — Dependency Vulnerability Scanning

> **Size**: S (3 SP) | **Depends on**: E129 | **Phase**: 34

## Goal

Ensure both `pip-audit` (Python) and `pnpm audit` (JS) run in the weekly
security audit workflow, matching the per-PR scanning already in `ci.yml`.

## Scope

1. **`audit.yml`** — add Python setup + `uv sync` + `pip-audit` alongside existing `pnpm audit`
2. **`ci.yml`** — verify E129 changes present (pip-audit in backend, pnpm audit in frontend)
3. Add strategy comment block explaining CI vs weekly audit roles

## Out of Scope

- Snyk / Dependabot integration
- Auto-issue creation on vulnerability detection (future enhancement)

## Acceptance Criteria

- [ ] `audit.yml` runs both `pip-audit` and `pnpm audit` on weekly schedule
- [ ] `ci.yml` confirmed: `pip-audit` after `uv sync`, `pnpm audit --audit-level=high`
- [ ] Both workflow files pass YAML syntax validation
