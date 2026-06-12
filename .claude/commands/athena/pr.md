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

## Gate 2: Install & Build
- `pnpm install` (main may have added/changed deps)
- `pnpm build` (all workspace packages must build cleanly)

## Gate 3: Test
- `pnpm test` (all workspace tests must pass)

## Gate 4: Lint
- `pnpm lint` (no lint errors in client)

## Gate 5: Clean state
- All changes committed (no uncommitted files)
- Branch is pushed to remote

## Gate 6: Create PR
- Analyze all commits since divergence from main (`git log main..HEAD`)
- Generate PR title (short, conventional commit style) + body (summary + test plan)
- `gh pr create` (or update existing PR if one exists for this branch)

**Rules:**
- Stop on ANY gate failure. Do not skip gates.
- Report which gate failed and why.
- If PR already exists for this branch, push and update — don't create a duplicate.
- Use `$ARGUMENTS` for extra flags: `--draft` for draft PR, `--no-merge` to skip gate 1, `--effort <tier>` for `quick|standard|thorough|ultra` effort tier (default: standard)

**Step 0 — Resolve effort tier:**
```bash
eval "$(./scripts/effort/resolve.sh "$ARGUMENTS" 2>/dev/null || true)"
```
