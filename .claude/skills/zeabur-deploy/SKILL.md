---
name: zeabur-deploy
description: >
  Deploy this Next.js app to a Zeabur dedicated server end-to-end via the `zeabur` CLI —
  project + PostgreSQL + web service + domain + env + migrate + seed + verify. Use when the
  user says "deploy to Zeabur", "deploy to my server <name>", "spin up a dev/staging instance",
  or wants a fresh cloud instance of the app. Encodes the exact non-interactive CLI flow and the
  five gotchas that bite (dotfile-dropping uploader, deprecated marketplace, standalone runtime
  can't migrate, NEXT_PUBLIC bakes at build, env-then-redeploy ordering). Pairs with deploy/
  deploy-zeabur.sh (the interactive script) — this skill is the headless, server-targeted path.
user-invocable: true
---

# Zeabur Deploy — Next.js app → dedicated server, end-to-end

The repo is ONE Next.js service (`next-app/`) + a managed PostgreSQL. The `zeabur` CLI deploys
it, but several steps are non-obvious and the defaults fight you. This is the verified flow for
this template (Next.js App Router + Auth.js v5 + Drizzle ORM).

## Prereqs

- `zeabur` CLI installed (`brew install zeabur/tap/zeabur`) and `ZEABUR_API_KEY` in the env
  (the CLI auto-uses it). Verify: `zeabur server list --json -i=false` returns data.
- Always pass `--json -i=false` — the CLI is interactive by default and will hang in automation.

## The flow (run from repo root unless noted)

**1. Find the dedicated server's region ID.** A dedicated server appears as a *region* whose
ID is literally `server-<serverId>`:

```bash
zeabur server list --json -i=false            # → pick {ID,Name}; region id = "server-<ID>"
```

**2. Create the project on that region:**

```bash
zeabur project create --name dev-<slug> --region server-<serverId> --json -i=false
# → capture project id (PID)
```

**3. Provision PostgreSQL — from a TEMPLATE, not the marketplace.** The prebuilt marketplace is
DEPRECATED (`MARKETPLACE_IS_DEPRECATED`). Use the official PostgreSQL template `B20CX0`:

```bash
zeabur template deploy --code B20CX0 --project-id <PID> --json -i=false
# verify: zeabur service list --project-id <PID> --json   → service "postgresql"
```

Other services reference its connection string as `${POSTGRES_CONNECTION_STRING}`.

**4. Deploy the web service from `next-app/`** (uploads local source, builds server-side):

```bash
cd next-app && zeabur deploy --create --name web --project-id <PID> --json -i=false
# → capture service_id (SID) + environment_id (EID)
```

**5. Generate a domain** (need the URL before env, because NEXT_PUBLIC bakes at build):

```bash
zeabur domain create --id <SID> --env-id <EID> --domain <slug> -g -y --json -i=false
# → https://<slug>.zeabur.app
```

**6. Set env vars, then REDEPLOY.** Write `${POSTGRES_CONNECTION_STRING}` *literally* (escape it
so your shell doesn't expand it to empty). `AUTH_TRUST_HOST=true` lets Auth.js v5 work behind the
proxy. `NEXT_PUBLIC_*` are build-time, so they only take effect on the *next* build:

```bash
cat > /tmp/web.env <<EOF
DATABASE_URL=\${POSTGRES_CONNECTION_STRING}
AUTH_SECRET=$(openssl rand -base64 32)
AUTH_URL=https://<slug>.zeabur.app
AUTH_TRUST_HOST=true
NEXT_PUBLIC_APP_URL=https://<slug>.zeabur.app
NEXT_PUBLIC_APP_NAME=AI App Template   # or your product name
NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true     # dev/staging only — set false for production
EOF
zeabur variable env --id <SID> --env-id <EID> -f /tmp/web.env --json -i=false
cd next-app && zeabur deploy --service-id <SID> --environment-id <EID> --json -i=false   # rebuild
```

Watch it: `zeabur deployment list --service-id <SID> --env-id <EID> --json` → status goes
`BUILDING → DEPLOYING → RUNNING`. On `FAILED`, read the build log (see Gotcha 1):
`zeabur deployment log --deployment-id <DID> --type build`.

**7. Migrate + seed — from your MACHINE against the Postgres PUBLIC endpoint.** The runtime
image is Next.js *standalone* (no pnpm, no `drizzle/`, no drizzle-kit) so you CANNOT
`zeabur service exec -- pnpm db:migrate`. Instead get the public TCP endpoint and run locally:

```bash
zeabur service network --id <PG_SID> --env-id <EID> --json   # → portForwardedHost + forwardedPort
# user=root, db=POSTGRES_DB ("zeabur"), pw=PASSWORD var (zeabur variable list --id <PG_SID> ...)
cd next-app
mv .env.local .env.local.bak 2>/dev/null   # park local URL so drizzle-kit can't pick it up
DATABASE_URL="postgresql://root:<PW>@<host>:<fwdPort>/zeabur" pnpm db:migrate
DATABASE_URL="postgresql://root:<PW>@<host>:<fwdPort>/zeabur" pnpm db:seed   # dev/staging only
mv .env.local.bak .env.local 2>/dev/null
```

The seed creates three demo accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `Admin123!` |
| Editor | `editor@example.com` | `Editor123!` |
| Viewer | `viewer@example.com` | `Viewer123!` |

**8. Verify** — curl + a real headless email login:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<slug>.zeabur.app/login        # 200
curl -s https://<slug>.zeabur.app/api/health                                    # {"status":"ok"}
# headless: goto /login → fill input[name=email] + input[name=password] → expect /dashboard
```

**9. Smoke-test the demo logins** (if `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true`):

```bash
# via Playwright or curl:
# POST /api/auth/signin with email=admin@example.com, password=Admin123! → redirect to /dashboard
```

## The five gotchas (each cost a debug round)

1. **The uploader drops root dotfiles.** `zeabur deploy`'s local tar omits `.npmrc`, so a
   Dockerfile `COPY .npmrc ./` fails with `"/.npmrc": not found`. Fix in the Dockerfile: don't
   COPY it — recreate inline (`RUN printf 'onlyBuiltDependencies=esbuild\n' > .npmrc`). It's
   needed because pnpm 10 blocks esbuild's build script otherwise and `next build` fails.
   (Already fixed in `next-app/Dockerfile`.)
2. **Marketplace is deprecated** → provision DBs from a **template** (`template deploy --code`),
   not `service deploy --template PREBUILT --marketplace-code`. Error:
   `MARKETPLACE_IS_DEPRECATED`.
3. **Standalone runtime can't self-migrate** → the `.next/standalone` image has no `drizzle-kit`
   binary; `zeabur service exec -- pnpm db:migrate` returns `drizzle-kit: not found`. Migrate
   from local against the public endpoint (step 7 above).
4. **`NEXT_PUBLIC_*` bake at build** → set env BEFORE the build, then redeploy (env-only changes
   need a rebuild to take effect in the client bundle). Gotcha: if you set `NEXT_PUBLIC_APP_URL`
   after the first deploy, email links + OAuth callbacks still bake `localhost:3000`.
5. **Env-then-redeploy ordering** → the correct order is: create project → provision DB →
   generate domain → set ALL env vars → deploy → migrate → seed. Setting env vars after deploy
   has no effect until a full rebuild. The domain must be generated before the env step so
   `NEXT_PUBLIC_APP_URL` gets the real production URL, not a placeholder.

## Identifiers cheat-sheet

`project create`→PID · `deploy --create`→SID+EID · `service list`→PG_SID ·
region=`server-<id>` · PostgreSQL template=`B20CX0` · connection ref=`${POSTGRES_CONNECTION_STRING}`

## Redeploy after a code change

```bash
cd next-app && zeabur deploy --service-id <SID> --environment-id <EID> --json -i=false
```

Then re-run step 7 only if the schema changed. For production, drop
`NEXT_PUBLIC_ENABLE_DEMO_LOGIN` and don't run `pnpm db:seed`.

## Interactive alternative

For humans who prefer prompts: `bash deploy/deploy-zeabur.sh --first-time` walks you through
each step interactively. This skill is the headless, automation-targeted path.
