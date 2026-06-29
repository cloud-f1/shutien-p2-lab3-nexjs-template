# Mockup to Production Playbook

> End-to-end runbook: from an HTML mockup or Claude Design handoff to a merged PR on Zeabur.

## Overview

This playbook covers the full cycle of taking a visual design handoff and turning it into shipped production code using the Athena agent pipeline.

---

## Step 1: Receive the Mockup

**What you have:** An HTML prototype (e.g., exported from Claude Design) or a static `.html` file with the UI design.

**What to do:**
- Save the mockup file somewhere accessible in the repo, e.g., `docs/design/<feature-name>.html`
- Confirm the mockup covers the full feature surface — all tabs, states (empty / loading / error), and RBAC-gated views

**Gotchas:**
- Claude Design exports are self-contained HTML with inline CSS. Make sure you have the raw `.html`, not a screenshot.
- If the mockup uses placeholder data, note it — the implementation will need real data wiring.

---

## Step 2: Generate UI-Ready Epics

**Command:**
```bash
/athena:plan mockup <path-to-mockup.html>
```

**What to expect:**
- The `mockup-to-epics` skill parses the HTML, identifies UI components, routes, and interactions
- Outputs a set of epics in `docs/epics/` with implementation tasks mapped to Next.js patterns
- Each epic follows the `spec → implement → qa → commit → merge` pipeline

**Gotchas:**
- The skill produces UI-focused epics. If the mockup implies backend data (e.g., a table of records), the epic will include the Server Action + Drizzle schema work.
- Review the generated epics before approving — the skill may create more epics than needed if the mockup is complex. Prune or merge as needed.
- Ensure each epic has a Phase Status table row in `docs/context/epic-progress.md`, or `athena:batch auto` cannot see them (see [Epic Phase Status table registration](../context/CLAUDE.md)).

---

## Step 3: Review and Approve Epics

**Command:**
```bash
/athena:plan approve all
```

Or approve individually:
```bash
/athena:plan approve E314
```

**What to expect:**
- Approved epics move to `pending` status in `EPIC_INDEX.md`
- The orchestrator can now pick them up in wave dispatch

**Gotchas:**
- Do not approve epics that depend on incomplete upstream epics. Check the Dependency Rules section in `EPIC_INDEX.md`.
- If a design is complex, consider running `/athena:plan brainstorm "<feature>"` first to refine the spec before generating epics from the mockup.

---

## Step 4: Execute the Wave

**Command:**
```bash
/loop 5m /athena:batch auto
```

Or a single manual pass:
```bash
/athena:batch auto
```

**What to expect:**
- `athena:batch` reads the epic graph, resolves dependency waves, and dispatches epics in parallel (up to `MAX_CONCURRENT=4` by default)
- Each epic runs `spec → implement → qa → commit` steps automatically
- The loop re-runs every 5 minutes until all epics in the wave are complete

**Gotchas:**
- Parallel dispatch requires worktree isolation. If your machine's worktree isolation is broken, `athena:batch` auto-falls back to sequential mode.
- Step 3.5 (pre-flight smoke test) gates parallel dispatch — if it fails, check `.claude/audit.jsonl` for the reason.
- Budget is enforced per epic. If an epic exceeds `REVIEW_LOOP_BUDGET`, it will stall — check the orchestration log at `docs/context/orchestration-log.md`.

---

## Step 5: QA, Alignment Audit, and Merge

**Commands (run in order):**

```bash
# 1. Run the alignment audit to confirm the built UI matches the spec
/athena:align

# 2. Review any gaps the audit found
# (athena:align outputs a Page-View + Feature-Mapping table)

# 3. If gaps exist, create follow-up epics or fix inline
/athena:plan brainstorm "<gap description>"

# 4. Once satisfied, open the PR
/athena:pr

# 5. Merge on GitHub (agents cannot merge — only humans can)
# Visit the PR URL returned by /athena:pr and merge via the GitHub UI
```

**What to expect:**
- `/athena:align` checks the live app against the epic spec and surfaces dead links, missing tabs, and RBAC-gated surfaces that are not covered
- `/athena:pr` runs the full quality gate: typecheck + lint + unit tests + e2e, then opens a PR

**Gotchas:**
- Agents cannot merge PRs directly (GitHub permissions). The PR must be merged by a human via the GitHub UI.
- If `pnpm typecheck` or `pnpm lint` fails inside `/athena:pr`, fix the issues before re-running.
- After merge, run `docker compose up --build -d` locally to confirm the full stack boots without errors.

---

## Deployment to Zeabur

After the PR is merged to `main`, Zeabur auto-deploys if the project is connected to the `main` branch.

For manual deploy or to verify:
```bash
/athena:deploy
```

See `docs/techstack/deployment.md` for the 7-gate pre-deploy protocol and rollback procedure.

---

## Reference

| Resource | Location |
|---|---|
| mockup-to-epics skill | `.claude/skills/mockup-to-epics.md` |
| Epic pipeline conventions | `docs/epics/CLAUDE.md` |
| Alignment audit | `.claude/skills/alignment-audit.md` |
| Zeabur deploy SOP | `.claude/skills/zeabur-deploy.md` |
| Techstack reference | `docs/techstack/README.md` |
