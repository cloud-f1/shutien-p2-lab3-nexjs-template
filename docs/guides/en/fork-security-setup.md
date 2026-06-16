# Fork Security Setup — Secrets + OWASP Top 10 Compliance

> You forked this template. The app is **secure by default** — this guide tells you what *you* must do before going live, and which OWASP Top 10 (2021) items the template already defends so you know what **not** to weaken.
>
> Docs-only. Nothing here changes behavior — it explains defenses that already exist.

---

## TL;DR

1. Generate a real `AUTH_SECRET` with `openssl rand -hex 32` (or `npx auth secret`).
2. Set it — plus a real `DATABASE_URL` (Postgres) — in `next-app/.env.local` (dev) and your host's env vars (prod).
3. Confirm `AUTH_SECRET` and `DATABASE_URL` are real (not placeholders), and that no server secret leaks through a `NEXT_PUBLIC_*` var, before your first deploy.
4. Don't undo the inherited OWASP defenses (Auth.js + RBAC guards, shared Zod validation, Drizzle parameterized queries, JSX auto-escape). See the table in [§2](#2-owasp-top-10-2021-mapping).

If you skip step 1, **Auth.js can't sign sessions** — Auth.js v5 *requires* a real `AUTH_SECRET` and will fail to issue/verify the JWT session without one. The DB-backed RBAC guards likewise depend on a valid `DATABASE_URL`. This is by design — see the Auth.js config in `next-app/auth.config.ts` / `next-app/lib/auth.ts` and `next-app/.env.example`.

---

## 1. Secrets you must set

Next.js reads these from the environment via `process.env`. There is no FastAPI-style lifespan gate; instead the practical enforcement is that Auth.js v5 won't sign sessions without `AUTH_SECRET`, and the RBAC guards won't work without `DATABASE_URL`. You can see how each is consumed in `next-app/auth.config.ts` / `next-app/lib/auth.ts` and `next-app/.env.example`.

| Secret | Purpose | Generate / obtain | What enforces it |
|---|---|---|---|
| `AUTH_SECRET` | Signs the Auth.js v5 JWT session (single secret — there is no separate access/refresh key) | `openssl rand -hex 32` or `npx auth secret` | Auth.js v5 *requires* it: without a real secret it throws / cannot sign or verify the session JWT. Use a high-entropy value, never a placeholder, never commit it |
| `DATABASE_URL` | Postgres connection string | Your Postgres URL (`postgresql://user:pass@host:port/db`) | The app talks to Postgres via Drizzle (`postgres-js`). Use a real Postgres URL in production — the app expects Postgres, not SQLite |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (`AUTH_GOOGLE_*`) | Google OAuth login | Google Cloud Console → OAuth 2.0 credentials | Optional. Only needed if you enable the Google provider |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` (`AUTH_GITHUB_*`) | GitHub OAuth login | GitHub → Developer settings → OAuth Apps | Optional. Only needed if you enable the GitHub provider |
| Email provider key | Transactional email (verify, reset) | Your email provider's dashboard | Optional. Wire it if you send verification / password-reset mail |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | Billing (if you use it) | Stripe dashboard → API keys + webhook signing secret | Optional. Only needed if you enable billing |

**Where they live**

- **Dev:** `next-app/.env.local` — copy from [`next-app/.env.example`](../../../next-app/.env.example), which ships the placeholders (`AUTH_SECRET=replace-me-with-a-32-char-random-secret`, `DATABASE_URL=postgresql://user:password@host:5432/dbname`). Replace them with real values.
- **Prod (Zeabur / Cloud Run / etc.):** set them as **host environment variables**, never commit them. `.env.local` is git-ignored. Remember `NEXT_PUBLIC_*` vars are **baked into the client bundle at build time** — set those before the build, and never put a secret behind a `NEXT_PUBLIC_` prefix.
- **Generate a real secret:**

  ```bash
  openssl rand -hex 32   # → AUTH_SECRET
  # or:
  npx auth secret        # writes a generated AUTH_SECRET for you
  ```

If `AUTH_SECRET` is ever leaked, **rotate it** — generate a fresh value and redeploy. Note that rotating `AUTH_SECRET` invalidates all existing sessions (everyone is signed out), so plan the swap accordingly.

---

## 2. OWASP Top 10 (2021) mapping

What the template already defends, where the evidence lives, and the one thing a fork must not break.

| OWASP 2021 | Template mitigation | Where it lives | Don't break this |
|---|---|---|---|
| **A01 — Broken Access Control** | Single-origin Next.js app — there is no cross-origin client/server split to expose. Access control is enforced server-side by Auth.js + RBAC guards that **re-read the role from the DB on every request** (3-tier admin/editor/viewer) | Auth.js config `next-app/auth.config.ts` / `next-app/lib/auth.ts`; role guards `next-app/lib/permissions.ts`, `next-app/lib/is-admin.ts` | Don't weaken the RBAC guards or expose a Route Handler / Server Action without an auth + role check. A default same-origin app needs no wildcard CORS — *if* you add cross-origin Route Handlers, set their CORS deliberately (never `*` with credentials) |
| **A02 — Cryptographic Failures** | Auth.js v5 signs the session JWT with `AUTH_SECRET` (a single high-entropy secret) | `next-app/auth.config.ts` / `next-app/lib/auth.ts`; secret in `next-app/.env.example` | Don't ship a placeholder or short secret. Rotate `AUTH_SECRET` if it leaks — note that rotation invalidates existing sessions |
| **A03 — Injection / XSS** | Server input is validated by **shared Zod schemas** (used by Server Actions + forms); DB access via **Drizzle** uses **parameterized queries** (no raw SQL string-building); React/JSX **auto-escapes** — **0** `dangerouslySetInnerHTML` in `next-app/` (verify with grep below) | Zod schemas `next-app/lib/validations/`; Drizzle queries `next-app/lib/`; JSX escape: `grep -rn "dangerouslySetInnerHTML" next-app/app next-app/components` → 0 hits | Don't add `dangerouslySetInnerHTML` (re-opens XSS with no warning). Don't accept unvalidated request bodies — keep a Zod schema on every Server Action and Route Handler, and let Drizzle parameterize queries instead of building SQL strings |
| **A05 — Security Misconfiguration** | No FastAPI `/docs` or `/redoc` surface, and no startup `SystemExit` gate to bypass. Secrets stay server-side; only truly-public values carry the `NEXT_PUBLIC_` prefix | `next-app/.env.example` (note the `NEXT_PUBLIC_*` build-time warning) | Don't run with `NODE_ENV=development` in prod or expose verbose error output. Ensure `AUTH_SECRET` + `DATABASE_URL` are real. Don't leak server secrets via `NEXT_PUBLIC_*` — those are baked into the client bundle at build time |
| **A07 — Identification & Authentication Failures** | Auth.js v5 **Credentials** provider; passwords are hashed with a strong adaptive hash (**bcrypt** via `next-app/lib/password.ts`) before storage in the Drizzle users table; sessions are JWT | Credentials provider `next-app/auth.config.ts` / `next-app/lib/auth.ts`; hashing `next-app/lib/password.ts`; users table `next-app/lib/schema/` | Recommended hardening: add **rate limiting** on the login route and any password-reset route you build (a `login:`-keyed limiter helper lives at `next-app/lib/rate-limit.ts` — wire it deliberately for your deployment). Make any forgot-password endpoint return the **same response for known and unknown emails** (anti-enumeration) — don't 404 on unknown email |

### Honest gaps — your responsibility (template does NOT fully address these)

These OWASP categories are **not** turn-key in the template. Stated plainly so you don't assume false coverage:

- **A04 — Insecure Design** — threat-modeling and abuse-case design for *your* features are on you; the template only ships the auth scaffold.
- **A06 — Vulnerable & Outdated Components** — no dependency-CVE scanner is wired by default. Add Dependabot / `pnpm audit` yourself.
- **A08 — Software & Data Integrity Failures** — no Subresource Integrity or supply-chain signing is configured.
- **A09 — Security Logging & Monitoring Failures** — there is **no** built-in structured `request_id` logging or Sentry wiring out of the box. Logging and alerting are something **you must add** for your environment — wire your Sentry DSN (or another logging/error service) and set up log retention. Nothing alerts until you do.
- **A10 — Server-Side Request Forgery (SSRF)** — no outbound-request allowlisting; if you add code that fetches user-supplied URLs, you own the SSRF mitigation.

---

## 3. Fork pre-flight checklist

Run through this before your first production deploy.

```bash
# 1. Generate a real signing secret
openssl rand -hex 32   # paste into AUTH_SECRET
# or: npx auth secret

# 2. Set secrets in next-app/.env.local (dev) and host env vars (prod):
#    AUTH_SECRET, DATABASE_URL (PostgreSQL, not SQLite),
#    OAuth IDs / email provider key if you use them.
#    Make sure no secret is behind a NEXT_PUBLIC_ prefix.
```

Then confirm by inspection:

- [ ] Prod env is configured for production — `NODE_ENV=production` for the Next.js build/runtime, and `AUTH_SECRET` + `DATABASE_URL` are real (not placeholders).
- [ ] `AUTH_SECRET` is a real high-entropy value, not the placeholder from `.env.example`.
- [ ] `DATABASE_URL` is a real PostgreSQL URL (`postgresql://user:pass@host:port/db`), never SQLite, in prod.
- [ ] No server secret is exposed via a `NEXT_PUBLIC_*` var (those are baked into the client bundle at build time).
- [ ] `NODE_ENV=production` — don't expose verbose error output.
- [ ] If you added cross-origin Route Handlers, their CORS is set to your real domains (never `*` with credentials). A default single-origin app needs no CORS config.
- [ ] No `dangerouslySetInnerHTML` was added to `next-app/` during your customization.

If those boxes are checked, your inherited security posture is intact.

---

## 4. See also

- [`deploy-guide.md`](deploy-guide.md) — choosing a platform and where to put secrets per host.
- [`deploy-walkthrough.md`](deploy-walkthrough.md) — step-by-step first deploy.
- Source of truth for the defenses this guide describes: the Auth.js config (`next-app/auth.config.ts` / `next-app/lib/auth.ts`), the shared Zod validations (`next-app/lib/validations/`), `next-app/.env.example`, and the project's `nextjs-saas-patterns` skill / `CLAUDE.md` for the Auth.js v5 + JWT + RBAC gotchas.
