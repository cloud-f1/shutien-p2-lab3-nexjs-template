# Promotion Proposal: Brainstorm-First Planning Workflow

> Tags: [workflow, planning, dialogue, memory-aware, GENERALIZABLE]
> Source: Phase 46 (E187 + E188 + E189 + E190 + E191)
> Proposed: 2026-05-19

## Summary

The brainstorm-first workflow replaces audit-driven "what's broken?" planning with
dialogue-driven "what do we want to build?" planning. Key insight: a design dialogue
that reads past memory before proposing reduces duplicate effort and surfaces known
pitfalls at the cheapest possible moment (before implementation begins).

## Pattern

```
/athena:plan brainstorm "<idea>"
  → Step 0: retrieve Tier 0 lessons matching keywords (brainstorm-retrieve.sh)
  → Step 0b: grep Tier 1 context files for keyword hits
  → Steps 1-7: dialogue (explore → Q&A → approaches → design → capture → JSON → emit)
  → brainstorm-emit.sh render-epic: enriched epic file (Phases + Checkpoints + Test Strategy)
```

## Why It Works

- Memory retrieval at design time (not SessionStart) catches lessons when they're actionable
- 7-step Socratic protocol prevents "yes, and" trap — forces explicit trade-off discussion
- Enriched epic template embeds the implementation plan alongside the acceptance criteria
- Stop Rule #23 (verification discipline) prevents completion claims without evidence

## Evidence

- E187: brainstorm-emit.sh harness + @strategist Brainstorm Mode; 7 fixture tests
- E188: verification_check audit event; 19 fixture tests; Stop Rule #23
- E189: brainstorm-retrieve.sh; 11 fixture tests; 0 false positives on real Tier 0
- E190: consolidation-detect.sh (maintenance companion); 12 fixture tests
- Phase 46 shipped end-to-end in one session with zero QA failures

## Promote to Tier 0 When

- After 30+ days of actual brainstorm sessions (check `jq` brainstorm context retrievals)
- When `brainstorm-retrieve.sh` shows ≥3 successful lesson injections (lessons surfaced useful)
- `/athena:metrics --memory` → "Brainstorm context retrievals" section shows non-zero count
