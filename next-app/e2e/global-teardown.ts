/**
 * e2e global teardown (E373) — return the seeded demo accounts to their
 * pristine auth state, unconditionally, after every run.
 *
 * This is the defence that does NOT depend on a test succeeding. `two-factor.spec.ts`
 * has its own `afterAll`, but that one needs `capturedSecret` (from its FIRST
 * test) to compute a TOTP code and drive the UI — so a failure anywhere in that
 * file leaves 2FA enabled on editor@example.com and poisons every subsequent
 * run. See e2e/seed-state.ts for the full account of that failure mode.
 *
 * Best-effort by design: a teardown must never turn a green run red. It reports
 * what it did and swallows anything it cannot do.
 */
import { cleanupEphemeralUsers, resetSeedAuthState } from "./seed-state"

export default async function globalTeardown() {
  // E373 — throwaway accounts first; they hold no state anyone needs.
  const removed = await cleanupEphemeralUsers()
  if (removed !== null && removed > 0) {
    console.warn(`[e2e] removed ${removed} ephemeral account(s).`)
  }

  const changed = await resetSeedAuthState()

  if (changed === null) {
    console.warn(
      "[e2e] seed-state teardown SKIPPED — database unreachable from this process.\n" +
        "      If the run targeted a container/remote DB this is expected. If it targeted\n" +
        "      a local one, re-provision before the next run: pnpm db:e2e-setup",
    )
    return
  }

  if (changed > 0) {
    console.warn(
      `[e2e] seed-state teardown reset ${changed} seed account(s) (2FA / lockout residue cleared).`,
    )
  }
}
