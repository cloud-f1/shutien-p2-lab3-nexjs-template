# E33 — System Learning & Validation

> **Size**: S (~1 session) | **Deps**: none | **Phase**: 12

---

## Problem Statement

The agent pipeline has accumulated three categories of friction that compound over time:

1. **QA findings are not fed back to spec-writing.** @qa repeatedly flags the same issues (e.g. missing `satisfies` pattern, DashboardLayout comment block, a11y attributes) because @spec-writer has no awareness of past review outcomes. Each epic re-introduces the same gaps.

2. **Memory documents drift from reality.** MEMORY.md and session-summary.md accumulate stale claims (epic statuses, file paths, counts) that `/athena:learn` detects but does not actively prune. Timestamp noise in session-summary.md (`<!-- last activity: ... -->`) grows unbounded. There is no automated cross-check against `git log` or the file system.

3. **No post-scaffold validation.** After `pnpm new-site` (E21), there is no automated check that the generated project actually works — imports resolve, server boots, client builds, and tests pass. A broken scaffold is only discovered manually.

---

## Deliverables

### D1: QA-to-Spec Feedback Loop

**File to create:** `docs/context/qa-patterns.md`

**Content outline:**
```markdown
# QA Patterns — Recurring Findings
> Owner: @qa (appends) + @spec-writer (reads)
> Purpose: break the repeat-finding cycle

## Checklist — Spec Must Address

### TypeScript / Zod
- [ ] `satisfies z.ZodType<ApiType>` on every new Zod schema
- [ ] Explicit return types on exported functions

### CSS / Layout
- [ ] DashboardLayout comment block preserved when adding views
- [ ] New CSS selectors use design-system tokens (never raw hex)

### Accessibility (WCAG 2.1 AA)
- [ ] All interactive elements: keyboard handler + ARIA attrs
- [ ] Images / icon-only buttons: aria-label or aria-hidden
- [ ] New pages: skip-nav target, landmark roles

### Testing
- [ ] MSW handler for every new endpoint
- [ ] userEvent (not fireEvent) in all client tests
- [ ] Coverage >= 80% per module

## Log — Findings Added by @qa
<!-- @qa appends entries here after each review -->
```

**Files to modify:**

| File | Change |
|------|--------|
| `.claude/agents/spec-writer.md` | Add step 1.5: "Read `docs/context/qa-patterns.md` — recurring QA findings to address proactively" |
| `.claude/agents/qa.md` | Add rule: "After each review, append new recurring findings to `docs/context/qa-patterns.md`" |
| `docs/context/CLAUDE.md` | Add `qa-patterns.md` to ownership table (Owner: @qa + @spec-writer) |

---

### D2: Memory Garbage Collection

**File to modify:** `.claude/commands/athena/learn.md`

**Changes — add active pruning steps between current Step 3.5 and Step 4:**

```markdown
## Step 3.6 — Garbage collect stale entries
For each claim in MEMORY.md:
1. **Epic status**: compare against EPIC_INDEX.md. Remove or correct any
   "pending"/"in-progress" for completed epics.
2. **File paths**: verify with `ls` or `Glob`. Remove references to files
   that no longer exist.
3. **Counts** (test counts, agent counts, command counts): verify against
   actual filesystem. Correct if drifted.
4. **Resolved gotchas**: if a debugging entry references a bug that has been
   fixed (check git log), mark it resolved or remove.

## Step 3.7 — Clean session-summary.md noise
1. Remove all `<!-- last activity: ... -->` comment lines (unbounded growth).
2. Ensure "Latest Session" date matches today or last commit date.
3. Verify "Current State" table counts match reality.
4. Keep file under 80 lines.
```

**File to modify:** `docs/context/session-summary.md`
- No structural change — learn command will clean it at runtime.

---

### D3: Template Smoke Test

**File to create:** `scripts/smoke-test.sh`

**Content outline:**
```bash
#!/usr/bin/env bash
# E33 — Post-scaffold smoke test
# Usage: ./scripts/smoke-test.sh [project-dir]
# Defaults to current directory if no argument given.
set -euo pipefail

DIR="${1:-.}"
PASS=0; FAIL=0

# Test 1: Python server imports resolve
echo "=> Server import check..."
(cd "$DIR/server" && python -c "from app.main import app; print('OK')")

# Test 2: Client build succeeds
echo "=> Client build check..."
(cd "$DIR/client" && pnpm build --silent)

# Test 3: Client tests pass
echo "=> Client test check..."
(cd "$DIR/client" && pnpm test -- --run --reporter=dot | tail -5)

# Test 4: Server tests pass (if pytest available)
echo "=> Server test check..."
(cd "$DIR/server" && python -m pytest --tb=short -q 2>&1 | tail -5)

# Summary
echo "=== Smoke test complete ==="
```

**Files to modify:**

| File | Change |
|------|--------|
| `scripts/new-site/index.ts` | Add optional `--smoke` flag. After Step 5 (manifest), if `--smoke` passed, spawn smoke test via `execFileSync` (matching existing pattern in `setup.ts`) and report pass/fail. |
| `scripts/new-site/types.ts` | Add `smoke_test` to `StepResult.step` union if typed. |

**Integration pattern** (follows existing `setup.ts` convention):
```typescript
import { execFileSync } from "node:child_process";
// ...
execFileSync("bash", ["scripts/smoke-test.sh", projectRoot], {
  cwd: projectRoot,
  stdio: "inherit",
});
```

---

## Files Summary

| Action | Path | Deliverable |
|--------|------|-------------|
| CREATE | `docs/context/qa-patterns.md` | D1 |
| CREATE | `scripts/smoke-test.sh` | D3 |
| MODIFY | `.claude/agents/spec-writer.md` | D1 |
| MODIFY | `.claude/agents/qa.md` | D1 |
| MODIFY | `docs/context/CLAUDE.md` | D1 |
| MODIFY | `.claude/commands/athena/learn.md` | D2 |
| MODIFY | `scripts/new-site/index.ts` | D3 |
| MODIFY | `scripts/new-site/types.ts` | D3 (if step union is typed) |

---

## Acceptance Criteria

### D1: QA-to-Spec Feedback Loop
- [ ] `docs/context/qa-patterns.md` exists with at least 4 checklist categories
- [ ] @spec-writer workflow includes reading qa-patterns.md before writing specs
- [ ] @qa rules include appending new recurring findings to qa-patterns.md
- [ ] `docs/context/CLAUDE.md` ownership table lists qa-patterns.md

### D2: Memory Garbage Collection
- [ ] `/athena:learn` command includes Step 3.6 (garbage collect) and Step 3.7 (clean session-summary)
- [ ] Step 3.6 checks: epic status, file paths, counts, resolved gotchas
- [ ] Step 3.7 removes `<!-- last activity: ... -->` noise lines
- [ ] Step 3.7 enforces 80-line limit on session-summary.md

### D3: Template Smoke Test
- [ ] `scripts/smoke-test.sh` exists and is executable
- [ ] Script tests: server import, client build, client tests, server tests
- [ ] Script accepts optional directory argument (defaults to `.`)
- [ ] `scripts/new-site/index.ts` supports `--smoke` flag to auto-run after scaffold
- [ ] Script exits non-zero on any test failure

---

## Size Estimate

**S (confirmed)** — All deliverables are documentation or shell scripts. No API changes, no database migrations, no new dependencies. Estimated ~1 session for implementation.

---

## Implementation Order

1. D1 — QA patterns file + agent modifications (pure docs, no risk)
2. D2 — Learn command enhancement (edit one command file)
3. D3 — Smoke test script + CLI integration (new script + minor TS edit)
