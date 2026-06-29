# Athena SaaS Profile — Claude Code Plugin Design

> Phase 2 spec: extract the FastAPI/React/openapi.yaml/Zeabur-specific assets that Phase 1 (`athena-core`) deferred into a separate composable profile plugin.
> Author: brainstormed 2026-05-20 with @qwedsazxc78. Phase 1 ships at `cloud-f1/athena-core` v0.1.0-alpha; this design depends on Phase 1's extension registry.

---

## 1. Goal

Package the 6 commands + 1 agent + 7 skills + 13 stop-rules + 5 seed-memory files + ~10 templates that Phase 1 deferred as a Claude Code plugin called `athena-saas-profile`. Profile installs alongside `athena-core` and registers itself in a runtime registry so core's `stop-verifier.sh` discovers and runs profile rules.

Audience: forks of the AI Coding Template + anyone running the FastAPI + React + openapi.yaml + Zeabur stack who wants Athena's opinionated behavior for that stack.

## 2. Scope decision matrix

| Question | Decision |
|---|---|
| Profile ambition | **Minimal extraction** — direct port of Phase 1's deferred assets. No multi-stack framework (deferred to Phase 3+). |
| Activation model | **Always-on when installed** — no auto-detection logic. User opts in by installing. |
| Composition mechanism | **Registry-based** (`~/.claude/athena-profile-registry.json`). Profile writes itself on install; core's stop-verifier reads it at runtime. |
| Core paired update | **athena-core v0.1.1** (patch bump per user preference; strict semver would prefer 0.2.0 since core gains registry-reading behavior). |
| Repo layout | **Separate repos** — `cloud-f1/athena-saas-profile` (private). Two plugins, two repos. Revisit monorepo if/when adding 3+ plugins. |
| Templates directory | **Custom `templates/` directory** at plugin root. `.tmpl` files are NOT a Claude Code convention — must live OUTSIDE `agents/` / `skills/` / `commands/` to avoid Claude Code parsing them. |
| Profile seed sanitization | **Looser than core** — FastAPI/React refs allowed. Just rephrase coercive language ("you MUST" → "this template uses"). |

## 3. Architecture

### 3.1 Plugin layout

```
athena-saas-profile/
  .claude-plugin/
    plugin.json             # depends-on: athena-core, athena.profile.id = "saas"
    marketplace.json
  commands/athena/          # 6 profile commands
    deploy.md       dba.md          domain.md
    audit.md        design.md       qa-report.md
  agents/                   # 1 agent only (domain-expert moved to templates/)
    dba.md
  templates/                # NEW custom dir (not scanned by Claude Code)
    agents/
      domain-expert.md.tmpl
    domain/                 # ported from ai-coding-template/docs/templates/domain/
      openapi/
        schemas.yaml.tmpl
        paths.yaml.tmpl
      server/
        model_shim.py.tmpl
        schema_shim.py.tmpl
        test_integration.py.tmpl
      client/
        schema.ts.tmpl
        service.ts.tmpl
        hooks.ts.tmpl
        page.tsx.tmpl
        page.test.tsx.tmpl
  skills/                   # 7 stack-specific skills
    openapi-first.md          server-patterns.md
    client-patterns.md        frontend-review.md
    dba-migrations.md         deploy-gcr-zeabur.md
    upgrade-stripe.md
  scripts/
    stop-rules/             # 13 stack-specific rules
      localStorage-ban.sh        fireEvent-ban.sh
      staleTime-hardcoding.sh    msw-handler-location.sh
      openapi-drift.sh           orphan-route.sh
      css-co-location.sh         msw-factory.sh
      schema-bridge.sh           css-var-drift.sh
      design-system-no-pages-css.sh
      design-system-no-styles-common.sh
      openapi-contract-evidence.sh
    install.sh              # registers profile + copies seed + safety check
  seed-memory/              # 5 stack-specific lessons (light edit only)
    architecture-patterns.md     architecture-lessons.md
    integration-gotchas.md       performance-insights.md
    mockup-contract.md
  tests/
    fixtures/
      saas-template-mini/   # FastAPI+React+openapi.yaml fixture
    test-install.sh         test-stop-rules.sh
    test-commands.sh        test-templates.sh
    run-all.sh
  .github/workflows/test.yml
  package.json
  README.md
  INSTALL.md
  MIGRATION.md
  CLAUDE.md
```

### 3.2 Composition mechanism (registry-based)

> **⚠️ Schema correction (E213, 2026-06-02).** The `.installed[]` / `plugin_root`
> draft below is **SUPERSEDED** and was never shipped. The registry-read consumer
> that actually shipped in `athena-core` **v0.2.1**
> (`../athena-core/scripts/hooks/stop-verifier.sh:48-51`) reads the top-level key
> **`.profiles[]`** and only two per-entry fields — **`.name`** and **`.root`**.
> The shipped contract is therefore:
>
> ```json
> { "profiles": [ { "name": "athena-saas-profile", "root": "/abs/plugin/root" } ] }
> ```
>
> `athena-saas-profile`'s `scripts/install.sh` (shipped in E213) emits this
> `.profiles[].root` shape, NOT the `.installed[]` / `plugin_root` /
> `extensionPoints` / `id` / `version` / `installed_at` draft kept below for
> historical reference. Any future Phase 2 slice MUST follow the shipped
> `.profiles[].root` contract — do not re-introduce the draft schema.

On profile install, `scripts/install.sh` appends to `~/.claude/athena-profile-registry.json`:

```json
{
  "installed": [
    {
      "id": "saas",
      "name": "athena-saas-profile",
      "version": "0.1.0",
      "plugin_root": "/path/to/installed/plugin",
      "extensionPoints": {
        "stop-rules": "scripts/stop-rules/",
        "seed-memory": "seed-memory/",
        "templates": "templates/"
      },
      "installed_at": "2026-05-20T..."
    }
  ]
}
```

**Static asset composition (commands, agents, skills):** Already automatic via Claude Code's plugin merger. No registry needed — both plugins' `commands/` / `agents/` / `skills/` directories are visible.

**Stop-rules composition:** Requires core hotfix v0.1.1 (see §3.4).

**Seed-memory composition:** Profile's `install.sh` copies `seed-memory/*.md` into `~/.claude/athena-memory/` (only files not already present — same behavior as core's install). Profile lessons compound with core lessons in the SAME global Tier 0 directory.

**Templates composition:** Used internally by the profile's `/athena:domain` command (which reads `${CLAUDE_PLUGIN_ROOT}/templates/...`). Not exposed to other plugins.

### 3.3 Activation: always-on when installed

If user installed `athena-saas-profile`, every project Claude works in gets:
- All 6 profile commands visible in `/athena:*` namespace
- All 14 profile stop-rules invoked on Stop hook (via core's registry-aware stop-verifier)
- All 7 profile skills available for description-driven auto-trigger
- All 6 profile seed lessons in global Tier 0

No detection logic. No per-project opt-in. If a user has a non-FastAPI project, the rules either no-op (e.g., `openapi-drift.sh` does nothing if no `openapi.yaml` exists) or surface "blocked" messages that the user can investigate / fix / ignore. Worst case the user uninstalls the profile.

### 3.4 Core hotfix (athena-core v0.1.1)

Two file changes in `cloud-f1/athena-core`:

1. **`scripts/hooks/stop-verifier.sh`** — after running its own rules, read `~/.claude/athena-profile-registry.json` and execute each registered profile's `${plugin_root}/scripts/stop-rules/*.sh` with the same exit-code semantics (any failure blocks completion).

2. **`tests/test-profile-registry.sh`** — mock a profile entry in the registry, point it to a temp dir with a deliberately-failing rule, assert `stop-verifier.sh` exits non-zero with the profile rule's failure message.

Version bump `0.1.0-alpha` → `0.1.1`. Tag + push to `cloud-f1/athena-core`. Profile pack requires `athena-core >= 0.1.1`.

## 4. Asset enumeration

### 4.1 Commands (6) — direct port

| Command | Notes |
|---|---|
| `deploy.md` | Zeabur 7-gate. Direct port. |
| `dba.md` | Alembic-specific. Direct port. |
| `domain.md` | FastAPI scaffolder. **Port-time edit required:** change `docs/templates/domain/...` references to `${CLAUDE_PLUGIN_ROOT}/templates/domain/...`. |
| `audit.md` | Three-source drift (OpenAPI ↔ server ↔ client). Direct port. |
| `design.md` | Couples to `client/src/components/ui/`. Direct port. |
| `qa-report.md` | Bugfix-log → epic proposals. Direct port. |

### 4.2 Agents (1)

| Agent | Notes |
|---|---|
| `dba.md` | Alembic specialist. Direct port. |

`domain-expert.md.tmpl` moves to `templates/agents/` — NOT under `agents/` — because `{{PLACEHOLDER}}` frontmatter would crash Claude Code's agent loader.

### 4.3 Templates (~10) — port from `docs/templates/domain/`

| File | Path in profile |
|---|---|
| `domain-expert.md.tmpl` | `templates/agents/domain-expert.md.tmpl` |
| `schemas.yaml.tmpl` | `templates/domain/openapi/schemas.yaml.tmpl` |
| `paths.yaml.tmpl` | `templates/domain/openapi/paths.yaml.tmpl` |
| `model_shim.py.tmpl` | `templates/domain/server/model_shim.py.tmpl` |
| `schema_shim.py.tmpl` | `templates/domain/server/schema_shim.py.tmpl` |
| `test_integration.py.tmpl` | `templates/domain/server/test_integration.py.tmpl` |
| `schema.ts.tmpl` | `templates/domain/client/schema.ts.tmpl` |
| `service.ts.tmpl` | `templates/domain/client/service.ts.tmpl` |
| `hooks.ts.tmpl` | `templates/domain/client/hooks.ts.tmpl` |
| `page.tsx.tmpl` | `templates/domain/client/page.tsx.tmpl` |
| `page.test.tsx.tmpl` | `templates/domain/client/page.test.tsx.tmpl` |

Exact count depends on what's in `docs/templates/domain/` — verify at port time.

### 4.4 Skills (7) — direct port, no sanitization

| Skill | Notes |
|---|---|
| `openapi-first.md` | OpenAPI-first design. |
| `server-patterns.md` | FastAPI (fastapi-users, GUID, async). |
| `client-patterns.md` | React/Vite/React Query/Zustand. |
| `frontend-review.md` | a11y + RTL + MSW. |
| `dba-migrations.md` | Alembic discipline. |
| `deploy-gcr-zeabur.md` | GCR + Zeabur specifics. |
| `upgrade-stripe.md` | Stripe API upgrade. |

Profile skills are ALLOWED to reference FastAPI/React/openapi/Zeabur — that's their purpose.

### 4.5 Stop-rules (13) — extract to discrete scripts

| Rule script | Source rule (from core's pre-split `stop-verifier.sh`) |
|---|---|
| `localStorage-ban.sh` | tokens-in-memory invariant |
| `fireEvent-ban.sh` | RTL userEvent over fireEvent |
| `staleTime-hardcoding.sh` | React Query staleTime via cacheConfig |
| `msw-handler-location.sh` | handlers under `src/tests/handlers/` |
| `openapi-drift.sh` | server/client must match openapi.yaml |
| `orphan-route.sh` | React routes registered in routeMap |
| `css-co-location.sh` | block new `pages/*.css` |
| `msw-factory.sh` | createCrudHandlers factory usage |
| `schema-bridge.sh` | `satisfies z.ZodType<ApiType>` enforcement |
| `css-var-drift.sh` | Theme CSS vars consistency |
| `design-system-no-pages-css.sh` | E176 Rule #21 — block new files matching `client/src/pages/**/*.css` |
| `design-system-no-styles-common.sh` | E176 Rule #22 — block new rules under `styles/common/*.css` |
| `openapi-contract-evidence.sh` | E156 Rule #20 — requires `qa_contract` audit event when `docs/openapi.yaml` changes |

**Dropped from original list:** `folder-names.sh` (was blocking `backend/`+`frontend/` in favor of `server/`+`client/`). Reason: folder naming is a preference, not a correctness invariant — enforcing template conventions on non-template projects is hostile.

Each script:
- Sources core's common.sh: `source "${ATHENA_CORE_ROOT}/scripts/lib/common.sh"` OR copies the two-root resolution pattern inline
- Implements ONE rule check
- Exit 0 = pass, non-zero with stderr = block

### 4.6 Seed memory (5) — light edit only

| File | Notes |
|---|---|
| `architecture-patterns.md` | FastAPI + React patterns. Soften "you MUST" → "this template uses". |
| `architecture-lessons.md` | Stack-specific lessons. Soften. |
| `integration-gotchas.md` | openapi/fastapi-users gotchas. Soften. |
| `performance-insights.md` | Postgres + React Query specifics. Soften. |
| `mockup-contract.md` | Design handoff contract. Soften. |

**Dropped from original list:** `design-handoff-pattern.md`. Reason: references a `/design-handoff` skill that doesn't exist in any current plugin, and Tailwind/shadcn-specific implementation details that won't generalize even within the profile audience. Honest scope — ship 5 complete lessons over 6 with one half-baked.

## 5. Install + lifecycle

### 5.1 First install

```bash
claude code plugin install github.com/cloud-f1/athena-saas-profile
```

Plugin manifest registers commands/agents/skills. SessionStart fires; `scripts/install.sh` runs:

```bash
#!/bin/bash
# 1. Sanity-check that athena-core is installed
[[ -f ~/.claude/athena-memory/.installed ]] || {
  echo "athena-saas-profile requires athena-core to be installed first" >&2
  echo "Install via: claude code plugin install github.com/cloud-f1/athena-core" >&2
  exit 1
}

# 2. Register in profile registry
REGISTRY=~/.claude/athena-profile-registry.json
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
mkdir -p "$(dirname "$REGISTRY")"
[[ -f "$REGISTRY" ]] || echo '{"installed": []}' > "$REGISTRY"

jq --arg id "saas" --arg name "athena-saas-profile" --arg version "0.1.0" \
   --arg root "$PLUGIN_ROOT" --arg installed_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   '.installed |= map(select(.id != $id)) | .installed += [{
      "id": $id, "name": $name, "version": $version,
      "plugin_root": $root,
      "extensionPoints": {
        "stop-rules": "scripts/stop-rules/",
        "seed-memory": "seed-memory/",
        "templates": "templates/"
      },
      "installed_at": $installed_at
   }]' "$REGISTRY" > "$REGISTRY.tmp" && mv "$REGISTRY.tmp" "$REGISTRY"

# 3. Copy seed memory into global Tier 0 (skip existing)
cp -rn "$PLUGIN_ROOT/seed-memory/"*.md ~/.claude/athena-memory/

# 4. Safety check: templates must NOT live under Claude Code's scanned dirs
for d in agents skills commands hooks; do
  if ls "$PLUGIN_ROOT/$d/"*.tmpl 2>/dev/null; then
    echo "FAIL: .tmpl files found in $d/ — must move to templates/" >&2
    exit 1
  fi
done

echo "athena-saas-profile: installed, registered in $REGISTRY, $(ls "$PLUGIN_ROOT/seed-memory"/*.md | wc -l) seed lessons added"
```

### 5.2 Plugin upgrade

`install.sh` is idempotent — overwrites its own registry entry, copies only new seed files. Existing seed file customizations preserved (`cp -n`).

### 5.3 Uninstall

Manual: `claude code plugin uninstall athena-saas-profile` removes plugin. User must manually remove entry from `~/.claude/athena-profile-registry.json` (or core's stop-verifier should tolerate missing `plugin_root` entries gracefully — defer this hardening).

Seed lessons copied to `~/.claude/athena-memory/` STAY — user owns Tier 0. They can manually `rm ~/.claude/athena-memory/architecture-patterns.md` etc. if desired.

## 6. Distribution

- **Repo:** `cloud-f1/athena-saas-profile` (private)
- **Install:** `claude code plugin install github.com/cloud-f1/athena-saas-profile`
- **Marketplace:** deferred (mirror core's policy)
- **First tag:** `v0.1.0-alpha`
- **Dependency:** declared in plugin.json or README — requires `athena-core >= 0.1.1`

## 7. Testing strategy

```
tests/
  fixtures/
    saas-template-mini/      # FastAPI + React + openapi.yaml fixture
      pyproject.toml           # marks Python project
      server/__init__.py       # marks server dir
      client/package.json      # marks client dir
      docs/openapi.yaml        # marks openapi presence
      alembic/versions/.gitkeep
  test-install.sh            # registry write + seed copy + idempotent re-install
  test-stop-rules.sh         # each of 13 rules invoked against fixture, behavior asserted
  test-commands.sh           # 6 commands present, frontmatter, no broken template paths
  test-templates.sh          # ~10 template files readable + parsable (no syntax errors in .tmpl)
  run-all.sh                 # glob runner, mirror core's M9
```

Target: <90s total runtime, ~25 tests.

GitHub Actions: `.github/workflows/test.yml` mirrors core's CI.

## 8. Phase 2 deliverables shopping list

| Deliverable | Count |
|---|---|
| Plugin manifest | 3 (plugin.json + marketplace.json + package.json) |
| Commands | 6 (port + `domain.md` path edit) |
| Agents | 1 |
| Templates | ~10 (port from `docs/templates/domain/` + `domain-expert.md.tmpl`) |
| Skills | 7 |
| Stop-rules | 13 |
| Seed memory | 5 (light soften) |
| install.sh | 1 |
| Tests | 4 test files + 1 fixture + run-all.sh + CI workflow |
| Docs | README + INSTALL + MIGRATION + plugin CLAUDE.md (4) |
| **Core hotfix (athena-core v0.1.1)** | separate PR — `stop-verifier.sh` edit + 1 test + version bump |

## 9. Open questions (resolve during implementation)

1. **Uninstall hardening** — core's stop-verifier should tolerate stale `plugin_root` entries in the registry. Defer to a follow-up patch.
2. **Stop-rule `common.sh` sourcing** — does profile inline the two-root pattern, or source from a hardcoded `${ATHENA_CORE_ROOT}/scripts/lib/common.sh`? Decide at impl time based on what Claude Code env vars are available.

**Resolved during brainstorm (2026-05-20):**
- `design-handoff-pattern.md` placement → DROP entirely (references nonexistent skill + Tailwind/shadcn coupling).
- `folder-names.sh` rule → DROP entirely (preference, not correctness invariant).
- Templates safety check → Trust design AND add install-time assertion that no `.tmpl` files exist under `agents/` / `skills/` / `commands/` / `hooks/`.

## 10. Out of scope (Phase 3+)

- Multi-stack framework (athena-nextjs-profile, athena-django-profile, etc.)
- Marketplace submission
- Migration of ai-coding-template repo to consume both plugins as deps
- Cross-platform shell portability beyond bash
- Monorepo consolidation (revisit if/when 3+ plugins exist)

## 11. Roadmap recap

**Phase 1 (DONE):** `athena-core` v0.1.0-alpha at `cloud-f1/athena-core`. 17 cmds + 11 agents + 6 skills + 10 stop-rules + 7 seed lessons.

**Phase 2 (this spec):** `athena-saas-profile` + `athena-core` v0.1.1 hotfix. Direct port of deferred assets, registry-based composition.

**Phase 3 (deferred):** Either multi-stack framework OR marketplace submission OR monorepo consolidation — pick based on actual demand signals.
