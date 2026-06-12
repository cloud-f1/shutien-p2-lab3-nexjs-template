# E210 — Deploy/Launch Skill Consolidation + Fork-Safety Gating

> Phase 50 — Operationalize the Dial | Size: M (10 SP) | Deps: none

## Problem

Two auto-loaded skills overlap and both leak owner-specific deployment SOP into forks. `.claude/skills/deploy-gcr-zeabur.md` (~13KB) and `.claude/skills/launch-checklist.md` (~9.8KB) both answer "is this ready to deploy / launch," with duplicated readiness criteria across them. Worse, both encode **this repo's** owner-specific Google Cloud Run + Zeabur procedure — concrete project names, service layouts, and platform steps — as if it were generic guidance. A Track B fork user (who, per CLAUDE.md's "Fork 後客製化提示", is expected to clone and customize) inherits these as auto-injected context and is steered toward the original owner's deploy stack rather than their own.

This is the same skill-drift / fork-safety failure class Cycle 21 fixed for the *pattern-teaching* skills (E194 purged deleted patterns; E195 added the design-system skill; E202/E203 added fork-safety to the plugin). The deploy/launch skills were explicitly named in Cycle 21's "Deferred (not scheduled)" list. This epic closes that tail.

## Solution

Merge the two skills into one deploy-readiness skill with a **fork-safety gate**: owner-specific GCR/Zeabur SOP becomes opt-in / clearly-labelled, and the default content is generic deploy-readiness guidance that no-ops the owner-specific steps when the repo identity is not the original.

1. **Consolidate** — merge `deploy-gcr-zeabur.md` + `launch-checklist.md` into one `.claude/skills/deploy-readiness.md`. Take the *union* of both checklists (lose no real readiness criterion), dedupe the overlap.
2. **Fork-safety gate** — split the content into two clearly-labelled tiers:
   - **Generic** (always applies): pre-deploy gates that hold for any fork — secrets-not-placeholder, migrations-current, coverage gate, env-var presence, build-green.
   - **Owner-specific** (labelled, conditional): the concrete GCR project / Zeabur service SOP, fenced under an explicit "**This repo's deploy stack (customize for your fork)**" heading with a note: "If you forked this template, replace this section with your own platform's steps — these are the original author's and will not apply to your deployment."
3. **Retire the originals** — replace `deploy-gcr-zeabur.md` and `launch-checklist.md` with tombstone stubs pointing to `deploy-readiness.md` (do not delete — preserve git history + redirect, same pattern as E195's `page.css.tmpl` tombstone). Or delete and rely on the consolidated skill if the skill harness tolerates removal; tombstone is safer for any cross-reference.
4. **Cross-reference cleanup** — grep for references to the two old skill names across `.claude/`, `docs/`, CLAUDE.md, and the deploy command (`/athena:deploy`); repoint to `deploy-readiness.md`.

## Key Files

| File | Action |
|---|---|
| `.claude/skills/deploy-readiness.md` | New — consolidated skill: generic gates + labelled owner-specific section + fork-safety note |
| `.claude/skills/deploy-gcr-zeabur.md` | Retire — tombstone stub → `deploy-readiness.md` |
| `.claude/skills/launch-checklist.md` | Retire — tombstone stub → `deploy-readiness.md` |
| `.claude/commands/athena/deploy.md` | Edit — repoint any skill reference to `deploy-readiness.md` |
| `CLAUDE.md` | Edit — update skills count if enumerated (12 → reflects net skill-file change) |

## Implementation

1. Read both skills in full; build a union checklist (every distinct readiness criterion from each), marking which are generic vs owner-specific (GCR/Zeabur concrete steps).
2. Write `deploy-readiness.md` with YAML frontmatter (trigger phrases: "deploy", "launch", "is it ready to ship", "pre-deploy", "release readiness"). Body: Generic Gates section first (fork-safe), then a clearly-fenced "This repo's deploy stack (customize for your fork)" section with the GCR/Zeabur SOP + the replace-this note.
3. Tombstone the two originals (2–5 line redirect comment each); do not delete.
4. Grep + repoint references: `grep -rn "deploy-gcr-zeabur\|launch-checklist" .claude/ docs/ CLAUDE.md` → update each hit to `deploy-readiness`.
5. Update CLAUDE.md skills count if it enumerates skills (net: 2 retired → 1 new, so count adjusts accordingly; tombstones still exist as files — decide whether the count reflects active or on-disk skills and state it).
6. Smoke: confirm `deploy-readiness.md` is in `.claude/skills/` (auto-loaded), the trigger phrases are present, and a `grep` for the old names returns only tombstone redirects.

## Acceptance Criteria

- [ ] `.claude/skills/deploy-readiness.md` exists and contains the **union** of both originals' readiness criteria (no criterion lost), with the overlap deduped
- [ ] The skill has two clearly-labelled tiers: a fork-safe Generic Gates section and a fenced owner-specific "This repo's deploy stack (customize for your fork)" section with an explicit replace-for-your-fork note
- [ ] `deploy-gcr-zeabur.md` and `launch-checklist.md` are tombstone stubs redirecting to `deploy-readiness.md` (not silently deleted; git history preserved)
- [ ] No active reference to the two old skill names remains in `.claude/commands/`, `docs/`, or CLAUDE.md (grep returns only tombstone redirects) — `/athena:deploy` points at `deploy-readiness.md`
- [ ] `deploy-readiness.md` has YAML frontmatter with trigger phrases and is auto-loadable from `.claude/skills/`
- [ ] CLAUDE.md skills count is updated to reflect the consolidation (active-skill count stated unambiguously)
- [ ] A fork reading the injected skill sees generic gates as authoritative and the GCR/Zeabur steps as clearly-labelled owner-specific (manual smoke read)

## Alignment / Cross-Epic Hooks

- **Same class as Cycle 21 E194/E195** — skill-truth + fork-safety; closes the deploy/launch tail Cycle 21 deferred.
- **Relates to E202/E203 fork-safety** — extends the "don't leak owner-specifics into forks" principle from the plugin layer to the deploy-skill layer.
- **Independent epic** — no deps; ships in the Phase 50 parallel wave.
- **Reuses the tombstone pattern** — same git-history-preserving redirect E195 used for `page.css.tmpl`.

## Out of Scope

- Changing the actual deploy *mechanism* (`/athena:deploy` 7-gate protocol, Zeabur config) — this epic consolidates the *guidance skills*, not the deploy command's behavior.
- Building a fork-customization wizard for deploy config — generic guidance + labelled owner section is sufficient for v1.
- Adding new target platforms (AWS/Fly/Render) to the generic section — document the pattern, not every platform.
- Touching `zbpack.json` / Cloud Run config files — skill-content only.

## Provenance

- Spec source: `/athena:plan auto` Cycle 22 (2026-06-02) — promoted from Cycle 21's "Deferred (not scheduled)" deploy/launch consolidation item to fill the 5th slot; fork-safety judged a genuine template-quality bug, not gold-plating.
- Approved via `/athena:plan approve E206,E207,E208,E209,E210` on 2026-06-02 (Cycle 22).
