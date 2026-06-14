# E67 — Environment & Config Alignment

> **Phase**: 21 | **Size**: S (5 SP) | **Priority**: P1
> **Depends on**: E66 (email provider pattern must exist first)
> **Branch**: `feat/E67-env-config-alignment`

---

## Problem Statement

After E66 replaces SMTP with the provider pattern, the environment variables are misaligned:
- `config.py` still has 6 `SMTP_*` vars that no longer serve the email system
- No `EMAIL_PROVIDER` setting to select the active provider
- No root-level `.env.local` / `.env.production` templates (only `server/.env.example`)
- No `LOG_FORMAT` toggle for structured logging (console vs JSON)

## Solution

1. Replace `SMTP_*` vars in `config.py` with `EMAIL_PROVIDER`, `EMAIL_FROM`, and provider-specific keys
2. Create root-level `.env.local` (dev-ready, copy to `.env`) and `.env.production` (Zeabur template)
3. Add `LOG_FORMAT` setting (console/json) for production log aggregation
4. Update `docker-compose.yml` to use new env var names; make Mailpit profile-gated (optional)
5. Update `server/.env.example` to document new vars

## Stories

### S1: Config.py Migration

**AC**:
- [ ] Remove: `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_USE_TLS`
- [ ] Add: `EMAIL_PROVIDER: str = "console"` (enum: console/mailgun/zeabur)
- [ ] Add: `EMAIL_FROM: str = "noreply@example.com"`
- [ ] Add: `MAILGUN_API_KEY: str = ""`, `MAILGUN_DOMAIN: str = ""`
- [ ] Add: `ZEABUR_EMAIL_API_KEY: str = ""`
- [ ] Add: `LOG_FORMAT: str = "console"` (console/json)
- [ ] Existing validators unchanged

### S2: Root-Level Env Templates

**AC**:
- [ ] `.env.local` at project root: all dev defaults, ready to `cp .env.local server/.env`
- [ ] `.env.production` at project root: production template with placeholders and comments
- [ ] Both added to `.gitignore` exception (tracked, not ignored)
- [ ] `server/.env.example` updated to match new var names
- [ ] `client/.env.example` unchanged

### S3: Docker Compose Update

**AC**:
- [ ] Server service env: `SMTP_*` → `EMAIL_PROVIDER=console`, `EMAIL_FROM=noreply@example.com`
- [ ] Mailpit service moved to `mailpit` profile (optional, not started by default)
- [ ] `make db` only starts `db` (not mailpit) — mailpit via `docker compose --profile mailpit up -d`
- [ ] Existing docker-compose healthchecks unchanged

### S4: Documentation Update

**AC**:
- [ ] `server/.env.example` fully updated with new sections
- [ ] Comments explain each provider and when to use it
- [ ] `make go` still works without changes (reads `.env` as before)

## Risk Notes

- **Breaking change for env vars**: Anyone with an existing `.env` file using `SMTP_*` vars will need to update — but the template has no known external users yet (v1.0.0 just tagged)
- **Mailpit still available**: Not removed, just profile-gated — users who want full SMTP email preview can still use it
