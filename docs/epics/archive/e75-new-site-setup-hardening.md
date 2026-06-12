# E75 — New-Site Setup Hardening

> **Phase**: 23 | **Size**: S (5 SP) | **Priority**: P1
> **Depends on**: E73
> **Branch**: `MH/feat/E75-new-site-setup-hardening`

---

## Problem Statement

`scripts/new-site/setup.ts` calls `createdb` directly, requiring local PostgreSQL client tools. The template uses Docker Compose for PostgreSQL — users without a local Postgres installation get a silent failure. Additionally, the generated `.env` file is missing post-E66 env vars (`EMAIL_PROVIDER`, `EMAIL_FROM`).

## Stories

### S1: Docker-Based DB Creation

**AC**:
- [ ] Replace raw `createdb` call with `docker compose exec db createdb` or equivalent
- [ ] Fall back to `make ensure-db` + `make migrate` pattern (consistent with `make go`)
- [ ] Add clear error message if Docker is not running
- [ ] Test both Docker and local Postgres paths

### S2: Env File Generation Alignment

**AC**:
- [ ] `generateEnvContent()` includes `EMAIL_PROVIDER=console` (default)
- [ ] `generateEnvContent()` includes `EMAIL_FROM=noreply@localhost`
- [ ] `generateEnvContent()` includes `LOG_FORMAT=console` (default)
- [ ] Remove any stale `SMTP_*` var references
- [ ] Generated `.env` matches current `server/.env.example` structure

### S3: Error Recovery Guidance

**AC**:
- [ ] Each setup step prints actionable guidance on failure (not just "failed")
- [ ] DB connection failure: suggests `docker compose up -d db`
- [ ] Missing tools: suggests `make doctor` for diagnostics

## Risk Notes

- Changes are localized to `scripts/new-site/setup.ts`
- Must not break existing `make go` flow (which handles DB separately)
