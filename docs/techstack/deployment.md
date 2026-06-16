# Deployment — Zeabur (primary) / GCP Cloud Run

> One Next.js service (`next-app/`) built as a standalone server, talking to a
> managed PostgreSQL. There is no separate server/client deploy — the whole app
> ships as a single unit. Zeabur is the primary target; GCP Cloud Run + Cloud SQL
> is the alternate.

## Environment Variables

All env vars belong to the single `next-app/` service. The split that matters is
**build-time vs runtime**, not server vs client.

### Build-time (baked into the bundle)

| Variable | Example | Note |
|---|---|---|
| `NEXT_PUBLIC_*` | `NEXT_PUBLIC_APP_NAME=AI App Template` | Inlined into client JS at **build time** — set in the platform BEFORE the build runs |

> Any `NEXT_PUBLIC_*` value is frozen at build time. Changing it requires a rebuild,
> not just a restart.

### Runtime (read by the server process)

| Variable | Example | Required |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | Yes |
| `AUTH_SECRET` | `openssl rand -base64 32` | Yes — signs the JWT session |
| `AUTH_URL` / `NEXTAUTH_URL` | `https://app.example.com` | Prod (canonical URL for callbacks) |
| `AUTH_GOOGLE_ID` | `xxx.apps.googleusercontent.com` | Google sign-in |
| `AUTH_GOOGLE_SECRET` | `GOCSPX-xxx` | Google sign-in |
| `SMTP_*` | host / user / password / from | Email feature |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | — | Stripe billing |
| `ECPAY_MERCHANT_ID` / `ECPAY_HASH_KEY` / `ECPAY_HASH_IV` | — | ECPay billing |

> **`AUTH_SECRET` gotcha:** sessions are **JWT**, so a missing/rotated `AUTH_SECRET`
> invalidates every existing session and breaks login. Set it once, keep it stable.

> **`DATABASE_URL` / lazy-init gotcha:** `lib/db.ts` initializes the Drizzle client
> **lazily** so the build does not need a live database — `pnpm build` (which renders
> static segments) won't crash when `DATABASE_URL` is absent at build time. The URL
> only needs to be present at runtime.

## Pre-deploy Gates (all must pass)

Run from the repo root via `scripts/pre-merge-check.sh [--e2e]`, or directly:

```bash
cd next-app
pnpm typecheck                 # tsc --noEmit, no errors
pnpm lint                      # eslint-config-next
pnpm test:coverage             # vitest, >= 80% gate
pnpm test:e2e                  # playwright (needs seeded DB + dev server)
git status --porcelain         # clean
git branch --show-current      # = main
```

> No `pytest`, no `@redocly/cli` OpenAPI lint — those belonged to the removed stack.

## Build & Run

```bash
cd next-app
pnpm build      # standalone Next.js build (.next/standalone)
pnpm db:migrate # apply pending Drizzle migrations against DATABASE_URL
pnpm start      # boot the standalone server
```

## Road 1 — Zeabur (primary)

- `next-app/` is a single service with a `zbpack.json`.
- Set `NEXT_PUBLIC_*` (build-time) and the runtime secrets in Zeabur **before** the
  first build.
- Run `pnpm db:migrate` as part of the release (pre-start step) so the schema is
  current before the server boots.
- Health check: the platform can probe `GET /api/health` after startup.

```bash
# Push triggers the Zeabur build/deploy
git push origin main

# After startup, verify health
curl --fail https://your-app.zeabur.app/api/health
```

## Road 2 — GCP Cloud Run + Cloud SQL

- Containerize the standalone build; deploy the image to **Cloud Run**.
- Use **Cloud SQL (PostgreSQL)**; connect via the Cloud SQL connector (the
  socket/instance form of `DATABASE_URL`).
- `NEXT_PUBLIC_*` must be present at image-build time; runtime secrets (`DATABASE_URL`,
  `AUTH_SECRET`, `AUTH_*`) are injected as Cloud Run env vars / Secret Manager.
- Apply migrations (`pnpm db:migrate`) as a release job before routing traffic.

> See the `deploy-config` skill for the full per-road CLI walkthrough and the
> Cloud SQL connector wiring.

## Rollback

```bash
# Preferred: git revert (preserves history) -> redeploy
git revert HEAD && git push origin main

# Platform-native: roll back to the previous Zeabur build / previous Cloud Run revision
```
