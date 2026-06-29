# Your AI dev team — org chart

> **Status:** active · **Last updated:** 2026-06-30
> The "one window" pattern — *a single point of contact, a shared brain, named specialists with crisp
> deliverables* — converted to **this repo's dev agent team**. You talk to **TONY** (the main
> thread); it routes your one sentence to the right teammate and hands the result back.

## The flow

```
State a goal ──► TONY routes ──► Right teammate executes ──► Deliverable returned to you
(one sentence)   (dispatch)       (the right agent)            (PR / report / deploy + health)
```

You never need to remember ~25 slash commands or 12 agent ids. State the goal; TONY maps it.
TONY's routing logic lives in the **`chief-of-staff` skill**.

## Org chart

```
                         YOU  (a plain-language goal)
                                  │
                    ┌─────────────────────────────┐
                    │   TONY — Chief of Staff      │   = the main thread + the
                    │   (chief-of-staff skill)     │     chief-of-staff routing playbook
                    └──────────────┬──────────────┘
   ┌───────────┬──────────────┬────┴───────┬───────────┬────────────┬──────────────┐
  PLAN         BUILD          GUARD         SHIP        DATA         BRAIN      FIELD CMD
 ATLAS         PENNY          ARGUS         PORTER      DELTA        REMI       MAX
 SAGE          VERA           QUINN         (+health)
               DOC            JUDE
                                  │
                        ┌─────────────────────────┐
                        │  SHARED BRAIN (Unit 0)   │  CLAUDE.md · Tier-0/Tier-1 memory ·
                        │  every teammate reads it │  nextjs-saas-patterns · skills
                        └─────────────────────────┘
```

## The shared brain (Unit 0)

Every teammate reads the same foundation first, so they all "speak your project" without
re-explaining:
- **`CLAUDE.md`** — architecture rules, stack gotchas, current state.
- **Tier-0 / Tier-1 memory** — `~/.claude/template-memory/` (cross-project wisdom) + `docs/context/`
  (this project's state). Curated by **REMI**.
- **Skills** — `nextjs-saas-patterns` (stack gotchas), `chief-of-staff` (TONY routing), domain skills.

## Team roster

| Persona | Agent ID | Dept | Does | Command |
|---|---|---|---|---|
| **TONY** | *(main thread)* | Chief of Staff | routes a goal → the right teammate; reports back | `chief-of-staff` skill |
| **ATLAS** | strategist | Plan | epic proposals, codebase audits, roadmap waves | `/athena:plan` |
| **SAGE** | best-practice | Plan | architecture decisions, trade-off memos | (architecture Q&A) |
| **PENNY** | spec-writer | Build | feature specs + acceptance criteria | `/athena:spec` |
| **VERA** | designer | Build | TSX + CSS + smoke test from design tokens | `/athena:design` |
| **DOC** | debugger | Build | root-cause + patch (often auto-delegated) | (auto) |
| **ARGUS** | reviewer | Guard | code review + security findings | `/athena:qa --review-only` |
| **QUINN** | qa | Guard | test run + 80% coverage gate | `/athena:qa --test-only` |
| **JUDE** | evaluator | Guard | independent acceptance verdict | `/athena:qa --eval-only` |
| **PORTER** | deployer | Ship | 7-gate Zeabur deploy + CI/deploy health | `/athena:deploy` |
| **DELTA** | dba | Data | migration review, schema design, DB forensics | `/athena:dba` |
| **REMI** | memory-curator | Brain | promote lessons → Tier 0 shared brain | `/athena:promote` |
| **MAX** | orchestrator | Field cmd | parallel epic dependency-wave dispatch | `/athena:batch` |

## Team cards — concrete deliverables

> Each card: **persona** → *agent id* · when to call · deliverables · underlying command.

### Plan
- **ATLAS** → *strategist* · "what should we build / what's weak?" · epic proposals, codebase audits,
  roadmap waves · `/athena:plan`
- **SAGE** → *best-practice* · "which approach / is this the right architecture?" · architecture
  decision, trade-off memo · (architecture Q&A — no slash command)

### Build
- **PENNY** → *spec-writer* · "design this feature/endpoint" · spec doc + acceptance criteria · `/athena:spec`
- **VERA** → *designer* · "make this page/UI" · TSX + CSS + smoke test from design tokens · `/athena:design`
- **DOC** → *debugger* · errors, failing tests (often auto-delegated) · root-cause + patch · (auto)

### Guard
- **ARGUS** → *reviewer* · "review this / security check" · code-review report + security findings · `/athena:qa --review-only`
- **QUINN** → *qa* · "run the tests / coverage gate" · test run + 80% coverage report · `/athena:qa --test-only`
- **JUDE** → *evaluator* · "did we actually meet the spec?" · independent acceptance verdict · `/athena:qa --eval-only`

### Ship
- **PORTER** → *deployer* · "ship it" · 7-gate Zeabur source-build deploy + CI green / deploy health · `/athena:deploy`

### Data
- **DELTA** → *dba* · "schema change / migration / DB forensics" · migration review, schema design · `/athena:dba`

### Brain
- **REMI** → *memory-curator* · "capture what we learned" · promoted Tier-0 lessons, curated brain · `/athena:promote`

### Field command
- **MAX** → *orchestrator* · big multi-epic batches TONY delegates · parallel dependency-wave dispatch · `/athena:batch`

## Naming & implementation note (why this is safe)

- **Persona over a stable id.** The agent files keep their technical `name:` (`reviewer`, `qa`, …)
  so every `/athena:*` command and Claude's auto-delegation keep working. The human name is a
  persona *layer* (in the agent's prompt + this chart + TONY's routing table). "Ask Argus to review"
  → TONY spawns the `reviewer` agent.
- **Rich descriptions.** Human names alone degrade description-based auto-routing, so each persona's
  agent `description` leads with its function + trigger keywords.
