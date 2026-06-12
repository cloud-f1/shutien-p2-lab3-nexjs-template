# E188 — Verification Discipline Skill + Stop Rule #23

> Phase 46 — Workflow Discipline + Memory-Aware Planning | Size: M (8 SP) | Deps: none

## Problem

Agents claim "completed", "done", "shipped", "fixed", "passing" in commit messages and reports **without running the verification commands that would prove it**. Stop verifier has 22 rules covering structural drift (no localStorage, no fireEvent, OpenAPI lint, etc.) but **none of them check the behavior** "agent claimed done without evidence".

This is the most common athena failure mode that escapes Stop verifier: an agent writes `git commit -m "feat(E{n}): X complete"` without ever having run `pytest`, `pnpm test`, or the relevant lint — and the verifier waves it through because the rule set is purely structural.

## Solution

Two-part graft of obra/superpowers `verification-before-completion`:

1. **New skill** `.claude/skills/verification-discipline.md` — codifies the evidence-before-claim pattern. Auto-loaded at SessionStart (joins the existing 8 skills). Lists the verbs that trigger the discipline ("done", "completed", "shipped", "fixed", "passing", "verified") and the required audit event signature (`verification_check`).

2. **Stop Rule #23** — `scripts/hooks/stop-verifier.sh` gains a new rule:
   - **Triggers when** the commit author is an agent (not human) AND the commit message or staged diff contains completion verbs AND no `verification_check` audit event in the last 10 min
   - **Whitelist prefixes** (do NOT trigger): `wip:`, `chore(state):`, `docs:`, `chore(memory):`, `chore(roadmap):`
   - **Action**: `exit 2` with message pointing the agent at the verification-discipline skill

### Audit event schema (consumed by Rule #23, emitted by other agents/skills)

```json
{"ts":"2026-05-20T10:00:00Z","event":"verification_check","check":"pytest","exit":0,"agent":"qa","epic":"E188"}
```

Agents emit this via `scripts/hooks/audit-emit-verification.sh` (new helper) after running a verification command. The skill instructs agents how/when to emit.

## Key Files

| File | Action |
|---|---|
| `.claude/skills/verification-discipline.md` | New — codifies the discipline + verb list + emit pattern |
| `scripts/hooks/stop-verifier.sh` | Edit — add Rule #23 (Global, exit 2) |
| `scripts/hooks/audit-emit-verification.sh` | New — helper for emitting `verification_check` events |
| `scripts/hooks/tests/test-rule-23.sh` | New — 8+ fixtures (whitelist matrix × verb-present × event-present) |
| `scripts/hooks/CLAUDE.md` | Edit — add Rule #23 row in the 22-row table; document `verification_check` event |
| `CLAUDE.md` | Edit — bump "22 rules" → "23 rules" in two locations |

## Implementation

1. Author `verification-discipline.md` skill — verb list, audit event spec, when to emit, examples per agent
2. Author `audit-emit-verification.sh` — single-arg wrapper: `audit-emit-verification.sh <check-name> <exit-code>`; emits JSONL line matching schema
3. Pilot fixture replay — write `test-rule-23.sh` with 8 cases (commit verb present × whitelist prefix present × audit event present × stale audit event)
4. Implement Rule #23 in `stop-verifier.sh` using the same pattern as Rules #18/#19/#20 (global rule, branch detection, `git diff --cached`, audit log grep with timestamp window)
5. **Pilot mode** — gate Rule #23 behind `STOP_RULE_23_ENABLED=1` env var for first 5 days post-merge; flip default-on after fixture-replay against 50+ recent commits shows zero false positives
6. Update CLAUDE.md + scripts/hooks/CLAUDE.md docs

## Acceptance Criteria

- [ ] `.claude/skills/verification-discipline.md` exists, auto-loaded by `scripts/hooks/session-start.sh`
- [ ] `scripts/hooks/stop-verifier.sh` Rule #23 blocks when: agent author + completion verb + no `verification_check` event in last 10 min + no whitelist prefix
- [ ] Rule #23 does NOT block on: `wip:`, `chore(state):`, `docs:`, `chore(memory):`, `chore(roadmap):` prefixes
- [ ] `scripts/hooks/audit-emit-verification.sh` emits well-formed JSON line to `.claude/audit.jsonl`
- [ ] `test-rule-23.sh` covers 8+ fixtures (matrix) and runs in <2s
- [ ] Fixture replay against 50+ historical commits shows zero false positives
- [ ] Hook performance: Rule #23 adds <50ms to Stop verifier total runtime
- [ ] `scripts/hooks/CLAUDE.md` table updated to 23 rows; `verification_check` event documented
- [ ] `CLAUDE.md` "22 rules" mentions updated to "23 rules"
- [ ] Pilot period: `STOP_RULE_23_ENABLED=1` env var honored; default-on after 5-day fixture window

## Alignment / Cross-Epic Hooks

- **Independent epic** — no deps on E187/E189/E190. Ships in Wave 1.
- **Eats own dogfood** — Rule #23 will eventually require the verification skill to emit `verification_check` events from `@qa`, `@reviewer`, `@debugger`, `@deployer` agents. The skill ships with examples for each agent.
- **Reuses E180 audit-log infrastructure** — `verification_check` event follows the established schema (ts/event/+payload fields), same `jq -n -c` emit pattern as `tier0_loaded` / `rule_fired` / `agent_cited` / `plan_brainstorm`.

## Out of Scope

- Per-agent grace-period override (different agents have different verification cadences) — defer; uniform 10-min default is sufficient for v1
- Configurable verb list (currently hardcoded six) — defer; the six cover ~95% of agent completion claims
- Verification-check enforcement on *human* commits — explicitly excluded; humans are exempt
- Auto-emitting `verification_check` from generic hooks (e.g., post-bash detecting `pytest`/`pnpm test`) — defer to Phase 47; v1 requires explicit agent emission via the helper

## Provenance

- Spec source: `docs/superpowers/specs/2026-05-18-athena-phase-46-roadmap.md` §5 E188
- Approved via `/athena:plan approve E187,E188,E189,E190,E191` on 2026-05-19 (Cycle 20)
