# E104 — Runtime Environment Safety — Fail-Fast on Insecure Defaults

> **Phase 29** | Priority: P1 | Points: 8 | Size: M
> **Depends on**: E103 (dead config cleaned first)

---

## Problem Statement

The server starts successfully even with `CHANGE_ME` placeholder secrets when `ENVIRONMENT=production`. A developer deploying this template could accidentally go live with insecure defaults. `config.py` has `_PLACEHOLDER_VALUES` detection but only uses it for `_is_test_env()` gating — not for blocking production startup.

## Stories

### S1: Production Startup Validator

**AC:**
- [ ] On startup, if `ENVIRONMENT == "production"`:
  - Check `SECRET_KEY` is not in `_PLACEHOLDER_VALUES` → raise `SystemExit` with clear error
  - Check `REFRESH_SECRET_KEY` is not placeholder → raise `SystemExit`
  - Check `DATABASE_URL` is not SQLite → raise `SystemExit`
- [ ] Validator runs in `main.py` lifespan before app starts serving
- [ ] Development and test environments are NOT affected (only production gate)
- [ ] Error messages are clear and actionable: "Set SECRET_KEY to a secure random value"

### S2: `make doctor --production` Mode

**AC:**
- [ ] `make doctor` accepts `--production` flag
- [ ] Production mode checks: secrets not placeholder, email provider configured, DB URL is PostgreSQL, at least one OAuth provider or explicit opt-out
- [ ] Output: checklist with ✅/❌ per item
- [ ] Exit code 1 if any production check fails (for CI use)

### S3: Tests for Safety Gates

**AC:**
- [ ] Unit test: startup with placeholder secrets + ENVIRONMENT=production → SystemExit
- [ ] Unit test: startup with placeholder secrets + ENVIRONMENT=development → no error
- [ ] Unit test: startup with real secrets + ENVIRONMENT=production → no error

## Risk Notes

- Must not break dev/test environments — gate is production-only
- `ENVIRONMENT` env var must be correctly set in Zeabur for gate to activate
- Depends on E103 having cleaned dead config so the validator checks a clean surface

## Files to Touch

```
server/app/main.py                     — update: add startup validator in lifespan
server/app/core/config.py              — update: add validate_production_config() method
Makefile                               — update: add --production flag to doctor target
server/tests/unit/test_config.py       — update: add production safety gate tests
```
