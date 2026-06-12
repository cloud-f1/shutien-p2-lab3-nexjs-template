# E45 — Env Validation & Smart Defaults

> **Size**: S (8 SP) | **Priority**: P0 | **Phase**: 16
> **Dependencies**: none

---

## Problem Statement

`SECRET_KEY` placeholder is not validated — beginners run with `CHANGE_ME_TO_A_RANDOM_64_CHAR_HEX_STRING` and get silent auth issues. `REFRESH_SECRET_KEY` is required but missing from `.env.example`. OAuth/SMTP placeholders look like real config. No diagnostic tool exists to validate the environment.

## Stories

### S1: Startup Env Validation
**Acceptance Criteria**:
- [ ] `server/app/core/config.py` validates SECRET_KEY is not the placeholder on startup
- [ ] Fails with clear error: "SECRET_KEY is still the default placeholder. Run `make setup` or set a random hex string."
- [ ] Same validation for REFRESH_SECRET_KEY
- [ ] Validation only runs in non-test environments

### S2: Complete `.env.example`
**Acceptance Criteria**:
- [ ] `REFRESH_SECRET_KEY` added to `server/.env.example` with placeholder
- [ ] OAuth vars clearly marked as `# Optional — uncomment to enable`
- [ ] SMTP vars clearly marked as `# Optional — uncomment to enable`
- [ ] Comments explain what each var does and where to get values

### S3: `scripts/generate-env.sh`
**Acceptance Criteria**:
- [ ] Interactive script: generates `.env` with random secrets
- [ ] Asks about optional features: "Enable Google OAuth? (y/N)"
- [ ] Auto-generates SECRET_KEY and REFRESH_SECRET_KEY via `openssl rand -hex 32`
- [ ] Falls back to Python `secrets.token_hex(32)` if openssl unavailable
- [ ] Called by `make go` if `.env` doesn't exist

### S4: `make doctor` — Environment Diagnostic
**Acceptance Criteria**:
- [ ] Checks: DB reachable, env vars valid, ports available, Python/Node versions correct
- [ ] Each check shows ✓ pass or ✗ fail with actionable fix instructions
- [ ] Checks SECRET_KEY is not placeholder
- [ ] Checks PostgreSQL is running and accessible
- [ ] Checks ports 8000 and 5173 are available
- [ ] Exit code 0 = all healthy, 1 = issues found

### S5: Unified Port Documentation
**Acceptance Criteria**:
- [ ] README, quickstart, docker-compose all agree on port numbers
- [ ] Dev mode: server `:8000`, client `:5173`
- [ ] Docker mode: server `:8000`, client `:3000` (nginx)
- [ ] Table in README clearly shows both modes

## Technical Notes

- Validation in `config.py`: use a Pydantic `@field_validator` on SECRET_KEY
- `make doctor` can be a bash script calling individual checks
- Port docs: search all `.md` files for `:3000` and `:5173` references, unify
- `generate-env.sh` should be idempotent — skip if `.env` already exists (with `--force` override)
