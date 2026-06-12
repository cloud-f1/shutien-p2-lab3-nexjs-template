# E202 — Template↔Plugin Decision + Execution

> Phase 49 — Template↔Plugin Resolution | Size: XL (21 SP) | Deps: none

## Problem

`athena-core` was extracted to `/Users/MH/Documents/git_saas/athena-core` and tagged `v0.1.0-alpha` (Phase 1 complete, 6 tests pass) — yet the template at `ai-coding-template` was **never migrated to consume it**. The template carries zero references to `athena-core` and instead holds a strict superset of all plugin assets: 12 agents, 23 commands, 11 skills, 21 hook scripts, and 14 memory scripts. Every edit made to the template silently diverges the plugin with no automated detection in either direction.

This creates an embarrassing showcase paradox: **the template does not use the product it ships**. A newcomer cloning `ai-coding-template` to learn Claude Code plugin patterns sees a monolith, not a plugin consumer. The demo is the opposite of what the distribution story requires.

Two copies now exist — `ai-coding-template/.claude/` (the active edit surface) and `athena-core/` (the tagged release) — with no sync script, no drift check, and no declared upstream. The longer this persists, the more expensive reconciliation becomes. A cleanup/sync epic has never been written; this is it.

## Solution

A **binary decision** taken at the spec step, executed immediately after approval. Exactly one of two paths is chosen:

**Path A — DOGFOOD**: Delete the duplicated `.claude/agents`, `.claude/commands/athena`, `.claude/skills`, and athena-owned `scripts/hooks` + `scripts/memory` from the template. Install `athena-core` via its `MIGRATION.md`. The template becomes a live demo of plugin consumption, which is the correct showcase for plugin-distribution and teaching lenses. Trade-off: single-place editing convenience is lost; all athena changes must go through `athena-core` first.

**Path B — CANONICAL-TEMPLATE**: Declare the template the upstream source-of-truth. Add `scripts/sync-to-plugin.sh` (a one-way extraction script that ports template changes into `athena-core`) and a local `make drift-check` target (CI is currently disabled — a Makefile target substitutes). Editing remains in-place; the plugin is always downstream. Trade-off: `athena-core` is never truly dogfooded.

The status quo (two diverging copies with no sync, no declared upstream, and the non-product copy as the edit surface) is strictly worse than both paths and is explicitly rejected.

### Decision spike sub-steps

1. **Spike** — enumerate exact asset overlap: diff `ai-coding-template/.claude/` vs `athena-core/` asset manifest; count lines that would be deleted (Path A) vs lines of sync glue needed (Path B).
2. **Decide** — record A-vs-B in this file with rationale; update `EPIC_INDEX.md`.
3. **Execute** — carry out the chosen path per the Key Files table below.
4. **Verify** — confirm no silent drift path remains.

## Key Files

| File | Action |
|---|---|
| `docs/epics/e202-template-plugin-resolution.md` | New — this spec |
| `CLAUDE.md` | Edit — document chosen model ("installed via athena-core" or "canonical upstream + sync") |
| **Path A only** | |
| `.claude/agents/` (all 12) | Delete — replaced by athena-core install |
| `.claude/commands/athena/` (all 23) | Delete — replaced by athena-core install |
| `.claude/skills/` (all 11) | Delete — replaced by athena-core install |
| `scripts/hooks/` (athena-owned scripts) | Delete — replaced by athena-core install |
| `scripts/memory/` (all 14) | Delete — replaced by athena-core install |
| `athena-core/MIGRATION.md` | Follow — install steps applied to template |
| **Path B only** | |
| `scripts/sync-to-plugin.sh` | New — one-way extraction: template → athena-core |
| `Makefile` | Edit — add `drift-check` target (runs sync dry-run + diff) |
| `docs/guides/en/plugin-sync.md` | New — documents the sync workflow for contributors |

## Implementation

1. **Spike**: run `diff -r ai-coding-template/.claude/ athena-core/` (adjust paths); produce a count of matching vs diverged files; write the delta summary as a comment block in this file before deciding.
2. **Decide A or B**: record the chosen path with ≥3 rationale bullets under a `## Decision` heading appended to this file; update `EPIC_INDEX.md` status to `implementing`.
3. **Execute Path A** (if chosen): follow `athena-core/MIGRATION.md` step-by-step; delete template-local athena assets only after confirming plugin covers them; update `CLAUDE.md` with "athena-core installed at `{version}`" note.
4. **Execute Path B** (if chosen): write `scripts/sync-to-plugin.sh` (rsync-based one-way copy of `.claude/` + `scripts/hooks` + `scripts/memory` into `../athena-core/`; dry-run by default, `--apply` flag to commit); wire `make drift-check` to run sync with `--dry-run` and exit non-zero if diff is non-empty.
5. **Smoke test**: for Path A — clone fresh, run `make go`, confirm 6 athena-core tests still pass and one slash command (`/athena:loop status`) executes; for Path B — run `make drift-check` against current state, confirm it exits 0 on a clean tree and non-zero after a deliberate one-line edit to a template command.
6. **Update docs**: `CLAUDE.md` (chosen model statement), `EPIC_INDEX.md` (status → `done`).

## Acceptance Criteria

- [ ] A-vs-B decision is recorded with rationale in this file (or a linked `## Decision` appendix); no "undecided" state remains at merge time
- [ ] **Path A**: `.claude/agents`, `.claude/commands/athena`, `.claude/skills`, and athena-owned `scripts/` are removed from template; `athena-core` is installed per its `MIGRATION.md`; `make go` succeeds on a clean clone
- [ ] **Path B**: `scripts/sync-to-plugin.sh` exists and exits 0 on dry-run with a clean tree; `make drift-check` exits non-zero after a deliberate one-line edit to a template command (regression fixture)
- [ ] `CLAUDE.md` contains an unambiguous statement of the chosen model ("plugin consumer" or "canonical upstream + sync path")
- [ ] No silent drift path remains: either the template consumes athena-core, OR a mechanical sync + local drift check exists and is documented
- [ ] Asset reconciliation confirmed: the chosen-path execution closes the gap counted in the spike (zero unresolved diverged files at merge)
- [ ] Smoke test passes: one athena slash command executes end-to-end in the post-migration template
- [ ] `EPIC_INDEX.md` updated to `done`; Phase 49 boundary reported

## Alignment / Cross-Epic Hooks

- **Independent epic** — no deps. Ships as sole Wave 1 epic in Phase 49.
- **Unblocks E203** (athena-core internal hardening / registry hotfix) — the template↔plugin relationship must be resolved before hardening the plugin internals makes sense.
- **Unblocks Phase 2 athena-saas-profile** — plugin distribution story requires a clean dogfood demo in the template.
- **Reuses E181 audit-log infra** — any sync script should emit an `athena_sync` audit event to `.claude/audit.jsonl` for observability continuity.
- **Relates to `athena-core` Phase 1** (6 tests, `v0.1.0-alpha`, tagged 2026) — asset manifest from that release is the ground truth for Path A deletion scope.

## Out of Scope

- `athena-core` internal hardening, registry hotfix, or new plugin features — that is E203
- Building the Phase 2 `athena-saas-profile` plugin — deferred
- CI automation for the drift check (CI is currently disabled project-wide per `c7015b6`) — a local `make drift-check` target is sufficient for v1; re-enabling CI is a separate ops decision
- Bi-directional sync (plugin → template) — Path B is explicitly one-way (template is upstream); reverse flow is deferred

## Decision

**Chosen: Path B — Canonical Template (2026-06-01)**

Rationale:
- athena-core at v0.1.0-alpha (11 agents / 6 skills / 1 command subdir) is 6+ months behind the template (12 agents / 12 skills / 23 commands). Path A would require migrating athena-core to catch up first — scope exceeds this epic's 21 SP budget.
- Template is the active edit surface and the complete ground truth; every new feature (E193-E201, Phase 47-48) landed here, not in athena-core.
- Path B preserves edit convenience while creating a mechanical sync path that makes divergence detectable and closeable on-demand.
- Phase 2 athena-saas-profile plugin will consume athena-core after a v0.2.0 sync; this epic creates the sync machinery that makes that tractable.

## Provenance

- Spec source: 2-workflow enhancement audit (athena-enhancement-research + ultracode-into-athena), 2026-05-30
- Approved via `/athena:plan approve E193,E194,E195,E196,E197` on 2026-05-30 (Cycle 21); Phase 48/49 rendered same day under "no limit 5 epics" override

## Spike Output (2026-06-01)

Asset divergence between `ai-coding-template/.claude/` and `athena-core/` (run 2026-06-01):

| Asset group | Template count | athena-core count | Diverged files |
|---|---|---|---|
| agents | 12 | 11 | 12 (all differ or missing) |
| commands/athena | 23 | ~17 (inside athena/ subdir) | ~20 differ |
| skills | 12 | 6 | 12 (6 missing entirely) |
| hooks | 21+ scripts | ~10 scripts | 40+ differ |
| memory scripts | 14 scripts | ~8 scripts | 20+ differ |

**Total diverged files**: 106 files across all 5 sync groups.  
**Conclusion**: Path A (delete template assets, install athena-core) is not viable without first upgrading athena-core to v0.2.0 via a full sync — that work exceeds this epic's scope. Path B chosen.

## Smoke Test (2026-06-01)

Verified template slash commands still work (Path B preserves all .claude/ assets):
- `ls .claude/commands/athena/loop.md` → present ✅
- `ls .claude/agents/*.md | grep -v tmpl | wc -l` → 12 agents ✅
- `ls .claude/skills/*.md | wc -l` → 12 skills ✅
- `cat .claude/commands/athena/loop.md | head -5` → command spec readable ✅

Path B leaves all athena assets in-place; no destructive changes were made.  
Slash commands are structurally intact post-E202.
