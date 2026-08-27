/**
 * App instance identity (E357) — "which checkout is this server actually running?"
 *
 * ## Why this exists
 *
 * `playwright.config.ts` defaults to `http://localhost:3000` with
 * `reuseExistingServer: true`. If ANOTHER app already holds :3000, Playwright
 * happily attaches to it and the whole e2e suite silently tests the wrong
 * target — failures look like real regressions, and a pass is worse (green on
 * someone else's app). This actually happened in Phase 86: a *fork of this very
 * template* was on :3000, and both `<title>` and `/api/health` were
 * byte-identical to ours, so nothing in the HTTP response could tell them apart.
 *
 * ## The hard constraint
 *
 * The identity must still work for a fork that has NOT been rebranded yet.
 * That rules out every config-derived signal — `NEXT_PUBLIC_APP_NAME`,
 * `package.json`'s `name`/`version`, the page `<title>` — because a fresh fork
 * copies all of them verbatim from upstream. It also rules out the git remote
 * URL: `cp -R`-ing this repo to a second path (or `git worktree add`) keeps the
 * same remote while producing a genuinely different checkout.
 *
 * ## What we use instead
 *
 * The **absolute filesystem path of the running server's project directory**,
 * hashed. Two checkouts cannot occupy the same absolute path, so it separates
 * them even when every byte of config is identical. It is hashed (rather than
 * exposed raw) so an unauthenticated `/api/health` never leaks a username or
 * directory layout — the digest is an opaque, stable, non-reversible token.
 *
 * ## Known limits (documented on purpose)
 *
 * - **Same path, different content** — two containers both built `WORKDIR /app`,
 *   or dev vs. `output: "standalone"` runs of the same repo, produce different or
 *   colliding ids. Set `APP_INSTANCE_ID` explicitly to pin identity in those
 *   environments (see `resolveAppInstanceId`).
 * - **Same checkout, different cwd** — starting the server from somewhere other
 *   than `next-app/` (e.g. `pnpm --dir next-app dev` variants) shifts
 *   `process.cwd()`. That yields a *false mismatch*, i.e. a loud abort, never a
 *   silent wrong-target run — the safe direction to fail in.
 * - It is an **anti-confusion** check, not a security control: any server can
 *   claim any id. It protects against accidents, not against an adversary.
 *
 * Kept pure and dependency-free (node builtins only) so both the Next.js route
 * handler and the Playwright global setup can import the exact same function.
 */

import { createHash } from "node:crypto"
import { realpathSync } from "node:fs"
import { resolve } from "node:path"

/** Domain-separation prefix so the digest is not a bare hash of a path. */
const HASH_DOMAIN = "ai-coding-template:app-instance:v1:"

/** Hex characters kept from the digest — 64 bits, plenty to separate checkouts. */
const ID_LENGTH = 16

/**
 * Normalise a project path so both sides of the comparison agree.
 *
 * `process.cwd()` is already symlink-resolved by the OS, but a path derived from
 * a module URL is not — running both through `realpath` keeps the server's id
 * and the test runner's expectation identical when the repo sits under a
 * symlinked directory. Falls back to a plain `resolve()` when the path cannot be
 * stat-ed (never throws — an unresolvable path should degrade to a mismatch, not
 * to a crash).
 */
export function normalizeProjectPath(projectPath: string): string {
  const absolute = resolve(projectPath)
  try {
    return realpathSync(absolute)
  } catch {
    return absolute
  }
}

/**
 * Deterministic id for a checkout living at `projectPath`.
 *
 * Same path in, same id out — on every process, in every runtime, forever.
 */
export function computeAppInstanceId(projectPath: string): string {
  return createHash("sha256")
    .update(HASH_DOMAIN + normalizeProjectPath(projectPath))
    .digest("hex")
    .slice(0, ID_LENGTH)
}

/**
 * The slice of the environment this module reads. The `Record` half keeps
 * `process.env` (an interface with an index signature) assignable to it — a
 * target made only of optional properties would otherwise trip TypeScript's
 * weak-type check.
 */
export type AppIdentityEnv = { APP_INSTANCE_ID?: string } & Record<
  string,
  unknown
>

/**
 * The identity this *running server* reports.
 *
 * `APP_INSTANCE_ID` wins when set — the escape hatch for containerised or
 * standalone deploys where the runtime path says nothing useful about which
 * checkout produced the build. Otherwise the id is derived from the server
 * process's working directory, which for `next dev` / `next start` is the
 * `next-app/` project root.
 *
 * Params are injectable so the unit tests never have to mutate real globals.
 */
export function resolveAppInstanceId(
  env: AppIdentityEnv = process.env,
  cwd: string = process.cwd()
): string {
  const override = env.APP_INSTANCE_ID?.trim()
  if (override) return override
  return computeAppInstanceId(cwd)
}
