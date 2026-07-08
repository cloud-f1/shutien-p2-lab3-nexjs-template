import { logger } from "@/lib/logger"

/**
 * @saas/scheduler — the scheduled job body.
 *
 * Replace this with your domain work: a nightly scan, a digest email, a cleanup
 * sweep, a reconcile pass, etc. Keep it **idempotent** — the same tick may fire more
 * than once (a redeploy mid-window, a manual re-run), and it must not double-write.
 * The return value is logged by the worker.
 *
 * The default body is a harmless heartbeat so a freshly-installed scheduler is safe
 * to run on every boot before you have wired real work.
 */
export async function runScheduledJob(): Promise<{ ok: true }> {
  logger.info("scheduler-job: tick", { at: new Date().toISOString() })
  return { ok: true }
}
