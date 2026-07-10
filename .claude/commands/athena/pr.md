---
description: "(epic) Full PR pipeline → merge main → lint → test → create PR."
allowed-tools: Bash, Read, Grep, Glob
---
Pre-PR pipeline. Run all gates before creating a pull request.

## Gate 1: Sync with main
- `git fetch origin main`
- `git merge origin/main` into current branch
- If conflicts: list conflicting files, attempt resolution, ask user for ambiguous ones
- If merge fails: stop and report

## Gate 2: Quality gate (repo hygiene + typecheck + lint + unit [+ e2e])
- Run `scripts/pre-merge-check.sh` from the **repo root** — it installs deps and runs typecheck + lint + unit tests inside `next-app/` plus repo-hygiene checks. (The repo root has NO `package.json` — only `next-app/` does — so `pnpm install/build/test/lint` at root would fail; the script is the correct single entry point.)
- Add `--e2e` when the change touches auth / Server Actions / DB / routes: `scripts/pre-merge-check.sh --e2e`.
- If the script exits non-zero, STOP and report exactly which check failed.

## Gate 3: Clean state
- All changes committed (no uncommitted files)
- Branch is pushed to remote

## Gate 4: Create PR (publish protocol)
- Analyze all commits since divergence from main (`git log main..HEAD`)
- Generate PR title (short, conventional commit style) + body (summary + test plan)
- `gh pr create` (or update existing PR if one exists for this branch)
- Follow the **Publish step (human-merge protocol)** in `loop.md` (CANONICAL): the USER merges. This command has **pull-only GitHub perms** — it NEVER runs `gh pr merge` and NEVER pushes to `main`.

**Rules:**
- Stop on ANY gate failure. Do not skip gates.
- Report which gate failed and why.
- If PR already exists for this branch, push and update — don't create a duplicate.
- Use `$ARGUMENTS` for extra flags: `--draft` for draft PR, `--no-merge` to skip gate 1, `--effort <tier>` for `quick|standard|thorough|ultra` effort tier (default: standard)

**Step 0 — Resolve effort tier:**
```bash
eval "$(./scripts/effort/resolve.sh "$ARGUMENTS" 2>/dev/null || true)"
```
