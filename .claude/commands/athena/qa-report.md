---
description: "(ops) QA-to-Epic pipeline → analyze bugfix-log.md → group by severity → generate epic proposals. Human gate before EPIC_INDEX."
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# /athena:qa-report — QA-to-Epic Pipeline

Parse $ARGUMENTS for flags:

- `approve E{n},E{m},...` → approve specific proposed epics from the report
- `approve all`           → approve all proposed epics
- `reject E{n}`           → reject a proposed epic (with optional reason)
- (no flag)               → generate/update the QA report

---

## Phase 1 — Read Bugfix Log

1. Read `docs/context/bugfix-log.md`
   - If the file does not exist or is empty, report: "No bugfix-log.md found. Fix commits auto-create this file via the E148 hook. Nothing to analyze." STOP.
2. Parse all entries — each entry is an `## {timestamp} — {hash}` section
3. Filter to **unresolved entries only**: those where `**Root Cause:**` contains `_(pending` 
   - Already-enriched entries (root cause filled in) are skipped
4. If zero unresolved entries: report "All bugfix entries have been enriched. No pending bugs to analyze." STOP.

## Phase 2 — Classify and Group

For each unresolved entry, classify:

### Severity (from commit message + files changed)
- **Critical** — auth, security, data loss, crash keywords
- **High** — API errors, broken endpoints, failed validations
- **Medium** — UI bugs, styling, non-blocking errors
- **Low** — typos, cosmetic, logging issues

### Domain (from files changed)
- Map file paths to domains: `actions/*.ts` → Server Actions, `app/api/**/route.ts` → Route Handlers, `app/(dashboard)/**` + `components/**` → UI, `lib/schema/*` → DB schema, `lib/validations/*` → validation, etc.
- Group related bugs (same domain + similar root area) into a single proposed epic

## Phase 3 — Generate Epic Proposals

For each bug group, generate an epic proposal:

```markdown
### Proposed: E{next} — {Title}

**Problem:** {1-2 sentence description of the bug pattern}
**Bugs:** {list of commit hashes from bugfix-log}
**Affected Files:** {unique file list across all grouped bugs}
**Severity:** {Critical|High|Medium|Low}
**Domain:** {domain name}
**Size Estimate:** {S (1-2 SP) | M (3-5 SP) | L (8+ SP)}
**Rationale:** {why this needs a dedicated epic vs. already-fixed}
**Status:** PROPOSED
```

Rules for proposals:
- Related bugs in the same domain → merge into one epic
- Size estimate based on file count and severity: 1-2 files = S, 3-5 files = M, 6+ files = L
- Next E-number: read `docs/epics/EPIC_INDEX.md`, find the highest E-number, increment from there
- Maximum 10 proposals per report — if more, group more aggressively

## Phase 4 — Write Report

Write (overwrite, not append) to `docs/context/qa-report.md`:

```markdown
# QA-to-Epic Report

> Generated: {ISO timestamp}
> Source: docs/context/bugfix-log.md
> Unresolved bugs analyzed: {count}

## Summary

| Severity | Count | Proposed Epics |
|----------|-------|----------------|
| Critical | {n}   | {epic list}    |
| High     | {n}   | {epic list}    |
| Medium   | {n}   | {epic list}    |
| Low      | {n}   | {epic list}    |

## Epic Proposals

{each proposal from Phase 3}

---

## Next Steps

Run `/athena:qa-report approve E{n},E{m}` to approve specific epics.
Run `/athena:qa-report approve all` to approve all proposals.
Run `/athena:qa-report reject E{n}` to reject with optional reason.

Approved epics will be added to `docs/epics/EPIC_INDEX.md`.
```

Report to user: "{N} epic proposals generated from {M} unresolved bugs. Review docs/context/qa-report.md then approve or reject." STOP — await human decision.

---

## Approval Flow

### approve E{n},E{m},... (or approve all)

1. Read `docs/context/qa-report.md` — if no proposals exist or file missing, error and STOP
2. For each approved epic number:
   a. Find the matching proposal in the report
   b. Create `docs/epics/e{n}-{slug}.md` with full epic spec:
      - Problem statement from the proposal
      - Acceptance criteria derived from the bug descriptions
      - Key files from affected files list
      - Size and dependencies
   c. Add row to `docs/epics/EPIC_INDEX.md` in the appropriate phase
   d. Register the epic in `docs/context/epic-progress.md` (mirrors `/athena:plan`'s
      approve flow) — otherwise the orchestrator (`/athena:loop`, `/athena:batch`)
      cannot see it:
      - Add a **Phase Status table** row for the epic's phase (create the phase row
        if new, or append the epic ID to an existing pending phase row)
      - Add a **Epic Step Matrix** row for the epic with all 5 steps ⬜
        (spec / implement / qa / commit / merge)
   e. Update the proposal status in `docs/context/qa-report.md` from `PROPOSED` to `APPROVED`
3. Report: "Approved {N} epics: {list}. Run `/athena:loop` to begin execution."

### reject E{n}

1. Read `docs/context/qa-report.md`
2. Find the matching proposal
3. Update status from `PROPOSED` to `REJECTED — {reason}` (default reason: "Rejected by reviewer")
4. Report: "Rejected E{n}. Reason: {reason}"

---

## Safety Rules

- NEVER modify EPIC_INDEX.md without explicit human approval (approve command)
- NEVER auto-commit the report — it is a working document for human review
- NEVER duplicate proposals — overwrite the report on re-run (idempotent)
- ALWAYS stop after generating the report and wait for human decision
- ALWAYS read the latest bugfix-log.md — never cache between runs
