---
name: install-scheduler
description: >
  Install the @saas/scheduler module into this Next.js SaaS project. Wires an
  in-process node-cron background worker: lib/scheduler-worker.ts (nodejs-runtime-only,
  single-run guarded, try/catch-wrapped tick, env-overridable cadence + timezone) and
  lib/scheduler-job.ts (the editable job body). The critical step is COMPOSING
  startScheduler() into the template's EXISTING instrumentation.ts register() (which
  already inits Sentry, E293) — not replacing it. Use after:
  npx shadcn@latest add @saas/scheduler
user-invocable: true
metadata:
  author: saas-template
  version: "1.0.0"
  epic: E323
---

# Install Scheduler Module

Installs `@saas/scheduler` — an in-process `node-cron` worker. Deliberately chosen over
an external/HTTP cron: no exposed route to secure, no third-party scheduler, and the job
runs in the same process as the app.

## Prerequisites

The `@saas` registry is served by the template app at `/r/*`, so installs need
`SAAS_REGISTRY_URL` pointing at a running origin: `http://localhost:3000` (with
`pnpm dev` running) locally, or your deployed domain.

```bash
npx shadcn@latest add @saas/scheduler
```

This installs:
- `lib/scheduler-worker.ts` — the worker (`startScheduler()` + `runTick()`)
- `lib/scheduler-job.ts` — the job body you edit
- `registry/scheduler/module.manifest.json` — the manifest

## Phase 0 — Pre-flight

```bash
cd next-app
test -f lib/scheduler-worker.ts && test -f lib/scheduler-job.ts && echo "files present"
```

## Phase 1 — Install the runtime dependency

shadcn installs `node-cron` from the registry item's `dependencies` automatically. If it
did not:

```bash
cd next-app
pnpm add node-cron && pnpm add -D @types/node-cron
```

> The registry snapshot imports `node-cron` via a non-literal dynamic specifier so it
> type-checks in the base template WITHOUT the dependency. Once you `pnpm add node-cron`
> it resolves at runtime — nothing else to change.

## Phase 2 — Write your job

Edit `lib/scheduler-job.ts` — replace the heartbeat with your **idempotent** domain work
(a scan, digest, cleanup, reconcile). The same tick can fire more than once (a redeploy
mid-window, a manual re-run); it must not double-write.

## Phase 3 — COMPOSE with the existing instrumentation.ts (do NOT clobber)

The template already ships `next-app/instrumentation.ts` — its `register()` initialises
Sentry (E293). **Add** the scheduler start alongside that; never overwrite the file.
Under the `NEXT_RUNTIME === "nodejs"` branch (Node.js runtime only — cron is not
supported on the edge runtime), add:

```ts
// instrumentation.ts — inside register()
export async function register(): Promise<void> {
  const runtime = process.env.NEXT_RUNTIME

  // @saas/scheduler — start the in-process cron worker (Node.js runtime only).
  if (runtime === "nodejs") {
    const { startScheduler } = await import("@/lib/scheduler-worker")
    await startScheduler()
  }

  // ...existing Sentry init (E293) stays exactly as-is below...
}
```

If the template's `register()` early-returns when `SENTRY_DSN` is unset, move the
scheduler block ABOVE that early return so the worker starts even with no Sentry config.
The `started` guard in the worker makes a double call harmless.

## Phase 4 — Env (optional)

```bash
# .env.local — override the hourly-UTC default if you like
SCHEDULER_CRON=0 2 * * *
SCHEDULER_TZ=Asia/Taipei
```

## Phase 5 — Verify

```bash
cd next-app
pnpm typecheck && pnpm lint
# Then boot the app and confirm the "scheduler-worker: scheduled" log line appears once.
pnpm dev
```

## Notes

- **One process only.** In a multi-instance deploy every instance starts its own worker;
  either gate `startScheduler()` to a single leader instance or make the job safe to run
  concurrently (idempotent + a row lock).
- **Serverless caveat.** On platforms that freeze the process between requests, an
  in-process cron will not fire reliably — use a platform cron trigger there instead.
