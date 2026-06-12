# QA Patterns — Recurring Findings

> **Owner**: @qa (appends) + @spec-writer (reads)
> **Purpose**: Break the repeat-finding cycle — specs address known issues upfront.

## Checklist — Spec Must Address

### TypeScript / Zod
- [ ] `satisfies z.ZodType<ApiType>` on every new Zod schema
- [ ] Explicit return types on exported functions

### CSS / Layout
- [ ] DashboardLayout comment block preserved when adding views
- [ ] New CSS selectors use design-system tokens (never raw hex)

### Accessibility (WCAG 2.1 AA)
- [ ] All interactive elements: keyboard handler + ARIA attrs
- [ ] Images / icon-only buttons: `aria-label` or `aria-hidden`
- [ ] New pages: skip-nav target, landmark roles

### Testing
- [ ] MSW handler for every new endpoint
- [ ] `userEvent` (not `fireEvent`) in all client tests
- [ ] Coverage >= 80% per module

## Log — Findings Added by @qa

<!-- @qa appends entries here. Pre-E156 batch learnings are condensed below; every [GENERALIZABLE] lesson lives in ~/.claude/template-memory/ (Tier 0), full detail in git history. Compressed 2026-06-04 to hold the ~200-line budget. -->

### Archived Batch Learnings (E57–E111, Mar–Apr 2026) — promoted to Tier 0

- **Migrations/DB**: two-layer UUID (TypeDecorator `GUID` + `sa.Uuid()`); test migrations on PostgreSQL (SQLite masks schema bugs); migration linter as a 0.02s pytest. (E62/E63/E65)
- **Integrations**: provider/strategy + factory-singleton for swappable email/SMS/storage; zero-domain core must build+test; cascade config through env/deploy/compose in dependency order. (E66–E70)
- **Template hygiene**: post-clone reset script (safety-guarded, idempotent); separate framework from examples + an installer to add them back. (E69–E71)
- **Observability/orchestration**: hook-only webhook + JSONL audit (zero app code, env-gated); dependency graph as a standalone script (Kahn → waves); orchestrator agent that CANNOT write code; stop-verifier as append-only rule blocks. (E82–E86)
- **Prod-readiness**: superuser admin endpoints (`current_superuser`); fail-fast `validate_production_config()` in lifespan; `make verify` / `doctor-production` two-tier gates; SHA-pin all GitHub Actions. (E61/E104–E106)
- **Docker**: dev/prod compose split (source mounts vs built images); named volumes for `node_modules`; `${VAR:-default}` for prod env; Make targets as thin compose wrappers. (E107–E111)
- **Docs**: bilingual EN+ZH-TW three-file pattern (guide + README + CLAUDE.md); periodic context-doc hygiene sweeps (drift caught: 28→259 tests). (E86/E102)

### Schemathesis Conformance Pattern (E156) — active enforcement

- [GENERALIZABLE] In-process spec↔server conformance: `schemathesis.openapi.from_asgi("/openapi.json", app)` in a pytest fixture + `@schema.parametrize()` over every op (no network; fuzzes bodies/queries via hypothesis). Complements curated contract tests — catches drift they don't target.
- [GENERALIZABLE] `xfail` list, not spec freeze: keep `KNOWN_DRIFT_OPS` at module top, `pytest.xfail()` each offender, treat the set as a KPI to shrink. Never disable the check.
- [GENERALIZABLE] Exclude framework-level checks (e.g. `unsupported_method` expecting a 405 `Allow` header on stock Starlette) via `excluded_checks=` so the signal stays on the contract you own.
- **Enforcement**: runs as `@qa` Phase 2.5 (blocks Phase 3 coverage on fail, no `--skip-contract`); Stop-verifier Rule #20 (openapi.yaml changed ⇒ green `qa_contract` audit event required); `pre-deploy-guard.sh` Gate 7 re-runs as defense-in-depth.
- _Initial landing: 16/23 ops flagged for under-declared 4xx (auth endpoints returning undocumented 400/401/403/422). Tracked in `KNOWN_DRIFT_OPS`; fix = add the missing 4xx to `docs/openapi.yaml` reusing `ErrorResponse`, then drop the op — Phase-40 cleanup follow-up._

### Iterative Review Convergence Pattern (E162) — active

- [GENERALIZABLE] Loop the same reviewer on the same artifact up to N rounds (`scripts/reviewer-loop.sh`): CONVERGED (0 open `- [ ]`) / STUCK (round-body sha256 identical) / MAX_REACHED (≥ `MAX_ITERATIONS`) / BUDGET (≥ `REVIEW_LOOP_BUDGET`, **informational only**). Single-pass review misses regressions the fix itself introduces.
- [GENERALIZABLE] Idempotent reviewer (one call = one appended `## Round N`) + debugger "round mode" (fix ONLY current-round items, no opportunistic refactors — scope creep defeats convergence).
- [GENERALIZABLE] Stuck detection via content hash, not item count (count can hold at 1 while the finding changes = progress, not stuck).
- **Enforcement**: `/athena:qa --review-only` drives the loop; plain `/athena:qa` Phase 1 single-passes; STUCK (exit 2) surfaces a ⚠️ block; the `review_loop` audit event feeds the E164 autopilot confidence scorer.

### Phase 45 — Memory Pipeline + Batch Hardening (E180–E186, PRs #155–#167) — promoted to Tier 0

- [GENERALIZABLE] **Two-layer worktree-isolation probe**: shell `git worktree add` working ≠ the Agent-tool wrapper honoring isolation (it can silently degrade → agents land in the main worktree and intermingle files). Probe BOTH (shell smoke + a read-only Agent reporting `worktreePath`); on failure silently auto-fallback to `--max-concurrent 1` (no abort, no manual override). (PR #161)
- [GENERALIZABLE] **Inline orchestrator steps don't fire TaskCompleted hooks** — call `task-completed.sh` explicitly in inline commit/merge blocks, gated by `NOTIFY_LEVEL=boundaries`, or every webhook silently misses real epic boundaries. (PR #155/#159)
- [GENERALIZABLE] **`gh pr merge --auto` "not possible to fast-forward" is cosmetic** — the server-side squash already succeeded; it's gh's LOCAL post-merge sync failing on a divergent local main. Verify `gh pr view <n> --json state,mergedAt`; don't retry. (PR #159) — _re-confirmed this session during the E216 merge._
- [GENERALIZABLE] **SHA256-snapshot a "read-only" target dir** before/after a test suite (`shasum -a 256` of `~/.claude/` etc.) to catch a forgotten `mv`/`>`; pair with `mktemp -d` fixtures + env-var path injection. (PR #165/#166)

### Memory Retrieval During Design (E189)

`@strategist` reads Tier 0 at the start of every `/athena:plan brainstorm` via `scripts/memory/brainstorm-retrieve.sh <keywords>` (scores with `match.sh`, returns top-5, emits `tier0_loaded`); matched lessons get a `+0.15` reinforce; `evergreen: true` skips the 0.4 min-strength filter.

### Brainstorm-First Planning (E187, Phase 46)

`/athena:plan brainstorm "idea"` runs `@strategist` in dialogue (≤7 Qs, 2–3 approaches, section-by-section review) → JSON spec → `brainstorm-emit.sh` appends to strategy-log; `approve E{n}` renders the epic file with Implementation Phases / Per-Phase Checkpoints / Test Strategy. Additive — epics without these sections still validate.

## Batch Learning — 2026-05-19 (E188–E192)

### Architecture
- [GENERALIZABLE] Audit event as verification evidence: `verification_check {check, exit, agent, epic}` event in `.claude/audit.jsonl` — agents emit BEFORE claiming done; stop-verifier gate checks recency (10-min window). Prevents completion theater without running tests. (E188)
- [GENERALIZABLE] Pilot-mode env var for new stop-verifier rules: gate behind `STOP_RULE_23_ENABLED=1` for 5+ days, flip default-on only after fixture-replay against 50+ historical commits shows zero false positives. Avoids false-positive lockout while measuring rule quality. (E188)
- [GENERALIZABLE] Jaccard+cosine hybrid for semantic similarity: `0.5×tag_jaccard + 0.5×cosine_body` for pairwise lesson overlap; union-find clustering for transitivity. Handles both exact-vocab match (Jaccard) and content drift (cosine). (E190)
- Evergreen bypass on min-strength filter: lessons with `evergreen: true` in frontmatter always pass retrieval regardless of decay score — prevents permanently relevant patterns from being filtered out by Ebbinghaus decay. (E189)
- Read-only corpus hygiene: exclude meta-files (README.md, CLAUDE.md, NEW_PROJECT_PRIMER.md, `*archive*`) before running similarity analysis — prevents meta-documents from matching as near-duplicates of content files. (E190)

### DX
- [GENERALIZABLE] Brainstorm-first as fallback-preserving default: new default is dialogue-driven; old audit-driven mode preserved as explicit fallback. No features removed — just priority reordered. Reduces "what do we build?" ambiguity without deleting the escape hatch. (E191)
- [GENERALIZABLE] Promotion proposal as knowledge artifact: `docs/context/promotion-proposals/YYYYMMDD-name.md` documents rationale, evidence, and "promote when" criteria — seeds future `/athena:promote` with the human review gate already written. (E191)
- Per-session dedup via `/tmp/brainstorm-session-$$-<name>` sentinels: prevents over-reinforcement of Tier 0 strength when the same retrieval script is called multiple times in one dialogue session. (E189)

### Documentation
- [GENERALIZABLE] Parallel line-count parity for bilingual docs: EN and zh-TW guides should mirror each other section-by-section (same section count, same worked example). Line count equality is a completeness proxy — large divergence signals a coverage gap in one language. (E192)
- zh-TW QA vocabulary gate: verify presence of Traditional Chinese markers (腦力激盪/驗收標準/豐富化) AND scan for Simplified-only characters (发/响/时/长) as a QA pre-merge check. Prevents accidental Simplified content in 繁體中文 guides. (E192)

## Batch Learning — 2026-06-04 (E216)

> Scope note: this batch covers **E216 only** (E211–E215, Phase 51, were not extracted). This file was compressed on 2026-06-04 — pre-E156 batch learnings condensed into the archive block above; all `[GENERALIZABLE]` lessons live in Tier 0.

### Architecture
- [GENERALIZABLE] Native Workflow engine `isolation:'worktree'` is **per-AGENT, not per-task**: a multi-stage pipeline that must share one working tree needs ONE fused worktree-isolated agent, not separate stage-agents (separate agents strand later stages in the main repo, blind to earlier changes). Cost: stage-gating moves from engine-enforced to in-prompt. (E216)
- [GENERALIZABLE] Verify a tool's **mechanism, not its label**: athena's `batch.md` "WORKFLOW-NATIVE" posture is `claude -p --output-format json --json-schema` subprocess IPC — NOT the harness `Workflow` tool (which appears nowhere in the repo, and isn't in `batch.md` allowed-tools). A confident name-collision can misframe an entire design. (E216)

### Testing
- [GENERALIZABLE] grep-based static fixture tests **false-positive on prose** that names the banned pattern (e.g. a `# never claude -p` comment, or a banned code form written in a comment). Make the assertion negation/context-aware, or keep the banned literal out of prose. Hit twice in one session. (E216)

### DX
- [GENERALIZABLE] **Adversarially validate the BUILT artifact, not just the design.** 2 of E216's 3 real bugs originated in a fluent synthesis-agent design (silent wave truncation; cross-agent worktree stranding) and survived the build green — a second skeptic pass over the as-built code caught them. Confidence ≠ correctness. (E216)
- Concurrency caps limit **parallelism via chunked batches** (`slice(i, i+CAP)`), never truncate the work list (`slice(0, CAP)`) — silent truncation violates no-silent-caps (E199). (E216)
