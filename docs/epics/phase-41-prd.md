# Phase 41 — AI-First Integration — PRD

> Product-level view of E162–E164. For technical detail, see each epic spec.
> Source: industry signals 2026-04-24 (OpenMythos/RDT, Claude Design, Drafted).

## Context

Three converging signals this week reframe what an AI-augmented dev template should offer:

1. **OpenMythos / RDT** — recurrent Transformer beats bigger one-shot models. Translated: **iterate on the same artifact until converged**, don't ship the first-pass output.
2. **Claude Design (+ Figma stock drop)** — design-to-code is no longer manual. Template-shape projects with tokenized design systems are the ideal consumers.
3. **Drafted (AI-first org)** — decide what AI can do first, humans fill the gaps. Translated: pipeline should auto-advance when confidence is high, pause only when ambiguous.

Our template already has the inputs for all three (9-agent team, design-system.css, audit log, QA gate). Phase 41 wires them into product capabilities.

## Problem Statements

| # | Gap | Cost today |
|---|-----|-----------|
| 1 | `@reviewer` runs once; fix may introduce new issues unseen until next QA cycle | PRs ship with regressions that a second pass would have caught |
| 2 | Design → React component is 100% manual port | Each new page: ~4–8h of hand-port; design system under-leveraged |
| 3 | Every pipeline step requires human gate even when all signals green | Pipeline stalls; human becomes bottleneck on trivially-green epics |

## Goals

1. **Convergence over one-shot** — reviewer iterates up to 4 rounds with stuck detection
2. **Design system as a generator** — `/athena:design` takes description → production-ready TSX+CSS+test
3. **Confidence-gated advancement** — `/athena:autopilot` advances when score ≥ 0.85; pauses with artifact when ambiguous

## Non-Goals

- Replacing the human plan/promote gates entirely (those stay)
- Auto-prod-deploy (requires explicit env var; default off)
- Multi-modal design input in this phase (description-only)

## Success Metrics

| Metric | Today | Target after Phase 41 |
|--------|-------|----------------------|
| QA cycles to converge (median) | 1 (one-shot) | 2 (with correctness guarantee) |
| Time from design brief → first working component | 4–8h | 20 min |
| % of epics that auto-advance past spec + implement + qa | 0% | 60% (measure after 10 epics) |
| Human touches per epic | 5–7 | 2 (plan gate + merge) |

## Epic Map

```
E162 — Iterative Reviewer Convergence
        ├─ feeds confidence signal to → E164 (qa scorer)
        └─ new `review-findings.md` round format

E163 — Design-to-Code Pipeline (`/athena:design` + @designer)
        └─ 10th agent added to team (was 9)

E164 — Autopilot Mode with Confidence Gates
        ├─ depends on: E162 (convergence → qa confidence)
        ├─ reads: E156 contract results (spec confidence)
        ├─ reads: E159 SLI (deploy confidence)
        └─ respects: AUTOPILOT_ALLOW_MERGE + AUTOPILOT_ALLOW_PROD_DEPLOY (both default off)
```

## Safety Model (E164 critical)

Autopilot is only safe if every auto-advanced step is **reversible within 10 minutes**:

| Step | Reversible? | Autopilot default |
|------|-------------|-------------------|
| spec | Yes, doc edit | AUTO if confidence ≥ threshold |
| implement | Yes, feature branch | AUTO |
| qa | Read-only | AUTO |
| commit | Yes, `git reset` on feat branch | AUTO |
| merge | Only via PR (human-visible) | **PAUSE by default** |
| deploy → staging | Yes, E159 `sre rollback` | AUTO |
| deploy → prod | Rollback in 10min window | **PAUSE by default** |

## Delivery Plan

- **Parallel**: E162, E163 (no deps)
- **Sequential**: E164 after E162 (needs convergence signal as QA confidence input)
- Total estimated: ~1 week with single dev; ~3 days in a batch wave

## Dependencies on Phase 40

Soft dependencies — not blocking, but synergistic:
- E164 reads E156 contract results (spec confidence signal)
- E164 reads E159 SLI (deploy confidence signal)
- E164 reads E162 convergence (qa confidence signal)

If Phase 40 ships first, Phase 41's signals are richer. If Phase 41 ships first, autopilot falls back to simpler signals (test pass + coverage) and upgrades automatically when Phase 40 lands.

## Risk Register

| Risk | Mitigation |
|------|-----------|
| Convergence loop runs forever | Hard ceilings: MAX_ITERATIONS=4, BUDGET=50K tokens, stuck detection |
| @designer produces components that fail Rule #17 (CSS var drift) | Runs Rule #17 as part of output validation before returning to user |
| Autopilot auto-merges bad code | Merge default is PAUSE; requires explicit env var |
| Confidence threshold too loose → bad code ships | Threshold is configurable; start at 0.95 and loosen with data |
| Humans disengage entirely | Autopilot emits audit log entries for every auto-advance; weekly review of `autopilot-log.md` required |

## Rollback Plan

- E162: revert the loop harness; @reviewer returns to one-shot behavior instantly.
- E163: `/athena:design` and `@designer` are additive; never runs unless invoked.
- E164: `/athena:autopilot` is opt-in per invocation; not run by default.

## Story Points & Timeline

| Epic | Size | SP | Est. solo-dev |
|------|------|----|---|
| E162 | M | 5 | ~1 day |
| E163 | L | 8 | ~2 days |
| E164 | M | 5 | ~1 day (after E162 lands) |
| **Total** | | **18 SP** | **~3 days in parallel batch (E162 ‖ E163, then E164)** |

## Dogfooding Plan

| Epic | Dogfood trigger | Observable outcome |
|------|-----------------|---|
| E162 | Run `/athena:qa --review-only` on a PR with a fix that introduces a new regression | Reviewer loop catches it in Round 1; converges in ≤2 rounds |
| E163 | Run `/athena:design UserSettings "Tab-based settings page with profile, notifications, billing"` | Produces 3 files + route registration; passes Stop-verifier Rules #13/#14/#17 without manual edits |
| E164 | Run `/athena:autopilot <epic>` on a known-green trivial epic | Advances through spec → implement → qa → commit without pause; pauses at merge (default-off) |

## Hardening Requirement Before Autopilot Defaults

E164 lands as **opt-in per invocation**. Defaults stay conservative for two full phases (42 + 43) while signal calibration happens:

- `AUTOPILOT_THRESHOLD` stays at `0.85` (not lowered) until 10 runs of telemetry show ≤5% false-advance rate
- `AUTOPILOT_ALLOW_MERGE` remains unset by default
- `AUTOPILOT_ALLOW_PROD_DEPLOY` remains unset by default
- Every auto-advance writes to `autopilot-log.md`; weekly human review is a documented expectation in `docs/guides/en/autopilot.md`

Only after the Phase 41 retro shows the system is calibrated does a follow-up epic consider loosening defaults.

## Post-Phase Retrospective Triggers

Schedule 21 days after Phase 41 merges (longer than Phase 40 because we need autopilot usage data). Review:

- **Convergence**: median rounds for E162 across last 20 PRs (target: 2). Any stuck-detection fires that were false positives?
- **Designer quality**: of components shipped via `/athena:design`, what % needed hand-edits before merge? Regression rate vs hand-written?
- **Autopilot signal**: for every epic autopiloted, was the confidence score justified in hindsight? Any false-advances reverted?
- **Human touches**: did we hit the 2-touch/epic target (plan gate + merge) without degrading quality?
- **Phase 40 feedback loop**: did Phase 40's richer signals (contract + migration + SLI) make autopilot confidence measurably more discriminating?

Write findings to `docs/context/review-findings.md` under `## Phase 41 Retro`. Success feeds E164 threshold tuning and future default-on behavior.
