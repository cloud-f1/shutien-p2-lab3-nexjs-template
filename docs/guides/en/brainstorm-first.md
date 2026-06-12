# Brainstorm-First Workflow

> How to use `/athena:plan brainstorm` to refine a feature idea before writing any code. Estimated time: **20 minutes**.

---

## Introduction

After completing this guide, you will understand:

- What `/athena:plan brainstorm` does and when to use it
- The 7-step dialogue protocol run by `@strategist` (E187)
- How a brainstorm session becomes a richly-structured epic file
- How past lessons surface during the dialogue (E189 — Wave 2)
- How brainstorm mode compares to the other `/athena:plan` modes

### Prerequisites

- Claude Code CLI installed and project set up (see [Quickstart](quickstart.md))
- Familiar with the Epic Pipeline (see [First Epic Walkthrough](first-epic-walkthrough.md))

---

## What is Brainstorm Mode?

The standard planning pipeline (`/athena:plan auto`) is **analysis-driven** — it scans the codebase, compares against industry patterns, and proposes epics based on what is missing or broken. This works well when you want the system to surface problems for you.

`/athena:plan brainstorm` is **idea-driven**. You start with a rough feature concept; `@strategist` conducts a structured Q&A dialogue to sharpen it into a fully decomposed epic with implementation phases, acceptance checkpoints, and a test strategy.

**Use brainstorm mode when:**

- You already have a specific feature in mind and want to validate and structure it
- You want to avoid over-engineering before spec and code
- The feature crosses multiple subsystems and you want to think through dependencies first
- You are about to enter a cycle and want the agent to challenge your assumptions

**Do not use brainstorm mode when:**

- You have no idea what to build next → use `/athena:plan audit` or `auto`
- You want to check dependencies and security → use `/athena:plan evolve`
- You want to assess compliance gaps → use `/athena:plan comply`

---

## Planning Mode Comparison

| Mode | Input | Output | Best For |
|------|-------|--------|----------|
| `brainstorm "idea"` | Your feature concept | Structured epic with phases + checkpoints | Known feature, needs design clarity |
| `audit` | Codebase scan | Weakness + debt epics | Unknown problems, technical debt |
| `research` | Industry landscape | Gap + opportunity epics | Competitive positioning |
| `comply` | Standards checklist | OWASP / WCAG remediation epics | Compliance obligations |
| `evolve` | Dependency tree | Upgrade + CVE-fix epics | Maintenance cycles |
| `auto` | All of the above | Unified prioritised list | You want everything surfaced |

---

## The Brainstorm Dialogue Protocol

Once you run `/athena:plan brainstorm "your idea"`, the `@strategist` agent follows a 7-step protocol:

### Step 1 — Context Exploration

Before asking any questions, the agent reads up to 5 relevant files:

- `docs/context/epic-progress.md` — what is already built or in progress
- `docs/context/strategy-log.md` — recent cycles and deferred ideas
- Any code paths the idea is likely to touch

This means the first question it asks is already informed by your project state.

### Step 2 — Clarifying Questions (max 7)

The agent asks **one question at a time**, targeting:

1. **Purpose** — what problem does this solve, and for whom?
2. **Constraints** — technical, business, or time boundaries
3. **Success criteria** — how will you know the feature worked?

Hard limit: 7 questions. You can tell the agent to stop early: *"That's enough, let's proceed."*

### Step 3 — Approach Proposals

The agent proposes **2 to 3 implementation approaches** with trade-offs, then recommends one. You can accept, modify, or ask for a different approach.

### Step 4 — Section-by-Section Design Review

The agent presents design sections in order, asking *"Looks right?"* after each:

- **Architecture** — how the feature fits into the existing system (1-3 sentences)
- **Components / files** — what will be created or changed
- **Data flow** — request → processing → response path
- **Error handling** — failure modes and how they are surfaced
- **Testing strategy** — what to test, at which layer, with what tools

You can push back on any section before moving forward.

### Step 5 — Scratchpad Capture

During the dialogue the agent builds a structured scratchpad capturing:

- Implementation phases (minimum 3, each with specific tasks)
- Per-phase verification checkpoints
- Test strategy summary
- Dependencies on other epics
- Risk register

Nothing is written to disk yet.

### Step 6 — JSON Emit

Once you approve the design, the agent writes a JSON file to `/tmp/brainstorm-E{n}.json`:

```json
{
  "epic": "E{n}",
  "slug": "weekly-digest-emails",
  "name": "Weekly Digest Emails",
  "priority": "P1",
  "size": "M",
  "sp": 5,
  "rationale": "Drives re-engagement without push notifications",
  "phases": [
    {"id": 1, "name": "Data aggregation query", "tasks": ["add digest_stats view", "test pagination"]},
    {"id": 2, "name": "Email template + send", "tasks": ["Jinja2 template", "SendGrid integration", "test delivery"]},
    {"id": 3, "name": "Scheduler + opt-out", "tasks": ["celery beat job", "unsubscribe endpoint", "e2e test"]}
  ],
  "checkpoints": [
    {"phase": 1, "verify": "digest_stats query returns correct row counts in tests"},
    {"phase": 2, "verify": "email renders correctly in two themes"},
    {"phase": 3, "verify": "opt-out link disables future sends; celery job completes in CI"}
  ],
  "test_strategy": "Unit-test aggregation query with factory-boy fixtures; integration-test send path with mocked SendGrid; e2e Playwright test for opt-out link",
  "dependencies": [],
  "risks": ["SendGrid rate limits in burst scenarios", "digest data staleness if query is slow"]
}
```

### Step 7 — Harness Handoff

The `/athena:plan` command reads the JSON and runs `brainstorm-emit.sh strategy-log` to add the proposal row to `docs/context/strategy-log.md`. You will see:

```
Brainstorm complete. Epic E{n} proposed in docs/context/strategy-log.md.
Run /athena:plan approve E{n} to render the enriched epic file.
```

The session stops here. **Human approval is always required before the epic file is created.**

---

## Memory-Aware Retrieval (E189 — Wave 2)

> **Status**: Coming in Wave 2. This section describes planned behaviour.

When E189 ships, the brainstorm dialogue will automatically surface relevant Tier 0 and Tier 1 lessons as **design considerations** during the Q&A. For example, if your Tier 0 memory contains a lesson about "SendGrid rate limits during burst sends", that lesson will appear in Step 4 when the agent is reviewing the error-handling section of a digest-email feature.

You do not need to do anything — the injection is automatic. Lessons are shown inline, labelled with their source (Tier 0 = cross-project, Tier 1 = this project's history). You can dismiss a lesson if it is not relevant to your current context.

---

## The Enriched Epic File

When you run `/athena:plan approve E{n}` after a brainstorm session, the harness runs `brainstorm-emit.sh render-epic` to produce an enriched epic file. Unlike the standard template, the enriched file includes:

### Implementation Phases

Each phase is a discrete unit of work that can be independently reviewed and tested:

```markdown
## Implementation Phases

### Phase 1 — Data Aggregation Query
- Add `digest_stats` database view
- Write pagination wrapper
- Unit tests with factory-boy fixtures

### Phase 2 — Email Template + Send
- Jinja2 template (two theme variants)
- SendGrid integration with retry logic
- Integration tests with mocked provider

### Phase 3 — Scheduler + Opt-out
- Celery beat job (configurable cadence)
- `POST /users/me/digest-opt-out` endpoint
- End-to-end Playwright test for opt-out flow
```

### Per-Phase Checkpoints

Each phase has an explicit, verifiable exit condition before moving to the next:

```markdown
## Per-Phase Checkpoints

| Phase | Checkpoint |
|-------|------------|
| 1 | `digest_stats` query returns correct row counts in tests |
| 2 | Email renders correctly in both dark and indigo themes |
| 3 | Opt-out link disables future sends; Celery job passes in CI |
```

### Test Strategy

A single paragraph describing what is tested, at which layer, and with which tools — written during the dialogue so it reflects the actual design decisions:

```markdown
## Test Strategy

Unit-test the aggregation query with factory-boy fixtures (server/tests/unit/).
Integration-test the send path with a mocked SendGrid client (server/tests/integration/).
End-to-end Playwright test covers the opt-out link and verifies no further digest is sent.
```

---

## End-to-End Example

### Feature: Weekly Digest Emails

**Scenario**: You want to add a weekly summary email that shows each user their activity from the past 7 days.

#### 1. Start the brainstorm session

```
/athena:plan brainstorm "weekly digest email — show users their last 7 days of activity"
```

#### 2. Answer the dialogue questions

The agent might ask:

- *"Who are the primary recipients — all users, or opted-in only?"* → Opted-in, with a global default ON.
- *"What activity data should appear in the digest?"* → Project count, tasks completed, last login.
- *"What is your email provider?"* → SendGrid, already integrated for transactional email.
- *"How do you define 'digest sent successfully'?"* → Delivery confirmed + open tracked within 48 h.

After 4 questions you reply: *"That's clear enough, let's design it."*

#### 3. Review the approach proposals

The agent proposes:

- **A** — Synchronous send on a cron endpoint (simple, brittle under load)
- **B** — Celery beat job with retry logic (recommended — resilient, testable)
- **C** — Queue-based fan-out with SQS (over-engineered for current scale)

You select **B**.

#### 4. Walk through design sections

You approve architecture, components, data flow. On error handling you add: *"Add a dead-letter queue for failed sends."* The agent updates the scratchpad.

#### 5. Approve and emit

```
Brainstorm captured at /tmp/brainstorm-E201.json.
Next: /athena:plan command will run brainstorm-emit.sh strategy-log.
Then /athena:plan approve E201 to render the enriched epic file.
```

#### 6. Approve the epic

```
/athena:plan approve E201
```

The harness renders `docs/epics/e201-weekly-digest-emails.md` with the enriched format and adds the epic to `docs/context/epic-progress.md`.

#### 7. Execute the epic

```
/athena:loop    # advances: spec → implement → qa → commit → merge
```

---

## Brainstorm vs. Legacy Flow

| | Legacy (`/athena:plan auto → implement`) | Brainstorm-First |
|---|---|---|
| **Starting point** | System proposes based on analysis | You bring the idea |
| **Design validation** | None before spec | Q&A dialogue before any file is touched |
| **Epic structure** | Standard template (Problem / Solution / AC) | Enriched with phases + checkpoints + test strategy |
| **Human gate** | One approval | Same — approval still required |
| **Memory integration** | Not during planning | E189: past lessons surface during dialogue (Wave 2) |
| **Best for** | "Tell me what to build" | "I know what to build, help me structure it" |

The brainstorm flow does not replace `/athena:plan auto` — it is an additional entry point for when you arrive with a feature concept rather than an open-ended question.

---

## Common Questions

**Q: Can I skip the Q&A and just describe the full feature upfront?**

Yes. If your initial description is already detailed (purpose, constraints, success criteria all stated), the agent will skip redundant questions and move directly to approach proposals. The 7-question cap is a ceiling, not a target.

**Q: What if I want to change the design after approving?**

Run the brainstorm session again with a revised description. The strategy-log entry will be updated and a new JSON file will be emitted. Previous entries are preserved for audit purposes.

**Q: Is the JSON file persistent?**

The `/tmp/brainstorm-E{n}.json` file is temporary. The durable record is the strategy-log.md entry and, after approval, the rendered epic file. Do not depend on the JSON file being present after a session restart.

**Q: What happens if I approve but the JSON is missing?**

The harness will reconstruct the epic from the strategy-log entry using the standard template (phases, checkpoints, and test strategy will be omitted). Run the brainstorm session again to get the enriched format.

---

## Next Steps

- **[AI Agent Team Guide](ai-agent-team-guide.md)** — Learn how to run multiple epics in parallel once they are approved
- **[Memory System Guide](memory-system.md)** — Understand how past lessons are stored and retrieved
- **[First Epic Walkthrough](first-epic-walkthrough.md)** — See the full pipeline from epic file to merged PR

---

## Reference

| Resource | Description |
|----------|-------------|
| `.claude/commands/athena/plan.md` | Full `/athena:plan` command specification |
| `.claude/agents/strategist.md` | `@strategist` agent definition including Brainstorm Mode protocol |
| `scripts/plan/brainstorm-emit.sh` | Harness script — `strategy-log` and `render-epic` sub-commands |
| `docs/context/strategy-log.md` | All planning cycle history |
| [Epic Index](../../epics/EPIC_INDEX.md) | All approved epics and their pipeline state |
