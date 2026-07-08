// @saas/scheduler — in-process node-cron worker (E323).
//
// Deliberately chosen over an HTTP cron endpoint: no external scheduler, no exposed
// route to secure, and the job runs in the same process as the app. Call startScheduler()
// once from instrumentation.ts's register() (Node.js runtime only) — see the
// install-scheduler skill for how to COMPOSE with the template's existing Sentry
// instrumentation instead of clobbering it.
import { logger } from "@/lib/logger"

import { runScheduledJob } from "./scheduler-job"

/** The slice of node-cron's API this worker uses (keeps the dynamic import typed). */
interface CronLike {
  schedule: (expr: string, fn: () => void, opts?: { timezone?: string }) => unknown
  validate: (expr: string) => boolean
}

const DEFAULT_CRON = "0 * * * *" // every hour on the hour
const DEFAULT_TZ = "UTC"

// Process-wide single-run guard. instrumentation.ts's register() is the single caller;
// this flag is a second line of defence so any duplicate import/call can't stack a
// second timer.
let started = false

/**
 * Start the schedule. Idempotent (the `started` guard). Cadence + timezone are
 * env-overridable (SCHEDULER_CRON / SCHEDULER_TZ).
 */
export async function startScheduler(): Promise<void> {
  if (started) return
  started = true

  const expression = process.env.SCHEDULER_CRON ?? DEFAULT_CRON
  const timezone = process.env.SCHEDULER_TZ ?? DEFAULT_TZ

  // node-cron is an OPT-IN npm dependency (declared in module.manifest.json). It is
  // imported dynamically via a non-literal specifier so the base template — which does
  // NOT ship node-cron — still type-checks this registry snapshot. `pnpm add node-cron`
  // (run by the install-scheduler skill) makes the real module resolve at runtime.
  const moduleId: string = "node-cron"
  const cronModule = (await import(moduleId)) as { default?: CronLike } & CronLike
  const cron: CronLike = cronModule.default ?? cronModule

  if (!cron.validate(expression)) {
    logger.error("scheduler-worker: invalid SCHEDULER_CRON — scheduler NOT started", { expression })
    started = false
    return
  }

  cron.schedule(expression, () => void runTick(), { timezone })
  logger.info("scheduler-worker: scheduled", { expression, timezone })
}

/**
 * A single tick. Exported so tests can invoke it directly without waiting for cron.
 *
 * A background timer handler must NEVER throw: node-cron's behaviour on an uncaught
 * handler rejection is unspecified, so we try/catch to the end — log the full error and
 * let the process stay alive for the next tick.
 */
export async function runTick(): Promise<void> {
  try {
    const result = await runScheduledJob()
    logger.info("scheduler-worker: tick complete", result)
  } catch (err) {
    logger.error("scheduler-worker: tick failed", { error: String(err) })
  }
}
