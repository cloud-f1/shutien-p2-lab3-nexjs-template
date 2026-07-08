# E319 — Orchestration & Guardrail Hardening

> Phase 75 · toolchain · backport-wave-2
> Status: ⬜ pending
> Source: `../ai-rc-engineer-pm` (downstream 瑞成 PMS), fork commits on `flow.md`, `audit.md`, `stop-verifier.sh`

## Problem

The template's parallel-only orchestration model + name-matching guardrails have three gaps the downstream fork hit and fixed:

1. **No sequential-chain escape hatch.** `/athena:flow` + `/athena:batch` always try worktree-parallel dispatch. When epics are *coupled* (a dependency chain, ≥2 DB migrations that would collide on numbering, or a foundational epic other epics build on), parallel worktrees produce colliding migration numbers and un-buildable downstream branches. The template has no documented "run this wave as one sequential in-repo chain" mode.
2. **Audit misses knowledge drift.** `/athena:audit` checks schema↔Zod↔UI drift but not (a) **doc↔code constant drift** (hard numbers/enums restated in prose that silently diverge from their canonical code source) or (b) **post-rebrand brand/identity staleness** (old repo slug / product name / docs domain surviving in identity files — a grep for the *new* name never finds them). This exact class let E314's state say "service-map tools MERGED" while only a markdown map shipped.
3. **stop-verifier false-positives on legit public endpoints + renamed guards.** The RBAC Rule (mutating Server Action must have a guard) has no exemption for genuine pre-auth endpoints (login / password-reset) and silently false-positives whenever an RBAC convention is renamed.

## Solution

Backport three surgical improvements (agent-tooling only, no product code):

1. **`flow.md` Step 6 — Sequential In-Repo Chain Mode.** Add a documented mode: when a wave is coupled (dependency chain, ≥2 migrations, or a worktree-unsafe foundational epic), dispatch a single sequential chain on ONE branch with **no worktree isolation**, stop-on-failure, scoped `git add`, and a post-chain integrated gate. Port from the fork's `flow.md` Step 6.
2. **`audit.md` Step 6 — Knowledge drift.** Add (6a) doc↔code constant drift (find hard numbers/enums restated in prose vs their canonical code source) and (6b) brand/identity staleness (grep identity files for the *old* slug/name/domain that a rebrand should have replaced). Port the *framework*; adapt examples to the template.
3. **stop-verifier `// stop-verifier:public-action` exemption marker** + widen guard-family recognition + add the hooks-CLAUDE.md "re-sync verifier patterns on convention-rename" lesson (name-based rules silently false-positive when a convention is renamed; editing a completion gate needs explicit user sign-off + a fixture test).

Plus **2 Tier-0 memory notes** (via `/athena:promote` or direct write):
- Dependency-rules **duplicate-block gotcha** — `epic-graph.sh --phase N` reads the Dependency Rules block in `epic-progress.md`; forgetting to register there (in addition to EPIC_INDEX) yields an empty wave graph. Extends the existing "Phase Status table registration" memory.
- **Guardrail-widening discipline** — every stop-verifier rule change ships with a regression fixture + explicit user sign-off (it gates the agent's own completion).

## Key Files

- `.claude/commands/athena/flow.md` — add Step 6 (sequential in-repo chain mode)
- `.claude/commands/athena/audit.md` — add Step 6 (knowledge drift: doc↔code + brand staleness)
- `scripts/hooks/stop-verifier.sh` — add `// stop-verifier:public-action` marker + guard-family recognition
- `scripts/hooks/tests/test-rule-nextjs-invariants.sh` — add fixtures for the marker + guard patterns
- `scripts/hooks/CLAUDE.md` — add "re-sync verifier on convention-rename" lesson
- Tier-0 memory (`~/.claude/template-memory/`) — 2 notes above

Reference (fork, read-only): `../ai-rc-engineer-pm/.claude/commands/athena/{flow,audit}.md`, `../ai-rc-engineer-pm/scripts/hooks/stop-verifier.sh`

## Implementation

### Phase 1 — flow.md Step 6
- Port the fork's Step 6 prose; keep triggers domain-agnostic (dependency chain / ≥2 migrations / foundational epic). Cross-reference `/athena:batch`.

### Phase 2 — audit.md Step 6
- Port the 6a/6b framework. For 6b, generalize the identity-file list (README, CLAUDE.md, package.json, docs config) and drive it off the template's product-name source rather than a hardcoded `瑞成`/`rc` string.

### Phase 3 — stop-verifier
- Add the `// stop-verifier:public-action` skip marker recognized by the RBAC rule.
- Widen guard recognition to a family (don't hardcode one helper name).
- Add fixtures in `test-rule-nextjs-invariants.sh` (one public-action pass case, one guard-family pass case, one un-guarded fail case).
- Append the lesson to `scripts/hooks/CLAUDE.md`.

### Phase 4 — memory notes
- Write the 2 Tier-0 notes; link `[[epic-phase-status-table-registration]]`.

## Acceptance Criteria

- [ ] `flow.md` documents a Sequential In-Repo Chain Mode with clear trigger conditions
- [ ] `audit.md` documents doc↔code drift + brand/identity staleness checks, generalized (no `瑞成`/`rc` literals)
- [ ] `stop-verifier.sh` honors `// stop-verifier:public-action`; fixtures pass (`bash scripts/hooks/tests/test-rule-nextjs-invariants.sh`)
- [ ] `scripts/hooks/CLAUDE.md` has the convention-rename lesson
- [ ] 2 Tier-0 memory notes written
- [ ] No product-specific (瑞成 / rc-permissions / defineAction) literals leak into shared tooling

## Cross-Epic

- E320 (service-map orphan tool) — the doc↔code drift check + orphan tool are complementary dead-signal detectors
- E322 (CI hardening) — `make verify` should run the stop-verifier fixtures

## Out of Scope

- The fork's product-specific RBAC guard names (`requireRole`/`can(role,flag)`/`defineAction` recognition) — defineAction recognition lands with E323 when the factory itself is backported
- Agent-codename cosmetic convention (TONY/ATLAS/etc.) — cosmetic, defer
