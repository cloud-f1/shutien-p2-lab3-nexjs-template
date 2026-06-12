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

## Step 3: Commit
- Stage all changes (`git add` specific files — never `git add .`)
- Write commit message in zh-TW, Conventional Commits format
- Commit (include Co-Authored-By)

## Step 4: Push & PR
- If current branch is `main`: push directly (`git push origin main`) — do NOT create a PR
- Otherwise:
  - Push branch to remote (`git push -u origin HEAD`)
  - Check if PR already exists: `gh pr list --head $(git branch --show-current) --json url --jq '.[0].url'`
    - If PR exists: push only, report existing PR URL
    - If no PR: create with `gh pr create` (title + summary bullets + test plan)

**Rules:**
- Do NOT run builds or tests — use `/athena:pr` for full gate pipeline
- Do NOT merge main — this is a fast-publish flow
- If on `main`, skip PR creation entirely (just push)
- Use `$ARGUMENTS` for extra flags: `--draft` for draft PR, `--commit-only` to skip PR, `--effort <tier>` for `quick|standard|thorough|ultra` effort tier (default: standard)

**Step 0 — Resolve effort tier:**
```bash
eval "$(./scripts/effort/resolve.sh "$ARGUMENTS" 2>/dev/null || true)"
```
