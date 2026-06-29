---
name: zeabur-deploy
description: >
  Deploy this Next.js app to a Zeabur dedicated server end-to-end via the `zeabur` CLI —
  project + PostgreSQL + web service + domain + env + migrate + seed + verify. Use when the
  user says "deploy to Zeabur", "deploy to my server <name>", "spin up a dev/staging instance",
  or wants a fresh cloud instance of the app. Encodes the exact non-interactive CLI flow and the
  gotchas that bite (dotfile-dropping uploader, deprecated marketplace, standalone runtime
  can't migrate, NEXT_PUBLIC bakes at build, env-then-redeploy ordering, small-box build failures,
  and build-before-postgres ordering). Covers BOTH deploy models: source-build (`zeabur deploy`)
  and prebuilt-image (build locally → push → `service update tag`). Pairs with deploy/
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

**7. Migrate + seed — from your MACHINE against the Postgres PUBLIC endpoint, then close it.**
The runtime image is Next.js *standalone* (no pnpm, no `drizzle/`, no drizzle-kit) so you CANNOT
`zeabur service exec -- pnpm db:migrate`. Open the public TCP endpoint **only for this window**,
run locally, then **disable it again** (the app never needs it — it uses private networking):

```bash
zeabur service port-forward --id <PG_SID> --env-id <EID> --enable -i=false   # open public TCP
zeabur service network      --id <PG_SID> --env-id <EID> --json -i=false      # → host + forwardedPort
#   NOTE: the forwarded port is reassigned on each enable — always re-read it here, don't reuse an old one.
# user=root, db=POSTGRES_DB ("zeabur"), pw=PASSWORD var (zeabur variable list --id <PG_SID> ...)
cd next-app
mv .env.local .env.local.bak 2>/dev/null   # park local URL so drizzle-kit can't pick it up
DATABASE_URL="postgresql://root:<PW>@<host>:<fwdPort>/zeabur" pnpm db:migrate
DATABASE_URL="postgresql://root:<PW>@<host>:<fwdPort>/zeabur" pnpm db:seed   # dev/staging only
mv .env.local.bak .env.local 2>/dev/null
zeabur service port-forward --id <PG_SID> --env-id <EID> --disable -i=false  # CLOSE it again
```

The seed creates three demo accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `Admin123!` |
| Editor | `editor@example.com` | `Editor123!` |
| Viewer | `viewer@example.com` | `Viewer123!` |

For production, skip `pnpm db:seed` and set `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false` (then rebuild).

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

## The seven gotchas (each cost a debug round)

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
   `NEXT_PUBLIC_APP_URL` gets the real production URL, not a placeholder. On production, set
   `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false` to disable the one-click demo login buttons.
6. **Small dedicated boxes can't schedule a source-build.** A 2C4G box with web + Postgres already
   running (~1.2 GB free) fails to schedule the build: `startedAt: 0001-01-01`, ~10 s fail, empty
   build log — the build container never started. This is NOT a code error. Switch to the
   **prebuilt-image path** below — and always **cross-build `--platform linux/amd64`**, because a
   Mac (arm64) image won't run on the amd64 server.
7. **Built the web service BEFORE its Postgres existed?** The container started with an unresolved
   `DATABASE_URL=${POSTGRES_CONNECTION_STRING}` (empty), so `/login` 500s (DB import throws) while
   `/api/health` still 200s. After provisioning Postgres, `zeabur service restart --id <SID>
   --env-id <EID>` so the now-resolved connection string is picked up. (Happens when you build
   first to keep build-RAM high on a small box — provision PG, then restart.)

## Prebuilt-image deploy path

Use this when the source-build path fails on a small dedicated box (Gotcha #6), or when you want
locally-tested, reproducible images with instant tag-swap rollbacks.

### One-time setup (dashboard only)

**The CLI cannot create a bring-your-own-image service headlessly.** You must use the Zeabur
dashboard: project → *Add Service → Deploy your own image* (name e.g. `web-img`).

Then discover its id and the registry push path:

```bash
zeabur service list --project-id <PID> --json                             # → get the new SID
zeabur service instruction --id <SID> --env-id <EID>                      # → registry host + docker login + push path
```

### Each deploy = build local → push → swap tag

```bash
cd next-app
# 1. CROSS-BUILD for the server's arch. Dedicated boxes are amd64; a Mac is arm64 → an arm image
#    will NOT run on the server. The Dockerfile already accepts these NEXT_PUBLIC build-args.
docker buildx build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_APP_URL=https://<slug>.zeabur.app \
  --build-arg NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true \
  -t <zeabur-registry>/<ns>:<tag> --load .
# 2. push (login from `service instruction`)
docker push <zeabur-registry>/<ns>:<tag>
# 3. swap the running image — this IS the deploy (no server build)
zeabur service update tag --id <SID> --env-id <EID> -t <tag> -y -i=false
```

`NEXT_PUBLIC_*` still bake at build (Gotcha 4) — pass them as `--build-arg` on the local build.
Env vars, domain, and migrate/seed (steps 5–7) are identical to the source-build flow.

A source-build service **cannot** be `service update tag`'d — you must create a prebuilt-image
service (dashboard) and move the domain + env onto it, then retire the old service.

### Which path?

- **Source-build** (`zeabur deploy from next-app/`) — use when the box has >= 2 GB free during
  build, or on a managed (cloud) region. Simplest; one command per deploy.
- **Prebuilt image** — required when the box is too small to schedule a server-side build (Gotcha
  #6). Bonus: reproducible locally-tested images, instant tag-swap rollbacks
  (`service update tag -t <oldtag>`), and builds happen off-box.

## Sizing — budget ~one environment per 2C4G box

A `next build` needs **~1.5–2 GB free** to even *schedule* (a failed build shows `startedAt:0001`,
~10 s, empty log — the build container never started, NOT a code error). And every running env is
**web (~150–300 MB) + Postgres (~250–400 MB)**. So on a **2C4G (2 vCPU / 3.66 GB)** dedicated box:

- One env (web+pg) idles ~0.5–0.8 GB → leaves enough headroom to source-build. **This is the comfort limit.**
- With `dev` running, free RAM hovers ~1.2–1.4 GB — source-build is marginal on a fully-loaded box.
- **dev + stg + prd = 6 services** (~2–2.5 GB idle) + a transient build → overcommits 3.66 GB. It will
  not fit; builds fail and runtime risks OOM.

**Rule:** give each environment its **own box** (CLI can't provision dedicated servers — the user
adds them to Zeabur), **or** size up (e.g. 4C8G) to co-host. On a box that's tight but fixed,
use the **prebuilt-image** path so builds happen off-box.

## Identifiers cheat-sheet

`project create`→PID · `deploy --create`→SID+EID · `service list`→PG_SID ·
region=`server-<id>` · PostgreSQL template=`B20CX0` · connection ref=`${POSTGRES_CONNECTION_STRING}`

## Redeploy after a code change

```bash
cd next-app && zeabur deploy --service-id <SID> --environment-id <EID> --json -i=false
```

Then re-run step 7 only if the schema changed. For production, set
`NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false` and don't run `pnpm db:seed`.

## Interactive alternative

For humans who prefer prompts: `bash deploy/deploy-zeabur.sh --first-time` walks you through
each step interactively. This skill is the headless, automation-targeted path.
