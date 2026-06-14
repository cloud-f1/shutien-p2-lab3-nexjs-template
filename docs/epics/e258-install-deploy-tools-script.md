# E258 — Tool-Install Quick-Start Script

**Phase:** 59 | **Status:** ⬜ | **Depends:** none

## Problem

A new fork has to discover and install the deploy toolchain (Zeabur Claude plugin, Zeabur CLI, gcloud) by hand. There is no one-command quick-start, so onboarding is slow and error-prone.

## Solution

Ship `scripts/install-deploy-tools.sh` — an idempotent installer that sets up (or verifies) the full deploy toolchain, plus a `make` target and a guide reference.

## Key Files

- `scripts/install-deploy-tools.sh` (new)
- `Makefile` (new `install-deploy-tools` target)
- `docs/guides/deployment.md` (reference the script as step 0)

## Implementation

1. Detect OS/arch; check prerequisites: Node >= 20, pnpm, docker (warn if missing).
2. Install the Zeabur Claude plugin (`claude plugin marketplace add zeabur/agent-skills` + `claude plugin install zeabur@zeabur`) if `claude` is present and the plugin is absent.
3. Install the Zeabur CLI (`npm i -g zeabur`) if missing; print version.
4. Check `gcloud` presence (don't auto-install the SDK — print install URL if missing); verify `run`/`sqladmin` reachable.
5. Idempotent: re-running is safe (skip-if-present), clear ✔/✖/→ summary at the end.
6. `make install-deploy-tools` wraps it.

## Acceptance Criteria

- [ ] `bash scripts/install-deploy-tools.sh` is idempotent and prints a clear per-tool status summary.
- [ ] Installs Zeabur plugin + CLI if missing; skips if present; never errors on already-installed.
- [ ] Checks (not force-installs) gcloud + node/pnpm/docker; exits 0 when the core set is satisfied.
- [ ] `make install-deploy-tools` runs it; referenced from the deployment guide.

## Out of Scope

- Installing the gcloud SDK itself (link only). Cloud credentials/login (`gcloud auth`, `zeabur auth login`) — left to the user.
