---
name: install-sentry-pii
description: >
  Install the @saas/sentry-pii module into this Next.js SaaS project. Wires a pure
  PII-scrubbing lib/sentry-pii/scrub.ts (beforeSend/beforeSendTransaction — masks
  emails, tokens/secrets, and opt-in ID-like strings) that COMPOSES into the template's
  EXISTING env-gated Sentry init (next-app/instrumentation.ts, E293). Env-gated no-op
  when SENTRY_DSN is unset. Does NOT create a second Sentry.init() call. Use after:
  npx shadcn@latest add @saas/sentry-pii
user-invocable: true
metadata:
  author: saas-template
  version: "1.0.0"
  epic: E325
---

# Install Sentry PII Module

Installs `@saas/sentry-pii` — a pure `beforeSend`/`beforeSendTransaction` scrubber that
masks emails, bearer/API tokens, JWTs, secret-looking `key=value` pairs, and (opt-in)
your own domain's ID-like strings, and drops request bodies/cookies/auth headers and
Sentry's `user` context entirely, before an event leaves the process.

> **This module has no init of its own.** The template's Sentry initialization already
> lives in `next-app/instrumentation.ts` (E293) and is env-gated: it no-ops completely
> when `SENTRY_DSN` is unset. This module's whole job is to plug `beforeSend` into that
> EXISTING call. If you find yourself writing a second `Sentry.init(...)`, stop — you are
> about to double-initialize Sentry.

## Prerequisites

The `@saas` registry is served by the template app at `/r/*`, so installs need
`SAAS_REGISTRY_URL` pointing at a running origin (`http://localhost:3000` locally with
`pnpm dev`, or your deployed domain).

```bash
npx shadcn@latest add @saas/sentry-pii
```

This installs:
- `lib/sentry-pii/scrub.ts` — `scrubEvent()`, `maskPii()`, `beforeSend`, `createBeforeSend()`
- `registry/sentry-pii/module.manifest.json` — the manifest

No env vars, no npm dependencies (pure — does not import `@sentry/nextjs`).

## Phase 0 — Pre-flight

```bash
cd next-app
test -f lib/sentry-pii/scrub.ts && echo "file present"
grep -n "Sentry.init" instrumentation.ts
```

## Phase 1 — Compose into the existing `instrumentation.ts` (do NOT clobber)

`instrumentation.ts` currently looks like this (E293 — abbreviated):

```ts
export async function register(): Promise<void> {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return // no-op with no Sentry config

  const runtime = process.env.NEXT_RUNTIME

  if (runtime === "nodejs") {
    const Sentry = await import("@sentry/nextjs")
    Sentry.init({ dsn, tracesSampleRate: /* ... */, debug: /* ... */ })
  }

  if (runtime === "edge") {
    const Sentry = await import("@sentry/nextjs")
    Sentry.init({ dsn, tracesSampleRate: /* ... */, debug: /* ... */ })
  }
}
```

Add the scrubber to **both** `Sentry.init({...})` calls (nodejs and edge — PII can appear
in events from either runtime):

```ts
import { beforeSend, beforeSendTransaction } from "@/lib/sentry-pii/scrub"

// ...inside register(), each Sentry.init({ ... }) call:
Sentry.init({
  dsn,
  tracesSampleRate: /* ...unchanged... */,
  debug: /* ...unchanged... */,
  beforeSend,
  beforeSendTransaction,
})
```

Everything else in `instrumentation.ts` — the `SENTRY_DSN` early-return, the runtime
branches, the sample rate/debug logic — stays exactly as-is. This module only adds two
options to calls that already exist.

## Phase 2 — Optional: mask your own ID-like strings

If your product has ID-like strings worth masking beyond emails/tokens (badge numbers,
ticket ids, order numbers, ...), use `createBeforeSend()` instead of the bare `beforeSend`
export:

```ts
import { createBeforeSend } from "@/lib/sentry-pii/scrub"

const scrub = createBeforeSend({ idPatterns: [/\bTICKET-\d{4,}\b/g] })

Sentry.init({
  dsn,
  // ...
  beforeSend: scrub,
  beforeSendTransaction: scrub,
})
```

Leave `idPatterns` unset to scrub only emails/tokens/secrets — there is no default
ID-shape guess, since one does not generalize across products.

## Phase 3 — Verify

```bash
cd next-app
pnpm test           # runs lib/sentry-pii/scrub.test.ts along with the rest of the suite
pnpm typecheck && pnpm lint
```

With `SENTRY_DSN` set locally, trigger a test error and confirm in the Sentry dashboard
that the event has no `user` context, no `request.data`/`cookies`, and any email/token in
the message is masked.

## Notes

- **Idempotent.** Scrubbing an already-scrubbed event is a no-op — safe if `beforeSend`
  is ever called more than once for the same event shape.
- **Masks, does not filter.** This module never drops an event outright (only fields
  within it). Wire event-sampling/dropping decisions (`tracesSampleRate`, `ignoreErrors`,
  etc.) in `Sentry.init()` separately.
- **`SENTRY_DSN` unset → no-op by construction.** Because the scrubber is only ever
  reached via the existing `Sentry.init()` calls inside the `if (!dsn) return` guard, this
  module contributes zero behavior (and zero bundle cost beyond the dynamic `@sentry/nextjs`
  import already gated there) when Sentry is not configured.
