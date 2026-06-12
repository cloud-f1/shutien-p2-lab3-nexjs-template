---
description: "(epic) Confidence-gated auto-advance → spec→impl→qa→commit→merge when score ≥ threshold. Pauses on low-confidence steps."
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---

# Autopilot — Confidence-Gated Pipeline Runner (E164)

Runs the **full pipeline for ONE epic** with no human approval at intermediate
steps, **iff** every step's deterministic confidence score clears
`AUTOPILOT_THRESHOLD` (default `0.85`). Any step that scores below threshold
emits a pause artifact and stops the run for human review.

> Drafted-pattern (2026-04-24): decide what AI can do first, humans fill gaps.
> See `docs/guides/en/autopilot.md` for philosophy and reversibility budget.

## Usage

```
/athena:autopilot E{n}                   # start a new autopilot run
/athena:autopilot E{n} --resume          # resume from the last paused step
/athena:autopilot E{n} --dry-run         # show plan + per-step scores, no actions
/athena:autopilot E{n} --threshold 0.90  # override threshold for this run only
/athena:autopilot --status E{n}          # show current pause artifacts (read-only)
/athena:autopilot E{n} --effort <tier>   # quick|standard|thorough|ultra — scales verification depth and model tier (default: standard)
```

**Step 0 — Resolve effort tier:**
```bash
eval "$(./scripts/effort/resolve.sh "$ARGUMENTS" 2>/dev/null || true)"
```

## Steps and confidence signals

| Step | Scorer | Inputs | Reversible? |
|------|--------|--------|-------------|
| `spec` | `scripts/confidence/spec.sh` | spec file ambiguity tokens (TBD/TODO/???); E156 `qa_contract` event | Yes — `git checkout` |
| `implement` | `scripts/confidence/implement.sh` | tests-green, coverage delta ≥ 0, no new Stop-verifier violations | Yes — feat branch only |
| `qa` | `scripts/confidence/qa.sh` | E162 `review_loop` event: `rounds`, `high_findings`, `test_quality_score` | Yes — read-only |
| `commit` | `scripts/confidence/commit.sh` | Conventional Commits format, no secret patterns in diff | Yes — `git reset` on feat branch |
| `merge` | n/a (policy-only) | **Always pauses** unless `AUTOPILOT_ALLOW_MERGE=1` | No — must be human-approved |
| `deploy` | n/a (policy-only) | Auto-advances to staging only; prod **always pauses** unless `AUTOPILOT_ALLOW_PROD_DEPLOY=1` | Yes (E159 rollback CLI within 10min) |

### QA confidence formula (signature scorer)

```
if high_findings > 0:        score = 0.0       # HIGH always blocks
round_factor = 1.0  if rounds <= 2
              0.7  if rounds == 3
              0.4  if rounds >= 4
score = round_factor * test_quality_score
```

This makes QA confidence **deterministic and explainable**: a single
high-severity finding is a hard fail; convergence in ≤2 rounds preserves
the full TQS; slow convergence damps it.

## Safety contract (CRITICAL — do not weaken)

1. **`merge` is NEVER auto-advanced** unless `AUTOPILOT_ALLOW_MERGE=1` is
   exported in the environment. Default behavior: pause + write artifact.
2. **`deploy` to prod is NEVER auto-advanced** unless
   `AUTOPILOT_ALLOW_PROD_DEPLOY=1` is exported. Staging deploys auto-advance
   when policy is satisfied (rollback window E159).
3. Every advance and every pause writes BOTH to `.claude/audit.jsonl` (events
   `autopilot_advance` / `autopilot_pause`) AND to `docs/context/autopilot-log.md`.
4. Pauses produce `docs/context/autopilot-pause-<epic>-<step>.md` containing:
   - the failing score and threshold
   - the reason (which signal failed)
   - the resume command

## Environment

| Variable | Default | Effect |
|----------|---------|--------|
| `AUTOPILOT_THRESHOLD` | `0.85` | Score below this triggers pause |
| `AUTOPILOT_ALLOW_MERGE` | unset | Set to `1` to allow auto-merge |
| `AUTOPILOT_ALLOW_PROD_DEPLOY` | unset | Set to `1` to allow auto-prod-deploy |
| `AUTOPILOT_DEPLOY_ENV` | `staging` | `prod` enforces extra gate |
| `AUDIT_FILE` | `.claude/audit.jsonl` | Audit event sink |
| `AUTOPILOT_LOG` | `docs/context/autopilot-log.md` | Human-readable log |
| `REVIEW_LOOP_BUDGET` | (inherited from E162) | Token budget for QA convergence |

These are documented in `.claude/settings.json` (env contract section). The
harness reads them directly — no harness setting is required.

## Protocol (what /athena:autopilot does)

For the requested epic, walk steps in pipeline order. At each step:

1. **Compute confidence** by calling `scripts/autopilot.sh --score <epic> <step>`.
2. **Decide** by calling `scripts/autopilot.sh <epic> <step>`:
   - exit `0` → advance (caller should now execute the step)
   - exit `2` → pause (caller stops, surfaces the artifact path, exits cleanly)
3. **Execute the step** (only when advance was granted):
   - `spec` → `Agent(general-purpose)` running `/athena:spec "E{n}"`
   - `implement` → `Agent(general-purpose, isolation: "worktree")` running `/athena:implement`
   - `qa` → `Agent(general-purpose)` running `/athena:qa`
   - `commit` → inline (Bash + Edit) — branch, stage, commit
   - `merge` → inline (Bash) — `git push` + `gh pr create` + `gh pr merge --auto`
   - `deploy` → inline (Bash) — `scripts/deploy-zeabur.sh ${AUTOPILOT_DEPLOY_ENV}` (or equivalent)
4. **Re-score** the step after execution to confirm signals are still green.
   If post-execution score drops below threshold, treat as pause for the
   *next* step (do not retroactively unwind the completed step).
5. **Stop on first pause.** Do NOT continue past a paused step. Report the
   artifact path and exit.

`--resume` reads the existing pause artifact, removes it (so future runs
don't double-pause on the same artifact), and re-enters the protocol at the
paused step.

## Reporting

Final report (success path):

```
=== Autopilot Report — E{n} ===

✅ spec        score=0.95  advance
✅ implement   score=0.93  advance
✅ qa          score=0.85  advance (rounds=1, HIGH=0, TQS=0.85)
✅ commit      score=0.95  advance (conventional, no secrets)
⏸ merge        score=1.00  PAUSE   (policy: AUTOPILOT_ALLOW_MERGE unset)
              → docs/context/autopilot-pause-E{n}-merge.md

Resume: /athena:autopilot E{n} --resume
       (or: AUTOPILOT_ALLOW_MERGE=1 /athena:autopilot E{n} --resume)
```

## Observability

Aggregate auto-advance vs pause rate using:

```bash
# Pause/advance ratio per epic
jq -s '
  map(select(.event == "autopilot_advance" or .event == "autopilot_pause"))
  | group_by(.epic)
  | map({
      epic: .[0].epic,
      advances: (map(select(.event == "autopilot_advance")) | length),
      pauses:   (map(select(.event == "autopilot_pause"))   | length)
    })
' .claude/audit.jsonl
```

Use this to **calibrate `AUTOPILOT_THRESHOLD` over time**. The acceptance
criterion in the spec is: documented threshold tuning showing which setting
produced what human-touch rate over 10 epics.

## Out of scope (per spec)

- ML-based confidence (deterministic signals first — explainable)
- Auto-create-PR (still an explicit human gate)
- Multi-epic autopilot waves (single-epic only; batch autopilot is future work)
