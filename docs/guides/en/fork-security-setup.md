# Fork Security Setup — Secrets + OWASP Top 10 Compliance

> You forked this template. The production-safety gates are already **enforced in code** — this guide tells you what *you* must do before going live, and which OWASP Top 10 (2021) items the template already defends so you know what **not** to weaken.
>
> Docs-only. Nothing here changes behavior — it explains gates that already exist.

---

## TL;DR

1. Generate `SECRET_KEY` and `REFRESH_SECRET_KEY` with `openssl rand -hex 32` (two **different** values).
2. Set them — plus a real `DATABASE_URL` — in `server/.env` (dev) and your host's env vars (prod).
3. Run `make doctor-production` and fix every ❌ before your first deploy.
4. Don't undo the inherited OWASP defenses (CORS allowlist, Pydantic validation, JSX auto-escape, fail-fast config). See the table in [§2](#2-owasp-top-10-2021-mapping).

If you skip step 1, **the server refuses to start in production** — `validate_production_config()` calls `SystemExit`. That is by design (see [`server/app/core/config.py:134-173`](../../../server/app/core/config.py)).

---

## 1. Secrets you must set

Every secret below is read by `Settings` in [`server/app/core/config.py`](../../../server/app/core/config.py). The "Code gate" column names the exact mechanism that enforces (or warns about) it — so you can verify each claim by reading the file.

| Secret | Purpose | Generate / obtain | Code gate that enforces it |
|---|---|---|---|
| `SECRET_KEY` | Signs access JWTs (HS256) | `openssl rand -hex 32` | `@field_validator` `_reject_placeholder_secret` rejects placeholders (`config.py:76-87`); `validate_production_config` `SystemExit`s in prod (`config.py:148-152`); `make doctor-production` flags placeholders + length < 32 |
| `REFRESH_SECRET_KEY` | Signs refresh JWTs (separate key) | `openssl rand -hex 32` — **must differ** from `SECRET_KEY` | `@field_validator` `_reject_placeholder_refresh` (`config.py:89-100`); `_check_secrets` model validator rejects `SECRET_KEY == REFRESH_SECRET_KEY` outside dev (`config.py:125-132`); `validate_production_config` (`config.py:153-157`) |
| `DATABASE_URL` | Postgres connection string | Your Postgres URL (`postgresql+asyncpg://...`) | `validate_production_config` `SystemExit`s if it contains `sqlite` in prod (`config.py:158-162`); `make doctor-production` rejects SQLite + empty |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth login | Google Cloud Console → OAuth 2.0 credentials | Optional (defaults `""`). `make doctor-production` ❌ if **no** OAuth provider is set |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth login | GitHub → Developer settings → OAuth Apps | Optional (defaults `""`). Same `make doctor-production` OAuth check |
| Email provider key (`MAILGUN_API_KEY` + `MAILGUN_DOMAIN`, or `ZEABUR_EMAIL_API_KEY`) | Transactional email (verify, reset) | Mailgun / Zeabur dashboard | `EMAIL_PROVIDER` defaults to `console` (logs only). `make doctor-production` ❌ if provider is still `console` in prod |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | Billing (if you use it) | Stripe dashboard → API keys + webhook signing secret | Optional (defaults `""`). No fail-fast — only needed if you enable billing |

**Where they live**

- **Dev:** `server/.env` — copy from [`server/.env.example`](../../../server/.env.example), which ships the placeholders (`SECRET_KEY=CHANGE_ME_TO_A_RANDOM_64_CHAR_HEX_STRING`, `REFRESH_SECRET_KEY=CHANGE_ME_REFRESH_SECRET`). `make go` generates real values for you.
- **Prod (Zeabur / Cloud Run / etc.):** set them as **host environment variables**, never commit them. `server/.env` is git-ignored.
- **Generate two distinct keys:**

  ```bash
  openssl rand -hex 32   # → SECRET_KEY
  openssl rand -hex 32   # → REFRESH_SECRET_KEY (run again — must differ)
  ```

For the **rotation** lifecycle (swapping a live key with zero downtime via `SECRET_KEY_PREVIOUS`), see [`docs/SECRET_ROTATION.md`](../../SECRET_ROTATION.md) — that runbook is the source of truth for rotation and is **not** duplicated here.

---

## 2. OWASP Top 10 (2021) mapping

What the template already defends, where the evidence lives, and the one thing a fork must not break. Every file:line is copy-verified against the current repo.

| OWASP 2021 | Template mitigation | File evidence | Don't break this |
|---|---|---|---|
| **A01 — Broken Access Control** | CORS allowlist, no wildcard. `allow_origins=settings.ALLOWED_ORIGINS` with `allow_credentials=True`; origins parsed from `ALLOWED_ORIGINS_STR` | [`server/app/main.py:51-63`](../../../server/app/main.py); allowlist source `config.py:64,119-121` | Never set `allow_origins=["*"]` — wildcard + credentials silently disables the protection. Keep it your real domains. `make doctor-production` ❌s `localhost` in prod origins |
| **A02 — Cryptographic Failures** | JWT signing keys gated against placeholders; HS256; dual-key rotation | Placeholder set `config.py:10-18`; validators `config.py:76-100`; rotation [`docs/SECRET_ROTATION.md`](../../SECRET_ROTATION.md) | Don't ship placeholder or short keys. Don't reuse one key for both access and refresh (`_check_secrets`, `config.py:125-132`) |
| **A03 — Injection / XSS** | Server input validated by **Pydantic v2** schemas; client renders via **React JSX auto-escaping** — **0** `dangerouslySetInnerHTML` in `client/src/` (verified) | Pydantic schemas (`server/app/schemas/`, see [`server/CLAUDE.md`](../../../server/CLAUDE.md) §2); JSX escape: `grep -rn "dangerouslySetInnerHTML" client/src/` → 0 hits | Don't add `dangerouslySetInnerHTML` (re-opens XSS with no warning). Don't accept raw SQL / unvalidated bodies — keep schemas on every endpoint |
| **A05 — Security Misconfiguration** | Production-config **fail-fast**: server `SystemExit`s on placeholder secrets or SQLite-in-prod at startup; API docs (`/docs`, `/redoc`) disabled unless `DEBUG` | `validate_production_config()` `config.py:134-173`, called in lifespan `main.py:21-26`; docs gating `main.py:32-33` | Don't set `DEBUG=true` in prod (exposes `/docs` + verbose errors). Don't bypass the lifespan startup check. `make doctor-production` ❌s `DEBUG=true` |
| **A07 — Identification & Authentication Failures** | `fastapi-users` **argon2** password hashing; **rate limiting** on auth (`RATE_LIMIT_AUTH = "15/minute"`); forgot-password **always 202** (anti-enumeration) | argon2 + 202 rule: [`server/CLAUDE.md`](../../../server/CLAUDE.md) §6; rate limit `config.py:65`, limiter `server/app/core/limiter.py`, wired `main.py:37-38`; default `200/minute` general | Don't lower/remove `RATE_LIMIT_AUTH`. Don't make forgot-password return 404 on unknown email (leaks which accounts exist) |

### Honest gaps — your responsibility (template does NOT fully address these)

These OWASP categories are **not** turn-key in the template. Stated plainly so you don't assume false coverage:

- **A04 — Insecure Design** — threat-modeling and abuse-case design for *your* features are on you; the template only ships the auth scaffold.
- **A06 — Vulnerable & Outdated Components** — no dependency-CVE scanner is wired by default. Add Dependabot / `pip-audit` / `pnpm audit` yourself.
- **A08 — Software & Data Integrity Failures** — no Subresource Integrity or supply-chain signing is configured.
- **A09 — Security Logging & Monitoring Failures** — structured logging + `request_id` exist (see [`sre-observability.md`](sre-observability.md)), **but** you must wire Sentry alerting and log retention for your environment; nothing alerts out of the box without `SENTRY_DSN_SERVER`.
- **A10 — Server-Side Request Forgery (SSRF)** — no outbound-request allowlisting; if you add code that fetches user-supplied URLs, you own the SSRF mitigation.

---

## 3. Fork pre-flight checklist

Copy-paste this and run it before your first production deploy. Every command is real and present in the repo.

```bash
# 1. Generate two DISTINCT signing keys
openssl rand -hex 32   # paste into SECRET_KEY
openssl rand -hex 32   # paste into REFRESH_SECRET_KEY  (must differ!)

# 2. Set secrets in server/.env (dev) and host env vars (prod):
#    SECRET_KEY, REFRESH_SECRET_KEY, DATABASE_URL (PostgreSQL, not SQLite),
#    a real EMAIL_PROVIDER (mailgun/zeabur) + key, OAuth IDs if used.

# 3. Run the production readiness diagnostic — fix every ❌:
make doctor-production
#    Checks (scripts/doctor-production.sh): placeholder/empty/short secrets,
#    SECRET_KEY != REFRESH_SECRET_KEY, PostgreSQL (not SQLite), email provider
#    not 'console', at least one OAuth provider, no pending migrations,
#    DEBUG off, no 'localhost' in ALLOWED_ORIGINS_STR, key length >= 32,
#    client build succeeds.
```

Then confirm by inspection:

- [ ] `ENVIRONMENT=production` is set in prod — this is what makes `validate_production_config()` actually run (it returns early for dev/test). See `config.py:143-144`.
- [ ] `ALLOWED_ORIGINS_STR` is **your** domains, comma-separated — **not** `*`, not `localhost`. CORS reads it at `main.py:53`.
- [ ] `SECRET_KEY` and `REFRESH_SECRET_KEY` are different 64-hex-char values, neither a placeholder.
- [ ] `DATABASE_URL` is PostgreSQL (`postgresql+asyncpg://...`), never SQLite, in prod.
- [ ] `DEBUG` is `false`/unset in prod (keeps `/docs` + `/redoc` closed — `main.py:32-33`).
- [ ] No `dangerouslySetInnerHTML` was added to `client/src/` during your customization.

If `make doctor-production` exits `0`, and the boxes above are checked, your inherited security posture is intact.

---

## 4. See also

- [`docs/SECRET_ROTATION.md`](../../SECRET_ROTATION.md) — zero-downtime JWT secret **rotation** (dual-key `*_PREVIOUS`). The lifecycle companion to this setup guide.
- [`deploy-guide.md`](deploy-guide.md) — choosing a platform and where to put secrets per host.
- [`deploy-walkthrough.md`](deploy-walkthrough.md) — step-by-step first deploy.
- [`sre-observability.md`](sre-observability.md) — logging, `request_id` triage, Sentry (covers A09 wiring).
- Source of truth for the gates this guide describes: [`server/app/core/config.py`](../../../server/app/core/config.py), [`server/app/main.py`](../../../server/app/main.py), [`scripts/doctor-production.sh`](../../../scripts/doctor-production.sh).
