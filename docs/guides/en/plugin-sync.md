# Plugin Sync — Template ↔ athena-core

> **Decision (E202, 2026-06-01):** Path B — Canonical Template.  
> The template is the canonical upstream. `athena-core` is the downstream plugin package.
> All edits happen in the template first; `athena-core` receives changes via one-way sync.

---

## The Template-as-Canonical-Upstream Model

Two repositories hold Athena assets:

| Repository | Role | Edit surface? |
|---|---|---|
| `ai-coding-template` (this repo) | Canonical upstream | Yes — all edits land here |
| `athena-core` | Downstream plugin package | No — receives changes via sync only |

This model was chosen over Path A (dogfood / template consumes athena-core) because
`athena-core` at `v0.1.0-alpha` is 6+ months behind the template — migrating it first
would exceed the 21 SP budget for E202. Path B preserves editing convenience while
creating a mechanical sync path that makes divergence detectable and closeable on demand.

---

## Detecting Drift — `make drift-check`

Run at any time to see which template files have diverged from `athena-core`:

```bash
make drift-check
```

- **Exit 0** — no drift, the two repos are in sync.
- **Exit 1** — drift detected; the output lists every diverged file.

Internally this runs `scripts/sync-to-plugin.sh` in dry-run mode (no files are written).
An `athena_sync` event is appended to `.claude/audit.jsonl` on every invocation.

### When to run

- Before opening a PR that touches `.claude/agents/`, `.claude/commands/athena/`,
  `.claude/skills/`, `scripts/hooks/`, or `scripts/memory/`.
- After any Athena feature epic (to confirm the plugin package is not silently lagging).
- During `athena-core` release preparation (confirms export is clean before tagging).

---

## Exporting Changes to athena-core — `--apply`

Once you have verified the drift and want to close it:

```bash
bash scripts/sync-to-plugin.sh --apply
```

This rsyncs all five asset groups from the template into `athena-core` (default path:
`../athena-core` relative to the template root).

### Custom athena-core location

```bash
bash scripts/sync-to-plugin.sh --apply --athena-core-path /path/to/athena-core
```

### What gets synced

| Template source | athena-core target |
|---|---|
| `.claude/agents/` | `agents/` |
| `.claude/commands/athena/` | `commands/athena/` |
| `.claude/skills/` | `skills/` |
| `scripts/hooks/` | `hooks/` |
| `scripts/memory/` | `scripts/memory/` |

Files are compared by **checksum** (not timestamp) — only genuinely changed files are
written. Python bytecode (`*.pyc`, `__pycache__/`) is excluded automatically.

### Sync-scope exclusions (E203/E209)

The sync script maintains per-pair exclude lists for **athena-core-owned files** that
must never be overwritten by the one-way port:

| Excluded file | Pair | Reason |
|---|---|---|
| `stop-verifier.sh` | `hooks/` | athena-core has a modular version in `scripts/hooks/` that delegates to `scripts/stop-rules/`; the template's 497-line monolith must not land there |
| All template-specific hook scripts | `hooks/` | Hooks referencing Next.js/React/shadcn rules belong in a profile pack, not the universal core |
| `lesson-tags.json` | `scripts/memory/` | E203-sanitized: references `~/.claude/athena-memory/` and strips template framework domains (`server/`, `client/`, etc.) |
| `score.sh` | `scripts/memory/` | E203-owned: sources `scripts/lib/common.sh` + uses `$ATHENA_MEMORY_DIR`; template version uses hardcoded `template-memory/` path |
| `inject.sh` | `scripts/memory/` | Same reason as `score.sh` |
| `match.sh` | `scripts/memory/` | Same reason as `score.sh` |
| `half-life-resolve.sh` | `scripts/memory/` | Same reason as `score.sh` |

These exclusions are implemented in `get_pair_excludes()` in `scripts/sync-to-plugin.sh`.
The function is bash 3.x-compatible (no associative arrays).

### Expected post-sync residual drift

After running `--apply`, `make drift-check` should report **0 files differ** (all synced
pairs are clean). The "exclusions" above produce zero drift because those files are in
different directories than the sync targets:
- `athena-core/scripts/hooks/stop-verifier.sh` ← NOT the sync target (`hooks/`, not `scripts/hooks/`)
- `athena-core/scripts/check-version-sync.sh` ← NOT in any sync pair at all

If `make drift-check` reports drift after an `--apply`, it means new template files were
created that are not yet in athena-core — run `--apply` again to close it.

---

## Opening a PR in athena-core After Sync

After `--apply` completes successfully, the script prints the suggested next steps:

```bash
cd ../athena-core
git diff                          # review what changed
git add -A
git commit -m "chore: sync from template $(date -u +%Y-%m-%dT%H:%M:%SZ)"
# push and open a PR in the athena-core repository
```

PR guidelines for athena-core:
- Title: `chore: sync from template <YYYY-MM-DD> (E<epic>)`
- Body: link to the originating epic in `ai-coding-template`
- Bump the patch version in `athena-core/pyproject.toml` (or equivalent manifest) if
  any agent or command interface changed.

---

## CI Note

GitHub Actions CI is currently **manual-trigger-only** (disabled project-wide since
2026-05-20 — see commit `c7015b6`). `make drift-check` serves as the local substitute
for an automated drift gate. Re-enabling CI to run drift-check on every PR touching
Athena assets is tracked in the ops backlog (out of scope for E202).

---

## Audit Trail

Every invocation of `sync-to-plugin.sh` (dry-run or apply) emits a structured event to
`.claude/audit.jsonl`:

```json
{"ts":"2026-06-01T12:00:00Z","event":"athena_sync","mode":"dry-run","files_changed":3,"target":"/path/to/athena-core"}
```

Query drift history:

```bash
jq 'select(.event=="athena_sync")' .claude/audit.jsonl
```

---

## Sync History

### v0.2.0 — 2026-06-02 (E209, Cycle 22)

**Pre-sync state:** 107 files differed (template Cycle 21 work never ported to athena-core).
athena-core was at `v0.1.0-alpha` + E203 hardening commit `5b07880`.

**Apply:** `scripts/sync-to-plugin.sh --apply` — 65 files synced.

| Category | Files synced | Notes |
|---|---|---|
| Agents | 11 updated + 1 new (`dba.md`) | All Cycle 21 agent updates |
| Commands | 17 updated + 6 new (`audit`, `dba`, `deploy`, `design`, `domain`, `qa-report`) | Complete Cycle 21 pipeline |
| Skills | 3 updated + 9 new | Template skills ported verbatim |
| Memory scripts | 11 new (`backfill-half-life`, `brainstorm-retrieve`, `consolidation-detect`, `forget`, `metrics`, `migrate-strength`, `promotion-follow-through` + 7 tests) | E181–E186 memory system |
| Hooks | 0 (all excluded) | athena-core owns its hook scripts |

**Exclusions applied (sync-scope narrowing):**
- `scripts/hooks/` → `hooks/`: all `.sh` files excluded — athena-core's hook scripts are in `scripts/hooks/` and use `common.sh` paths
- `scripts/memory/lesson-tags.json`: E203-sanitized version preserved (uses `~/.claude/athena-memory/`)
- `scripts/memory/{score,inject,match,half-life-resolve}.sh`: E203-owned, use `common.sh` + `$ATHENA_MEMORY_DIR`

**E203 hardening preserved:** `check-version-sync.sh`, `stop-verifier.sh` registry-read block, `lesson-tags.json` — all intact post-sync.

**Post-sync drift:** `make drift-check` → 0 files differ (clean).

**Version cut:** `package.json`, `plugin.json`, `marketplace.json` → `0.2.0`; `check-version-sync.sh` → exit 0; tag `v0.2.0` pushed.
