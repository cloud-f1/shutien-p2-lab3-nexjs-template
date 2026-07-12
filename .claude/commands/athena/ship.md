---
description: "(epic) Quick publish → review → fix → commit → PR. Fast path for small changes."
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---
Quick ship pipeline. Review → fix → commit → push → PR.

## Step 1: Identify Changes
- `git status` — list all changed/untracked files
- `git diff` + `git diff --cached` — see what changed
- If no changes: stop and report "nothing to ship"

## Step 2: Review & Autofix
For each changed file:
- Read the file
- Fix: typos, formatting inconsistencies, broken markdown, missing sections
- Fix: incorrect cross-references, broken links to other docs
- Fix: style consistency with existing files in the same directory
- Do NOT change intent, scope, or substance — only fix quality issues
- Report what was fixed

## Step 3: Branch (if on main) + Commit
- **NEVER commit or push directly to `main`.** If the current branch is `main`, first create a working branch: `git checkout -b chore/ship-$(date +%Y%m%d)` (append `-2`, `-3`… if it already exists).
- Stage all changes (`git add` specific files — never `git add .`)
- Write commit message in zh-TW, Conventional Commits format
- Commit (include Co-Authored-By)

## Step 4: Gate + Push & PR (publish protocol)
- **Minimal gate before pushing**: run `scripts/pre-merge-check.sh` from the repo root. If it exits non-zero, STOP and report the failure — do NOT push. (Add `--e2e` when the change touches auth / Server Actions / DB / routes.)
- Push branch to remote (`git push -u origin HEAD`)
- Check if PR already exists: `gh pr list --head $(git branch --show-current) --json url --jq '.[0].url'`
  - If PR exists: push only, report existing PR URL
  - If no PR: create with `gh pr create` (title + summary bullets + test plan)
- Follow the **Publish step (auto-merge by default)** in `loop.md` (CANONICAL): after the mandatory gates pass, `gh pr merge` the PR; with `ATHENA_AUTO_MERGE=0` stop at `⏸ awaiting human merge` and the USER merges. NEVER push directly to `main`.

**Rules:**
- ship NEVER pushes to `main` and NEVER runs `gh pr merge` — always a branch + PR for the human to merge.
- Use `$ARGUMENTS` for extra flags: `--draft` for draft PR, `--commit-only` to skip PR, `--effort <tier>` for `quick|standard|thorough|ultra` effort tier (default: standard)

**Step 0 — Resolve effort tier:**
```bash
eval "$(./scripts/effort/resolve.sh "$ARGUMENTS" 2>/dev/null || true)"
```
