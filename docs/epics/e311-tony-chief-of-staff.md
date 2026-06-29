# E311 — TONY Chief-of-Staff Layer

> Phase 73 · DX · agent-team
> Status: ⬜ pending

## Problem

The template has 13 agents and 25+ `/athena:*` commands. New users and fork teams face a steep learning curve: they must memorize which command maps to which agent, what each agent is responsible for, and how to sequence multi-step goals. The `ai-rc-engineer-pm` downstream project introduced a "TONY" Chief-of-Staff layer (persona + routing playbook) that dramatically simplifies this. The template should have it as the canonical upstream.

## Solution

Port and generalize the `chief-of-staff` skill from `ai-rc-engineer-pm`:

1. **`chief-of-staff` skill** — TONY routing playbook mapping plain-language goals → agent/command. Defines 13 agent personas (TONY/ATLAS/SAGE/PENNY/VERA/DOC/ARGUS/QUINN/JUDE/PORTER/DELTA/REMI/MAX) as a display layer over stable `name:` agent IDs. Covers: intent → teammate table, multi-step sequencing, reporting format, routing rules.
2. **`docs/reference/agent-org-chart.md`** — structured org-chart table: persona · agent id · dept · deliverable · command. The authoritative roster reference TONY reads.
3. **`docs/reference/agent-team.html`** — visual team card grid (self-contained HTML; no build step). Generated from the org-chart data for at-a-glance reference.
4. **`docs/reference/README.md`** — full project readiness index ("how this project works"): product one-liner, agent team table, skills, commands, memory, deploy/ops readiness, how to pick up work. Port from rc-engineer-pm; strip rc-specific content; make template-generic.
5. **CLAUDE.md update** — mention TONY in the Agent Team section.

## Key Files

- `.claude/skills/chief-of-staff/SKILL.md` (NEW) — routing playbook
- `docs/reference/agent-org-chart.md` (NEW) — persona ↔ agent-id roster
- `docs/reference/agent-team.html` (NEW) — visual card grid
- `docs/reference/README.md` (NEW) — readiness index
- `CLAUDE.md` — agent team section update

## Implementation

### Phase 1 — Skill + org-chart
- Port `chief-of-staff/SKILL.md` from rc-engineer-pm; remove rc-specific PORTER/deploy caveat (prebuilt-image — not applicable to template's standard source-build). Remove the "marketing team rejected" paragraph (rc-specific).
- Adapt intent→teammate table to template's generic domain (items, not engineering cases).
- Create `docs/reference/agent-org-chart.md` with the 13-row persona table (persona · agent-id · dept · does · command).

### Phase 2 — Visual + readiness index
- Create `docs/reference/agent-team.html` — 13 agent cards, persona name + role, color-coded by dept (Plan/Build/Guard/Ship/Data/Brain/Field). Self-contained, no build step.
- Create `docs/reference/README.md` — port from rc-engineer-pm, strip rc-specific (PMS product one-liner → template one-liner, RC credentials → template demo logins, rc-specific deploy caveats → standard source-build). Sections: product, agent team, skills, commands, memory, deploy readiness, how to pick up work.

### Phase 3 — Wire-in
- Update `CLAUDE.md` § "Agent Team (12 agents)" → rename to "Agent Team — TONY + 12 specialists" and add a one-line note pointing to `chief-of-staff` skill.
- Update `docs/reference/skills.md` with the new `chief-of-staff` entry.

## Acceptance Criteria

- [ ] `.claude/skills/chief-of-staff/SKILL.md` exists; routing table covers all 13 agents; no rc-specific content
- [ ] `docs/reference/agent-org-chart.md` lists all 13 personas with correct agent-id and command
- [ ] `docs/reference/agent-team.html` renders visually in a browser with all 13 cards
- [ ] `docs/reference/README.md` exists as a generic readiness index (no rc-specific content)
- [ ] CLAUDE.md updated to mention TONY and `chief-of-staff` skill
- [ ] `pnpm typecheck && pnpm lint` clean (no app changes, so trivially true)

## Cross-Epic

- E313 (docs reorg) — `docs/reference/README.md` is indexed there
- E312 (new-project) — TONY's routing playbook references the `new-project` skill

## Out of Scope

- Changing agent IDs or YAML frontmatter — persona names are a display layer only
- Adding new agents (12 → 13 is a TONY-only addition; no new `.claude/agents/` files)
- Marketing/biz-ops personas (rejected in rc-engineer-pm for good reason)
