# E90 — PR Automation Hooks — Labels, Assignment, Status

> **Phase 26** | Priority: P1 | Points: 13 | Size: L
> **Depends on**: none

---

## Problem Statement

After `/athena:batch` completes a wave, PRs are created but lack automated labeling, reviewer assignment, and status integration. Manual PR management is overhead that grows with parallel epic count.

## Stories

### S1: PR Created Hook

**AC:**
- [ ] Create `scripts/hooks/pr-created.sh` triggered after `gh pr create`
- [ ] Hook reads PR number and changed files from stdin JSON
- [ ] Extracts epic ID from branch name (`feat/E{n}-*`)
- [ ] Extracts phase number from `epic-progress.md`
- [ ] Non-blocking (fire-and-forget, exit 0)

### S2: Auto-Label

**AC:**
- [ ] Add labels via `gh pr edit --add-label`:
  - `phase:N` — phase number
  - `epic:E{n}` — epic ID
  - `size:S|M|L` — from epic-progress.md Size column
  - `agent:batch` or `agent:loop` — based on branch pattern
- [ ] Create labels if they don't exist (`gh label create`)
- [ ] Skip labeling if `gh` CLI not available (graceful degradation)

### S3: Auto-Assign Reviewer

**AC:**
- [ ] Assign reviewer based on changed files heuristic:
  - `server/` changes → assign backend reviewer (configurable in env var)
  - `client/` changes → assign frontend reviewer (configurable in env var)
  - `docs/` only → skip reviewer assignment
  - Mixed → assign both
- [ ] Reviewer usernames from `$PR_REVIEWER_BACKEND` and `$PR_REVIEWER_FRONTEND` env vars
- [ ] Skip if env vars not set (no error)
- [ ] Use `gh pr edit --add-reviewer`

### S4: Wire into Commands

**AC:**
- [ ] Register hook in `.claude/settings.json` as PostToolUse(Bash) matcher for `gh pr create`
- [ ] Ensure hook fires after `/athena:ship`, `/athena:pr`, and `/athena:loop` merge step
- [ ] Document env vars in `scripts/hooks/CLAUDE.md`

### S5: Status Check Integration

**AC:**
- [ ] After PR creation, add status comment with epic context:
  - Epic name, phase, dependencies, spec link
  - Test status (if available from last QA run)
- [ ] Use `gh pr comment` to add the context comment
- [ ] Template: "Epic: E{n} ({name}) | Phase {p} | Spec: docs/epics/e{n}-*.md"

## Risk Notes

- Low risk — hook script only, uses existing `gh` CLI
- Graceful degradation if `gh` not available or labels don't exist
- Rate limiting: `gh` API has limits, but PR creation is infrequent enough

## Files to Touch

```
scripts/hooks/pr-created.sh           — new: PR automation hook
.claude/settings.json                 — register hook
scripts/hooks/CLAUDE.md               — document new hook + env vars
.claude/commands/athena/ship.md       — note PR hook integration
.claude/commands/athena/pr.md         — note PR hook integration
```
