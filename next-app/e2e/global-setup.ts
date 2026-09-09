/**
 * e2e global setup — two preconditions, both of which abort the whole run
 * rather than let it produce a plausible-looking wrong answer:
 *
 *   1. target identity (E357) — the base URL is THIS checkout, not a sibling
 *      fork that happens to hold the port.
 *   2. seed-account state (E373) — the demo accounts start pristine. A run that
 *      begins with 2FA still enabled on editor@example.com produces a batch of
 *      30-second timeouts that read like a product regression; one explicit
 *      line is worth more than that.
 *
 * ── target-identity gate (E357) ──
 *
 * Runs once, before any test, and proves the base URL belongs to THIS checkout.
 * Playwright orders `webServer` (a setup plugin) ahead of `globalSetup`, so by
 * the time this runs the server has either been started by Playwright or found
 * already listening and reused — which is exactly the case we must audit.
 *
 * A mismatch aborts the whole run here, deliberately: the alternative is 51
 * plausible-looking failures against someone else's app (or, far worse, a pass).
 */

import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import type { FullConfig } from "@playwright/test"

// Relative, not `@/lib/...` — global setup must not depend on Playwright
// resolving the tsconfig path alias.
import { computeAppInstanceId } from "../lib/app-identity"
import { findDirtySeedAccounts } from "./seed-state"

const HEALTH_PATH = "/api/health"
/** Per-attempt HTTP timeout. */
const REQUEST_TIMEOUT_MS = 5_000
/** Total budget for "is anything listening yet" retries. */
const PROBE_BUDGET_MS = 20_000
const PROBE_INTERVAL_MS = 500

type Probe =
  | { kind: "ok"; body: Record<string, unknown> }
  | { kind: "unreachable"; detail: string }
  | { kind: "bad-status"; status: number }
  | { kind: "not-json"; detail: string }

function resolveBaseURL(config: FullConfig): string {
  const fromProjects = config.projects
    .map((project) => (project.use as { baseURL?: string }).baseURL)
    .find((url): url is string => typeof url === "string" && url.length > 0)
  return (
    process.env.PLAYWRIGHT_BASE_URL?.trim() ||
    fromProjects ||
    "http://localhost:3000"
  )
}

async function probeOnce(healthUrl: string): Promise<Probe> {
  let response: Response
  try {
    response = await fetch(healthUrl, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { accept: "application/json" },
    })
  } catch (error) {
    return {
      kind: "unreachable",
      detail: error instanceof Error ? error.message : String(error),
    }
  }
  if (!response.ok) return { kind: "bad-status", status: response.status }
  try {
    const body = (await response.json()) as unknown
    if (!body || typeof body !== "object") {
      return {
        kind: "not-json",
        detail: `expected a JSON object, got ${typeof body}`,
      }
    }
    return { kind: "ok", body: body as Record<string, unknown> }
  } catch (error) {
    return {
      kind: "not-json",
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

async function probeHealth(healthUrl: string): Promise<Probe> {
  const deadline = Date.now() + PROBE_BUDGET_MS
  let last: Probe = { kind: "unreachable", detail: "no attempt made" }
  for (;;) {
    last = await probeOnce(healthUrl)
    // Only "nothing listening yet" is worth retrying — a wrong app answers
    // immediately and retrying it just delays the verdict.
    if (last.kind !== "unreachable" || Date.now() >= deadline) return last
    await new Promise((r) => setTimeout(r, PROBE_INTERVAL_MS))
  }
}

function portOf(baseURL: string): string {
  try {
    const url = new URL(baseURL)
    return url.port || (url.protocol === "https:" ? "443" : "80")
  } catch {
    return "3000"
  }
}

function abort(
  baseURL: string,
  expected: string,
  headline: string,
  observed: string[]
): never {
  const port = portOf(baseURL)
  const lines = [
    "",
    "──────────────────────────────────────────────────────────────────────────",
    "  e2e ABORTED — 目標 app 不是這個 checkout (wrong / unverified e2e target)",
    "──────────────────────────────────────────────────────────────────────────",
    `  ${headline}`,
    "",
    `  Base URL         : ${baseURL}`,
    `  Expected instance: ${expected}   (this checkout)`,
    ...observed.map((line) => `  ${line}`),
    "",
    "  Nothing was tested. This is NOT a product regression — the suite refused",
    "  to run because the server answering that URL belongs to a different app",
    "  (very often another checkout or fork of this same template, which looks",
    "  byte-identical over HTTP).",
    "",
    "  Who is holding the port?",
    `    lsof -nP -iTCP:${port} -sTCP:LISTEN`,
    "    lsof -a -p <PID> -d cwd -Fn        # prints that process's project dir",
    "",
    "  How to proceed (pick one):",
    "    1. Point the suite at your own server on a free port.",
    "       DATABASE_URL is REQUIRED here: a hand-started `pnpm dev` loads",
    "       .env.local (which points at saas_dev). playwright.config's",
    "       webServer.env only applies when Playwright starts the server —",
    "       on this warm-reuse path it is bypassed, so without the override",
    "       the destructive suite would run against your DEV database.",
    "         E2E_DB_NAME=saas_dev_e2e_mine pnpm db:e2e-setup",
    "         DATABASE_URL=postgresql://saas_user:saas_pass@localhost:5432/saas_dev_e2e_mine \\",
    "           PORT=3600 pnpm dev &",
    "         PLAYWRIGHT_BASE_URL=http://localhost:3600 pnpm test:e2e",
    "    2. Stop your own stale server and re-run. Do NOT kill a process that",
    "       belongs to somebody else's project.",
    "    3. Deliberately targeting a server whose path differs from this checkout",
    "       (a container, a standalone build)? Give it a stable identity with",
    "       APP_INSTANCE_ID=<id> on the server, or accept the target here with",
    "       E2E_EXPECTED_APP_INSTANCE_ID=<id>.",
    "    4. Last resort, opts out of this protection entirely:",
    "         E2E_SKIP_TARGET_CHECK=1 pnpm test:e2e",
    "──────────────────────────────────────────────────────────────────────────",
    "",
  ]
  throw new Error(lines.join("\n"))
}

/**
 * E373 — refuse to start from a polluted seed state.
 *
 * Silent when the DB is unreachable: e2e can legitimately target a server whose
 * database this process has no route to, and aborting there would be a worse
 * failure than the one being prevented.
 */
async function assertPristineSeedState() {
  const dirty = await findDirtySeedAccounts()
  if (dirty === null || dirty.length === 0) return

  const detail = dirty
    .map((a) => {
      const bits = [
        a.totpEnabled ? "2FA ENABLED" : "",
        a.lockedUntil ? `locked until ${a.lockedUntil.toISOString()}` : "",
      ].filter(Boolean)
      return `      ${a.email} — ${bits.join(" \u00b7 ")}`
    })
    .join("\n")

  throw new Error(
    [
      "",
      "\u2500".repeat(74),
      "[e2e] ABORTED \u2014 seed accounts are not in their pristine state (E373).",
      "",
      "  Dirty accounts:",
      detail,
      "",
      "  Password login for these accounts gets redirected to /login/2fa (or",
      "  refused outright), so every spec that logs in as them fails with a",
      "  30-second timeout that looks like a product bug. Phase 89 hit exactly",
      "  that cascade three times \u2014 11 failures on one run, 16 on the next.",
      "  This check converts it into the single line you are reading.",
      "",
      "  How it happens: two-factor.spec.ts enables 2FA and disables it in its",
      "  own afterAll \u2014 but that teardown opens with `if (!capturedSecret)",
      "  return`, so an earlier failure in that file leaves 2FA on.",
      "  e2e/global-teardown.ts now clears it unconditionally, so seeing this",
      "  means the process was killed before teardown could run.",
      "",
      "  Fix:  pnpm db:e2e-setup     # drop \u2192 create \u2192 migrate \u2192 seed",
      "\u2500".repeat(74),
      "",
    ].join("\n"),
  )
}

export default async function globalSetup(config: FullConfig) {
  if (process.env.E2E_SKIP_TARGET_CHECK === "1") {
    console.warn(
      "[e2e] target-identity check SKIPPED (E2E_SKIP_TARGET_CHECK=1)"
    )
    return
  }

  const baseURL = resolveBaseURL(config)
  // Derived from this file's own location, so it is the identity of the
  // checkout the specs were loaded from — independent of the invocation cwd.
  const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const expected =
    process.env.E2E_EXPECTED_APP_INSTANCE_ID?.trim() ||
    computeAppInstanceId(appRoot)

  const healthUrl = new URL(HEALTH_PATH, baseURL).toString()
  const probe = await probeHealth(healthUrl)

  if (probe.kind === "unreachable") {
    abort(
      baseURL,
      expected,
      `Nothing answered ${healthUrl} within ${PROBE_BUDGET_MS / 1000}s.`,
      [`Observed         : request failed — ${probe.detail}`]
    )
  }
  if (probe.kind === "bad-status") {
    abort(
      baseURL,
      expected,
      `${healthUrl} answered HTTP ${probe.status}, not 200.`,
      [
        `Observed         : HTTP ${probe.status} (this app's health route always returns 200)`,
      ]
    )
  }
  if (probe.kind === "not-json") {
    abort(baseURL, expected, `${healthUrl} did not return JSON.`, [
      `Observed         : ${probe.detail}`,
    ])
  }

  const actual = probe.body.appInstanceId
  const actualName =
    typeof probe.body.appName === "string" ? probe.body.appName : "(unknown)"
  if (typeof actual !== "string" || actual.length === 0) {
    abort(
      baseURL,
      expected,
      `${healthUrl} answered, but reports no appInstanceId — so it is not this checkout.`,
      [
        `Observed         : no appInstanceId field (app name: ${actualName})`,
        "                   Typically an app predating E357, e.g. an older fork",
        "                   of this template still sitting on that port.",
      ]
    )
  }
  if (actual !== expected) {
    abort(
      baseURL,
      expected,
      "The server on that URL is a DIFFERENT checkout of this app.",
      [`Observed instance: ${actual}   (app name: ${actualName})`]
    )
  }

  console.log(
    `[e2e] target verified — ${baseURL} is this checkout (instance ${expected})`
  )

  // E373 — second precondition, after the target is confirmed to be ours.
  await assertPristineSeedState()
}
