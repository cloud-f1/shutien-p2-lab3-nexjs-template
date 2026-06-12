# E214 — Fork-Safe Secrets Setup + OWASP Top 10 Compliance Guide

> Phase 51 — Stabilize + Phase 2 Foundation | Size: L (15 SP) | Deps: none

## Problem

The template's production safety is enforced **in code** but never **explained to a fork user**. A fork inherits real placeholder-secret detection and a hardcoded set of OWASP mitigations, yet has no setup guide that maps "what the code does" to "what you, the fork owner, must do."

Concrete evidence (verified):

- **Secret-placeholder detection lives only in code.** `server/app/core/config.py:10-17` defines `_PLACEHOLDER_VALUES` (`CHANGE_ME_TO_A_RANDOM_64_CHAR_HEX_STRING`, its `_refresh` variant, `CHANGE_ME_REFRESH_SECRET`, `changeme`, `secret`). Two `@field_validator`s (`config.py:76-100`) reject these on `SECRET_KEY` / `REFRESH_SECRET_KEY`, and `validate_production_config()` (`config.py:134-173`) hard-`SystemExit`s on startup if a production env still carries them. A fork user only discovers this by *crashing the server* — there is no doc that says "generate these first, here's how."
- **Rotation runbook exists but is not fork-onboarding-shaped.** `docs/SECRET_ROTATION.md` (31 lines) documents *zero-downtime rotation* (`SECRET_KEY_PREVIOUS` dual-key) — an operational task for an *already-running* deployment. It does not cover first-time secret generation, which secrets a new fork must set, or where they live per environment. It is English-only.
- **OWASP mitigations are implemented but unmapped.** The codebase already mitigates several OWASP Top 10 (2021) items, but no doc names them, so a fork cannot reason about its own posture or know what *not* to weaken:
  - **A01 Broken Access Control** — CORS allowlist: `server/app/main.py:51-59` sets `allow_origins=settings.ALLOWED_ORIGINS` (no wildcard) with `allow_credentials=True`; the allowlist is `ALLOWED_ORIGINS_STR` (`config.py:64`). A fork that sets `["*"]` here silently breaks this.
  - **A02 Cryptographic Failures** — JWT signing keys gated by the placeholder validators above; rotation via `docs/SECRET_ROTATION.md`.
  - **A03 Injection / XSS** — server input validated by Pydantic v2 schemas (per `server/CLAUDE.md` §2); client renders via React JSX auto-escaping (`grep dangerouslySetInnerHTML client/src/` → **0 hits**, verified). A fork adding `dangerouslySetInnerHTML` reopens the XSS surface with no warning.
  - **A07 Identification & Authentication Failures** — fastapi-users argon2 hashing + rate limiting (`server/app/core/limiter.py`, `RATE_LIMIT_AUTH = "15/minute"` at `config.py:65`) + forgot-password 202-always anti-enumeration (`server/CLAUDE.md` §6).

There is no security guide anywhere under `docs/guides/en/` or `docs/guides/zh-TW/` (verified: `grep -i owasp docs/guides/` returns only `brainstorm-first.md` mentions, no setup guide). The bilingual guide structure exists and is the correct home for this.

**Critic flag (recorded honestly):** demand for this guide is *inferred*, not signalled by a fork user — this is the lowest-confidence item of Cycle 23 and a trim candidate. Scope is therefore kept docs-only and deliberately small.

## Solution

Ship a single bilingual fork-onboarding security guide that (a) walks a fork through first-time secrets setup mapped to the existing code gates, and (b) maps the template's existing mitigations onto OWASP Top 10 (2021) so a fork knows its inherited posture and what it must not weaken. Docs-only — **no code or behavior changes.**

1. **Secrets setup section** — enumerate every secret a fork must set before first production deploy, each tied to the real code gate that enforces it: `SECRET_KEY` / `REFRESH_SECRET_KEY` (placeholder validators), `DATABASE_URL` (SQLite-rejected in prod), OAuth client IDs/secrets, email provider keys, `STRIPE_*`. Give the exact generation command (`openssl rand -hex 32`) and the per-environment placement (`.env` for dev — `server/.env.example` is the template; Zeabur env vars for prod). Cross-link `docs/SECRET_ROTATION.md` for the *rotation* lifecycle (do not duplicate it).
2. **OWASP Top 10 mapping table** — one row per relevant OWASP 2021 category, columns: *Category · Template mitigation · File evidence · Fork "don't break this"*. Cover at minimum A01 (CORS allowlist), A02 (JWT key gating + rotation), A03 (Pydantic validation + React JSX escaping), A05 (production-config fail-fast), A07 (rate limit + anti-enumeration). Mark categories the template does **not** address as the fork's responsibility (honest gaps, not false claims).
3. **Fork pre-flight checklist** — a short copy-paste checklist a fork runs before going live: generate secrets, run `make doctor-production` (`scripts/doctor-production.sh`, verified to exist), confirm `ENVIRONMENT=production` triggers `validate_production_config()`, confirm CORS allowlist is *their* domains not `*`.
4. **Bilingual parity** — ship `docs/guides/en/fork-security-setup.md` and `docs/guides/zh-TW/fork-security-setup.md`. Per the user-docs rule, the 繁體中文 file is authoritative for the user-facing voice; both must carry identical structure, identical file-evidence citations, and identical checklists.

## Key Files

| File | Action |
|---|---|
| `docs/guides/en/fork-security-setup.md` | New — English fork secrets-setup + OWASP Top 10 mapping guide |
| `docs/guides/zh-TW/fork-security-setup.md` | New — 繁體中文 parity guide (authoritative user-facing voice) |
| `docs/SECRET_ROTATION.md` | Read-only reference — cross-linked, NOT modified (rotation lifecycle stays here) |
| `docs/guides/en/deploy-guide.md` | Edit (optional) — add a one-line link to the new security guide in the pre-deploy section |
| `docs/guides/zh-TW/deploy-guide.md` | Edit (optional) — same one-line link, parity with en/ |
| `CLAUDE.md` | Edit (optional) — add the guide to the deployment/secrets pointer list if guides are enumerated there |

## Implementation

1. Re-read the three evidence sources verbatim before writing a single claim: `server/app/core/config.py` (lines 10-17 placeholder set; 76-100 validators; 134-173 `validate_production_config`), `server/app/main.py:48-59` (CORS), `docs/SECRET_ROTATION.md`. Every file:line citation in the guide must be copy-checked against the current repo — no inherited or invented line numbers.
2. Draft `docs/guides/en/fork-security-setup.md` with four sections in order: **(1) Secrets you must set** (table: secret · purpose · generate-command · code gate that enforces it), **(2) OWASP Top 10 (2021) mapping** (table per §Solution step 2), **(3) Fork pre-flight checklist** (copy-paste, references `make doctor-production`), **(4) See also** (cross-link `SECRET_ROTATION.md`, `deploy-guide.md`, `sre-observability.md`).
3. Write the 繁體中文 parity file `docs/guides/zh-TW/fork-security-setup.md` — same four-section skeleton, same tables, same file:line evidence, 繁中 prose. Verify table row count and citations match the en/ file exactly (no drift between the two).
4. Add the optional one-line cross-link in both `deploy-guide.md` files (en + zh-TW) pointing to the new guide, and (optional) a pointer line in `CLAUDE.md` deployment/secrets area if guides are listed there.
5. Verification pass (docs-only — no test suite involved): for each OWASP row, re-grep the cited file to confirm the mitigation still exists at the cited location (e.g. `grep -n "allow_origins" server/app/main.py`; `grep -rn "dangerouslySetInnerHTML" client/src/` returns 0; `_PLACEHOLDER_VALUES` still present at `config.py:12`). Confirm `scripts/doctor-production.sh` exists so the checklist command is real.

## Acceptance Criteria

- [ ] `docs/guides/en/fork-security-setup.md` exists with all four sections: Secrets-you-must-set, OWASP Top 10 mapping, Fork pre-flight checklist, See-also
- [ ] `docs/guides/zh-TW/fork-security-setup.md` exists in 繁體中文 with byte-for-structure parity: same section count, same table rows, same file:line citations as the en/ file
- [ ] The secrets table covers `SECRET_KEY`, `REFRESH_SECRET_KEY`, `DATABASE_URL`, OAuth (`GOOGLE_*` / `GITHUB_*`), email provider key, and `STRIPE_*` — each row names the code gate (validator / fail-fast) that enforces it
- [ ] The OWASP table maps at least A01 (CORS allowlist → `server/app/main.py:51-59`), A02 (JWT key gating + `SECRET_ROTATION.md`), A03 (Pydantic validation + React JSX escaping, 0 `dangerouslySetInnerHTML`), A05 (`validate_production_config` fail-fast), A07 (rate limit `RATE_LIMIT_AUTH` + forgot-password anti-enumeration)
- [ ] Every file:line citation in both guides is copy-verified against the current repo (no stale or invented line numbers) — a reviewer can `grep` each one and find it
- [ ] The pre-flight checklist references a real command (`make doctor-production` / `scripts/doctor-production.sh`, verified to exist) — no aspirational tooling
- [ ] OWASP categories the template does NOT address are listed honestly as fork responsibility — no false coverage claims
- [ ] `docs/SECRET_ROTATION.md` is cross-linked, not duplicated or modified
- [ ] No code, schema, or test files are touched (`git diff --stat` shows only `docs/` and optional `CLAUDE.md`)

## Alignment / Cross-Epic Hooks

- **Sibling docs-only epic E215** (WCAG AA extension guide for custom domains) ships in the same Phase 51 wave and follows the identical bilingual-guide pattern (`docs/guides/{en,zh-TW}/`). Soft-sequencing only — the two share a guide-authoring style but have **no hard dependency**; either can land first.
- **Extends the fork-safety principle from E210** (deploy/launch skill fork-safety gating) and E202/E203 (plugin fork-safety) into the *security-onboarding-docs* layer — same "don't let a fork inherit a footgun silently" class, applied to secrets + OWASP posture instead of deploy SOP.
- **Reuses the existing bilingual guide structure** (`docs/guides/en/` + `docs/guides/zh-TW/`) established for the deploy / sre-observability guides — no new doc infrastructure.
- **Critic-flagged low-confidence item** — demand is inferred, not signalled; kept deliberately docs-only and minimal so it is the cheapest item to trim if the cycle shrinks.

## Out of Scope

- Any change to `server/app/core/config.py`, the placeholder-secret detection, or the production-config fail-fast — this epic *documents* the existing gates, it does not alter them.
- New runtime security mechanisms (CSP headers, secret-scanning hook, automated `.env` linting) — guidance only; net-new enforcement is a separate epic if demand materializes.
- Rewriting or restructuring `docs/SECRET_ROTATION.md` — it is cross-linked as the rotation reference and left intact.
- A fork-customization wizard or interactive secrets generator — the copy-paste checklist + `make doctor-production` is sufficient for v1.
- Covering OWASP categories with no template mitigation as if they were handled — honest gaps are stated, not papered over.
- Any product feature, endpoint, or client UI change — ATHENA-meta-system / template-quality docs only.

## Provenance

- Spec source: `/athena:plan auto` Cycle 23 (2026-06-02) — proposed as E214 ("Fork-safe secrets setup + OWASP Top 10 compliance guide"); critic flagged demand as inferred (lower confidence, trim candidate).
- Approved via `/athena:plan approve all` on 2026-06-02.
