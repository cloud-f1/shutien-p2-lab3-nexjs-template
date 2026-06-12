# Autopilot Mode (E164)

> Decide what AI can do first, then have humans fill the gaps.
> — Drafted pattern, 2026-04-24

## Why this exists

Every pipeline gate (`/athena:plan`, `/athena:promote`, `/athena:deploy`,
PR review) is valuable in isolation. In aggregate they create **pipeline
stalls**: the system can't make progress without a human in the loop, even
when all signals are unambiguously green.

Autopilot inverts the default. Instead of "ask a human at every gate,"
the question becomes: **is this step's confidence high enough that a human
review wouldn't change the outcome?** When the answer is yes, advance
without asking. When the answer is no, pause with an explanation.

## How it works

```
/athena:autopilot E{n}
        │
        ▼
For each step in spec → implement → qa → commit → merge → deploy:
        │
        ▼
  scripts/confidence/<step>.sh  →  float in [0.00, 1.00]
        │
        ▼
  score >= AUTOPILOT_THRESHOLD (0.85) ?
        │
   yes  │  no
   │    └──▶ pause + write docs/context/autopilot-pause-<epic>-<step>.md
   ▼
  emit autopilot_advance + execute step
```

## Confidence signals

Each step has a deterministic, explainable scorer (no ML — yet).

| Step | Inputs | Hard fail conditions |
|------|--------|----------------------|
| `spec` | spec file ambiguity tokens (TBD/TODO/???); E156 `qa_contract` event presence | spec file missing |
| `implement` | tests-green, coverage delta ≥ 0, no new Stop-verifier violations | (none — additive scoring) |
| `qa` | E162 `review_loop` event: rounds, high_findings, test_quality_score | `high_findings > 0` → 0.0 |
| `commit` | Conventional Commits format, no secrets in diff | secret detected → 0.0 |
| `merge` | n/a | `AUTOPILOT_ALLOW_MERGE != 1` → pause (policy gate) |
| `deploy` | n/a | prod env without `AUTOPILOT_ALLOW_PROD_DEPLOY=1` → pause |

The QA formula in particular:

```
if high_findings > 0:        score = 0.0
round_factor = 1.0 if rounds <= 2 else 0.7 if rounds == 3 else 0.4
score = round_factor * test_quality_score
```

A single HIGH finding is a hard fail. Convergence in ≤2 rounds preserves
the full TQS. Slow convergence damps it.

## Safety: reversibility budget

Autopilot is only safe if every auto-advanced step can be undone cheaply.

| Step | Reversible how? | Cost of mistake |
|------|-----------------|-----------------|
| `spec` | `git checkout -- docs/epics/...` | Doc edit only |
| `implement` | Branch-scoped — never touches main | Deletable feat branch |
| `qa` | Read-only | Zero |
| `commit` | `git reset --soft HEAD~1` on feat branch | Local commit |
| `merge` | **NOT auto-advanced** by default | Would require `git revert` on main |
| `deploy` (staging) | Re-deploy previous tag | Minutes |
| `deploy` (prod) | **NOT auto-advanced** by default | E159 rollback CLI within 10min window |

The two policy gates (`merge` and `prod deploy`) are **off by default**
and require explicit env vars to enable:

- `AUTOPILOT_ALLOW_MERGE=1`
- `AUTOPILOT_ALLOW_PROD_DEPLOY=1`

This means: out of the box, autopilot can take you all the way to a green,
committed feat branch with a paused-merge artifact waiting for human PR
approval. Nothing escapes to main without a human OK.

## Tuning the threshold

`AUTOPILOT_THRESHOLD` defaults to `0.85`. This is a **calibration
parameter**, not a fixed answer.

- **Lower threshold (0.70)** → fewer pauses, more auto-advances, higher
  risk of an issue slipping through.
- **Higher threshold (0.95)** → more pauses, smaller blast radius, but
  you're paying back the human-touch cost the autopilot was meant to remove.

Track per-epic advance vs pause counts in `docs/context/autopilot-log.md`
and `.claude/audit.jsonl`. The acceptance criterion in the spec is
"documented threshold tuning showing which setting produced what
human-touch rate over 10 epics" — start at 0.85, gather data, adjust.

## When to use autopilot vs `/athena:loop`

| Use case | Command |
|----------|---------|
| Single epic, want unattended advance | `/athena:autopilot E{n}` |
| Single epic, want one step at a time with human pacing | `/athena:loop` |
| Multiple epics in a phase, parallel | `/athena:batch --phase N` |
| Multiple epics, fully unattended | `/athena:batch auto` (cron-driven) |

Autopilot is **single-epic**. Multi-epic autopilot waves are explicitly
out of scope for E164; that's future work for a `/athena:autopilot:batch`
or similar.

## Related epics

- E156 contract tests → spec confidence input
- E157 migration signoff → adjacent gate (Stop verifier rule #19)
- E159 SLI middleware + rollback → deploy reversibility
- E162 reviewer convergence loop → QA confidence input (HARD DEPENDENCY)

## Related files

- `.claude/commands/athena/autopilot.md` — command spec
- `scripts/autopilot.sh` — harness
- `scripts/confidence/{spec,implement,qa,commit}.sh` — scorers
- `docs/context/autopilot-log.md` — decision log
- `.claude/audit.jsonl` — `autopilot_advance` / `autopilot_pause` events
