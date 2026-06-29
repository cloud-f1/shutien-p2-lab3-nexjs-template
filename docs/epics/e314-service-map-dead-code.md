# E314 — Service-Map + Dead-Code Detection

> Phase 73 · toolchain · architecture
> Status: ⬜ pending

## Problem

Whiteboard architecture diagrams drift from the code. This template's `docs/architecture/` folder exists but has no code-derived maps. When reviewing or refactoring a service, there is no mechanical way to answer "what imports this module?" or "is this service actually wired in?". The `ai-rc-engineer-pm` downstream project built `scripts/service-map.cjs` to generate provable import-graph maps — and used it to surface a billing phantom service (nothing imported it) and a dead `engineering-utils` duplicate. These tools belong in the template as canonical tooling.

## Solution

1. **`scripts/service-map.cjs`** — import-graph parser. Given one or more module-name seed substrings (e.g. `billing`, `auth`, `notifications`), scans `next-app/{lib,actions,app,components}` for `.ts`/`.tsx` files, parses `import … from` / `import()` calls, resolves `@/` alias and relative paths, and emits: a Mermaid graph, an edge table (module · kind · imports · imported by), stats (module count, external deps), and orphan/phantom flags.
2. **`scripts/check-orphan-exports.mjs`** — scans all `lib/` and `actions/` exports to find symbols that are exported but never imported anywhere in `next-app/`. Reports a list of orphan exports (dead code candidates).
3. **`service-map` skill** (`SKILL.md`) — explains how to run the tool, read the output (phantom vs orphan vs entry-point), turn output into a committed `docs/architecture/<service>-map.md` artifact, and what caveats apply (doesn't follow re-exports beyond one hop, doesn't see skills/scripts).
4. **`docs/architecture/README.md`** (or index entry in `docs/README.md`) — brief note on what goes in `docs/architecture/`: code-derived maps + design docs; how to regenerate a map.

## Key Files

- `scripts/service-map.cjs` (NEW) — import-graph parser (CJS, Node.js stdlib only)
- `scripts/check-orphan-exports.mjs` (NEW) — orphan export detector (ESM)
- `.claude/skills/service-map/SKILL.md` (NEW) — usage + interpretation
- `docs/architecture/README.md` (NEW or update) — what belongs here + regeneration instructions
- `Makefile` — add `service-map` and `check-orphans` targets

## Implementation

### Phase 1 — Port scripts
- Port `scripts/service-map.cjs` from rc-engineer-pm. Adapt scan roots: `next-app/{lib,actions,app,components}` (same as rc). Remove RC-domain-specific comments (rc-schedule, 燈號 etc.) from inline help text; use generic examples (`billing`, `auth`, `items`).
- Port `scripts/check-orphan-exports.mjs` from rc-engineer-pm. Adapt to template's module layout.

### Phase 2 — Skill + docs
- Create `.claude/skills/service-map/SKILL.md`. Port from rc-engineer-pm; strip rc-specific examples (replace `rc-schedule notifications-scan` with `billing auth items`); strip the "residue from the payments phantom" story (replace with generic example). Keep: how to read phantom vs orphan vs entry-point, artifact structure, caveats.
- Create or update `docs/architecture/README.md`: one-para note on purpose (code-derived maps, not whiteboard), how to run `node scripts/service-map.cjs <seed>`, how to write the artifact, link to `scripts/service-map.cjs`.

### Phase 3 — Makefile + initial map
- Add Makefile targets:
  ```makefile
  service-map:   ## Generate a service map: make service-map SEED=billing
    node scripts/service-map.cjs $(SEED)
  check-orphans: ## Find exported but never-imported symbols
    node scripts/check-orphan-exports.mjs
  ```
- Run `node scripts/service-map.cjs billing` and `node scripts/service-map.cjs auth` to generate an initial `docs/architecture/auth-service-map.md` as a committed example.

## Acceptance Criteria

- [ ] `node scripts/service-map.cjs billing` runs without error; produces Mermaid + edge table + orphan/phantom flags
- [ ] `node scripts/service-map.cjs auth` produces the auth service map
- [ ] `node scripts/check-orphan-exports.mjs` runs without error and reports (or confirms zero) orphan exports
- [ ] `.claude/skills/service-map/SKILL.md` exists; no rc-specific content
- [ ] `docs/architecture/auth-service-map.md` committed as a working example
- [ ] `make service-map SEED=auth` and `make check-orphans` work
- [ ] `pnpm typecheck && pnpm lint` clean

## Cross-Epic

- E313 — `docs/architecture/` indexed in `docs/README.md`

## Out of Scope

- TypeScript full resolver (re-export chain tracing) — the regex parser is accurate enough for this codebase
- Coverage of `scripts/` or `.claude/` — those aren't `next-app/` imports
- Automatic CI gate on orphan count (a future epic if needed)
