# E213 — First Slice of athena-saas-profile — Registry Mechanism + Install Safety Gate

> Phase 51 — Stabilize + Phase 2 Foundation | Size: M (13 SP) | Deps: none

## Problem

Phase 2 of the Athena plugin split is **fully designed but has zero foundation**. The 364-line design (`docs/superpowers/specs/2026-05-20-athena-saas-profile-design.md`) specifies a registry-composition model where a `athena-saas-profile` plugin self-registers to `~/.claude/athena-profile-registry.json` and `athena-core`'s stop-verifier reads it at runtime to discover and run profile stop-rules.

The **consuming half already shipped** in `athena-core` v0.2.1 (verified — `../athena-core/.claude-plugin/plugin.json` reports `"version": "0.2.1"`). The registry-read loop is live in `../athena-core/scripts/hooks/stop-verifier.sh:39-66`: it reads `${ATHENA_PROFILE_REGISTRY_PATH:-${HOME}/.claude/athena-profile-registry.json}`, iterates `.profiles[]`, and for each entry executes `${root}/scripts/stop-rules/*.sh` with blocking exit-2 semantics (`stop-verifier.sh:48-64`). The contract is pinned by tests in `../athena-core/tests/test-profile-registry.sh:33-105` — three cases: registry absent → exit 0 (no-op), profile rule passes → exit 0, profile rule blocks → exit 2.

But the **producing half does not exist**: `ls ../athena-saas-profile` returns nothing, and `~/.claude/athena-profile-registry.json` is not on disk. No plugin writes the registry, so core's registry-read loop has nothing to discover. Every downstream Phase 2 slice (the 6 commands, 7 skills, 13 stop-rules, ~10 templates, 5 seed lessons enumerated in the design §4) depends on this registry + install-gate foundation existing first.

**Critical ground-truth correction the implementer MUST honor:** the design doc's draft registry schema in §3.2 (`.installed[]` with `plugin_root` / `extensionPoints` / `id` / `version` / `installed_at`) is **superseded** by what `athena-core` v0.2.1 actually reads. The shipped core consumer reads the top-level key `.profiles[]` and only two fields per entry — `.name` and `.root` (`stop-verifier.sh:48-51`). The foundation in this epic must emit the **shipped** contract (`.profiles[].root`), not the design's draft, or core will silently discover zero rules.

## Solution

Build the first installable slice of `athena-saas-profile`: a self-registering `install.sh` that writes the registry in the exact shape core v0.2.1 consumes, plus an install-time safety gate that refuses to register a malformed/unsafe profile. No commands/skills/templates yet — just the foundation the rest of Phase 2 plugs into.

1. **Scaffold the new repo** at `../athena-saas-profile` (sibling to `../athena-core`) with the minimal plugin skeleton: `.claude-plugin/plugin.json` (id `saas`, depends-on `athena-core >= 0.2.1`), `package.json`, `scripts/install.sh`, an empty-but-real `scripts/stop-rules/` dir, and `README.md` + `INSTALL.md`.
2. **Registry writer** — `install.sh` appends/replaces this profile's entry in `~/.claude/athena-profile-registry.json` using the **shipped** schema: top-level `.profiles[]`, each entry `{ "name": "athena-saas-profile", "root": "<plugin root abs path>" }`. Idempotent: re-install replaces its own entry by `name`, never duplicates. **Multi-profile safe:** upsert touches only the entry whose `.name` matches — every *other* profile's entry is preserved byte-for-byte (the registry is shared across all profiles; a profile install that drops siblings would silently break their stop-rules). On a pre-existing **malformed** registry, fail closed (do not clobber a file that might be another profile's data mid-write).
3. **Install safety gate** — before writing the registry, `install.sh` MUST fail-closed on: (a) `athena-core` not installed (`~/.claude/athena-memory/.installed` absent — same precondition the design §5.1 specifies); (b) any `.tmpl` file found under Claude-Code-scanned dirs (`agents/`, `skills/`, `commands/`, `hooks/`) — the design §5.1 step-4 templates-safety assertion; (c) `jq` unavailable (registry edits need it). Each failure exits non-zero with a remediation message; nothing is written.
4. **Round-trip proof against the real core consumer** — a test points `$ATHENA_PROFILE_REGISTRY_PATH` at a temp file, runs this profile's `install.sh`, drops a deliberately-blocking rule into `scripts/stop-rules/`, then invokes `../athena-core/scripts/hooks/stop-verifier.sh` and asserts exit 2 with the profile rule name in the failure list — proving the registry we write is the registry core reads.
5. **Version-sync hygiene** — mirror core's discipline: keep `package.json` + `.claude-plugin/plugin.json` version strings in agreement so the existing `../athena-core/scripts/check-version-sync.sh` pattern can later guard this repo too. First tag `v0.1.0-alpha`.

## Key Files

| File | Action |
|---|---|
| `../athena-saas-profile/.claude-plugin/plugin.json` | New — manifest: id `saas`, `version` `0.1.0-alpha`, depends-on `athena-core >= 0.2.1` |
| `../athena-saas-profile/package.json` | New — name + version (kept in sync with plugin.json) |
| `../athena-saas-profile/scripts/install.sh` | New — safety gate + registry writer (`.profiles[]` shape, idempotent by `name`) |
| `../athena-saas-profile/scripts/stop-rules/.gitkeep` | New — empty real dir core's loop will scan (`${root}/scripts/stop-rules/`) |
| `../athena-saas-profile/tests/test-install.sh` | New — install **use-case matrix**: clean / idempotent / multi-profile coexistence / corrupt-registry fail-closed / root-change upgrade / empty-registry bootstrap + the 3 safety-gate fail-closed cases (core-missing, `.tmpl`, `jq`) |
| `../athena-saas-profile/tests/test-registry-roundtrip.sh` | New — install → drop blocking rule → run core `stop-verifier.sh` → assert exit 2 |
| `../athena-saas-profile/tests/run-all.sh` | New — glob runner mirroring `../athena-core/tests/run-all.sh` |
| `../athena-saas-profile/README.md` | New — what the profile is + `athena-core >= 0.2.1` dependency (Traditional Chinese for user-facing prose) |
| `../athena-saas-profile/INSTALL.md` | New — install order (core first) + registry mechanism note (Traditional Chinese) |
| `docs/superpowers/specs/2026-05-20-athena-saas-profile-design.md` | Edit — add a "Schema correction" note: §3.2 draft `.installed[]` superseded by shipped `.profiles[].root` (core v0.2.1) |

## Implementation

1. Read the consumer contract first: `../athena-core/scripts/hooks/stop-verifier.sh:39-66` (registry path, `.profiles[]` iteration, `.root`/`.name` fields, `${root}/scripts/stop-rules/*.sh` exec) and `../athena-core/tests/test-profile-registry.sh:33-105` (the three exit-code cases). These define the exact JSON shape the foundation must emit. Do NOT trust the design doc §3.2 schema — it predates the shipped contract.
2. (RED) Write `tests/test-install.sh` as a **use-case matrix**, not a happy-path check. Export `$ATHENA_PROFILE_REGISTRY_PATH` to a temp file and `$HOME` to a temp dir; assert each case below (all fail now — no `install.sh`):
   - **(a) clean install** — precondition met → registry has `jq '.profiles[0].name'` == `athena-saas-profile` and `.profiles[0].root` == the plugin abs root.
   - **(b) idempotent re-install** — a second install does not duplicate (`.profiles | length` stays 1).
   - **(c) core-missing gate** — install fails non-zero when `~/.claude/athena-memory/.installed` is absent.
   - **(d) `.tmpl` safety gate** — install fails non-zero when a `.tmpl` is planted under `agents/`.
   - **(e) multi-profile coexistence** — pre-seed the registry with a foreign entry `{"name":"other-profile","root":"/x"}`; after install, `.profiles | length` == 2 and the foreign entry is byte-identical (siblings never dropped or mutated).
   - **(f) corrupt-registry fail-closed** — write malformed JSON (e.g. `{ broken`) to the registry path; install exits non-zero with a remediation message and leaves the file **unchanged** (no silent clobber).
   - **(g) root-change upgrade** — install, then re-install from a different plugin root (simulating a moved/upgraded checkout); the profile's `.root` is updated in place, `.profiles | length` stays 1 for self, foreign siblings intact.
   - **(h) `jq`-unavailable gate** — with `jq` masked off `$PATH`, install fails non-zero with the remediation message rather than writing a half-formed registry.
   - **(i) empty-registry bootstrap** — when the registry file does not exist at all, install initializes it to `{"profiles":[]}` then upserts (not a crash, not a bare array).
3. (GREEN) Write `scripts/install.sh`: resolve `CLAUDE_PLUGIN_ROOT`; run the three safety-gate checks (core-installed, no `.tmpl` under scanned dirs, `jq` present), each `exit 1` with a remediation line on failure; then `jq` upsert the `.profiles[]` entry keyed by `name` (replace-then-append, the same `map(select(...)) + [...]` idiom the design §5.1 uses, but on `.profiles` not `.installed`). Initialize the registry to `{"profiles": []}` if absent. Re-run test-install — all green.
4. (RED) Write `tests/test-registry-roundtrip.sh`: temp `$HOME` + `$ATHENA_PROFILE_REGISTRY_PATH`; run `install.sh`; write `scripts/stop-rules/always-block.sh` (`echo ... >&2; exit 2`); invoke `bash ../athena-core/scripts/hooks/stop-verifier.sh` from a clean temp git project (mirror the harness setup in `test-profile-registry.sh:9-27`); assert exit code 2. Run — confirm it actually exercises the real core script.
5. (GREEN/verify) Confirm the round-trip passes end-to-end. If core can't find the rule, the registry shape is wrong — fix the writer, not the test.
6. Write `tests/run-all.sh` (glob + aggregate exit) mirroring `../athena-core/tests/run-all.sh`; ensure both test files pass under it.
7. Write `.claude-plugin/plugin.json` + `package.json` with matching version `0.1.0-alpha`; write `README.md` + `INSTALL.md` in Traditional Chinese (install-core-first ordering, the registry-composition one-liner, the `athena-core >= 0.2.1` requirement).
8. Add the "Schema correction" note to the design spec (`docs/superpowers/specs/2026-05-20-athena-saas-profile-design.md`) recording that §3.2's `.installed[]` draft is superseded by the shipped `.profiles[].root` contract — so the next Phase 2 slice doesn't re-introduce the wrong schema.
9. Init git in `../athena-saas-profile`, commit, tag `v0.1.0-alpha` (do not push unless asked).

## Acceptance Criteria

- [ ] `../athena-saas-profile/scripts/install.sh` writes `~/.claude/athena-profile-registry.json` (or `$ATHENA_PROFILE_REGISTRY_PATH`) with top-level `.profiles[]` and per-entry `.name` + `.root` — the exact shape `../athena-core/scripts/hooks/stop-verifier.sh:48-51` reads
- [ ] Re-running `install.sh` is idempotent — `jq '.profiles | length'` stays 1; the entry is replaced (keyed by `name`), never duplicated
- [ ] **Multi-profile coexistence** — installing into a registry that already holds other profiles preserves them byte-for-byte; only this profile's entry is upserted by `name` (foreign `.profiles[]` entries are never dropped or mutated)
- [ ] **Corrupt-registry fail-closed** — a pre-existing malformed registry JSON makes `install.sh` exit non-zero with a remediation message and leaves the file unchanged (no silent overwrite)
- [ ] **Root-change upgrade** — re-installing from a moved/upgraded plugin root updates this profile's `.root` in place (no duplicate; sibling profiles intact)
- [ ] **Empty-registry bootstrap** — a missing registry file is initialized to `{"profiles":[]}` and then upserted (no crash, no bare-array shape)
- [ ] Install safety gate fails closed (non-zero, no registry write, remediation message) on each of: `athena-core` not installed, a `.tmpl` under `agents/`/`skills/`/`commands/`/`hooks/`, `jq` unavailable
- [ ] `tests/test-registry-roundtrip.sh` runs the **real** `../athena-core/scripts/hooks/stop-verifier.sh` against a profile registered by our `install.sh`, plants a blocking `scripts/stop-rules/*.sh`, and asserts the verifier exits 2 with the profile rule named
- [ ] `tests/run-all.sh` exits 0 with both test files green; runtime is reasonable (single-digit seconds)
- [ ] `.claude-plugin/plugin.json` and `package.json` carry matching `0.1.0-alpha` version strings and declare `athena-core >= 0.2.1` as a dependency
- [ ] `README.md` + `INSTALL.md` are written in Traditional Chinese and state the install-core-first ordering and the registry mechanism
- [ ] The design spec carries a "Schema correction" note recording that §3.2's `.installed[]` draft is superseded by the shipped `.profiles[].root` contract
- [ ] No `.tmpl`, command, skill, or seed-memory asset is added in this slice — foundation only (verified by directory inventory)

## Alignment / Cross-Epic Hooks

- **Consumes athena-core v0.2.1 (E203 registry-read), no hard dep on it here** — the consuming block already shipped and is pinned by `../athena-core/tests/test-profile-registry.sh`; this epic is the independent producing half. Soft sequencing only: if core ever changes the `.profiles[].root` contract, this writer must follow.
- **Unblocks every later Phase 2 slice** — the design §4 enumerates 6 commands + 7 skills + 13 stop-rules + ~10 templates + 5 seed lessons; each is a future epic that plugs into the registry + install gate this slice establishes. Soft "do this first," not a hard dependency edge.
- **Mirrors athena-core's repo discipline** — reuses core's `install.sh` seed pattern, `run-all.sh` glob runner, and `check-version-sync.sh` version-agreement convention so the two plugin repos stay structurally consistent.
- **Template repo is canonical upstream (E202)** — this profile is a *separate downstream repo*, not a template asset; it does not enter the template's `make drift-check` / `sync-to-plugin.sh` loop (that loop governs template ↔ athena-core only).

## Out of Scope

- Porting the 6 profile commands, 7 skills, ~10 templates, or 5 seed lessons (design §4) — those are later Phase 2 slices; this is registry + install-gate foundation only.
- Any change to `athena-core` — the registry-read consumer already shipped in v0.2.1; this epic does not touch core.
- Seed-memory copy-into-Tier-0 behavior (design §5.1 step-3) — deferred until the 5 seed lessons are actually ported in a later slice.
- Marketplace submission, `marketplace.json`, monorepo consolidation (design §10 — Phase 3+).
- Uninstall hardening / stale-`root` registry tolerance (design §9 open question #1) — defer to a follow-up.
- Pushing the new repo to a remote or publishing — local scaffold + tag only unless explicitly requested.

## Provenance

- Spec source: `/athena:plan auto` Cycle 23 (2026-06-02)
- Approved via `/athena:plan approve all` on 2026-06-02
