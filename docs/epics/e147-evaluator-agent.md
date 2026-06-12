# E147 — Evaluator Agent (@evaluator)

> Phase 37 — Harness Engineering | Size: M (4 SP) | Deps: E146

## Problem

`@qa` currently acts as both Generator (runs tests) and Evaluator (judges quality). Having the same agent execute AND evaluate its own work is a known weakness — Anthropic's "independent evaluator" pattern prescribes a Generator/Evaluator split. Acceptance criteria drift from specs isn't reliably caught: tests can pass while the implementation subtly misses spec requirements.

## Solution

Create a new `@evaluator` agent that performs independent acceptance testing in a clean context. It reads the original epic spec (no implementation memory), verifies the implementation against each numbered acceptance criterion with evidence, and produces a pass/fail verdict. Integrated into `/athena:qa` as a new Phase 4 after `@qa` tests pass.

## Key Files

| File | Action |
|------|--------|
| `.claude/agents/evaluator.md` | New — agent definition with read-only tools |
| `.claude/commands/athena/qa.md` | Edit — add Phase 4 dispatch to @evaluator + `--eval-only` flag |
| `docs/context/evaluation-log.md` | New — designated write-back document (append-only) |
| `docs/context/CLAUDE.md` | Edit — register @evaluator ownership of evaluation-log.md |

## Acceptance Criteria

1. `.claude/agents/evaluator.md` exists with frontmatter:
   - `model: sonnet`
   - `allowed-tools: Read, Grep, Glob, Bash` (no Write/Edit — read-only enforcement)
   - `description` stating "independent acceptance tester, invoked after @qa tests pass"
2. Agent protocol documented: Read spec → Read implementation → For each numbered acceptance criterion, verify with evidence (file path:line or command output)
3. Output format: markdown verdict table with columns — `#`, `criterion`, `verdict` (✅/❌/🟡), `evidence`
4. Writes to `docs/context/evaluation-log.md` with timestamp header per run
5. `docs/context/CLAUDE.md` ownership table updated: `evaluation-log.md` → `@evaluator`
6. `/athena:qa` default flow adds Phase 4: dispatch @evaluator after @qa passes coverage gate
7. `/athena:qa --eval-only` flag dispatches ONLY @evaluator (skip @reviewer + @qa)
8. Final verdict logic: `PASS` if all criteria ✅, `BLOCKED` if any ❌, `ADVISORY` if only 🟡
9. Evaluator cannot modify any file (enforced by allowed-tools omitting Write/Edit)
10. Handles missing spec file gracefully (reports "no spec found for E{n}" without crashing)

## Out of Scope

- No e2e tests (evaluator verifies via Read/Grep only, no browser automation)
- No `/athena:audit` cross-source check integration
- Does not replace `@qa` — augments it as an independent second opinion
