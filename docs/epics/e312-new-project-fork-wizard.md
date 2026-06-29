# E312 — New-Project Fork Wizard

> Phase 73 · DX · fork-ability
> Status: ⬜ pending

## Problem

Forking this template into a new product requires finding and changing ~15 identity strings scattered across 8+ files (branding.ts, CLAUDE.md, README, dev-docs config, etc.). In practice (proved by the 瑞成 build) this results in drift: wrong repo URLs still point to the template, old product names survive in CI badge links, template skills remain that don't apply. There is no systematic deterministic path for the identity/config half of a fork. A fork team shouldn't have to discover what to change by reading the codebase.

## Solution

Port the `new-project` wizard from `ai-rc-engineer-pm`:

1. **`scripts/new-project.sh`** — interactive wizard (dry-run default, `--apply` to execute). Auto-detects the current identity (APP_NAME from `branding.ts`, repo slug from `git remote`, docs domain from dev-docs config). Prompts for new values with current as defaults. On `--apply`: scoped find/replace across `branding.ts`, `README.md`, `dev-docs/.vitepress/config.mts`, `dev-docs/index.md`; removes template-only skills the user selects (billing/landing/openapi-first etc.). Ends with a brand-staleness grep (audit Step 6b) + agent next-steps.
2. **`new-project` skill** (`SKILL.md`) — explains the deterministic half (wizard) vs judgment half (agent). References `docs/TEMPLATE-VS-PRODUCT.md`. Pairs with `rebrand` skill.
3. **`.claude/commands/athena/new-project.md`** — `/athena:new-project "Product Name"` command. Runs the judgment half: rewrites CLAUDE.md "What This Project Is" + "Current State", swaps domain SSOT/PRD, resets roles + permissions in `lib/permissions.ts`, resets seed demo accounts in `drizzle/seed.ts`, updates `lib/doc-contract.test.ts` thresholds if present.
4. **`docs/TEMPLATE-VS-PRODUCT.md`** — keep-vs-replace map for forks. What is substrate (keep) vs identity (replace). Prevents cargo-culting the template's CLAUDE.md verbatim.
5. **`make new-project`** target — archives template epics (`docs/epics/archive/`) + resets EPIC_INDEX from E1.

## Key Files

- `scripts/new-project.sh` (NEW) — interactive wizard
- `.claude/skills/new-project/SKILL.md` (NEW) — fork wizard skill
- `.claude/commands/athena/new-project.md` (NEW) — agent judgment half
- `docs/TEMPLATE-VS-PRODUCT.md` (NEW) — keep vs replace map
- `Makefile` — add `new-project` target
- `CLAUDE.md` — add `new-project` to key skills list + fork customization section update

## Implementation

### Phase 1 — Keep/replace map + skill
- Create `docs/TEMPLATE-VS-PRODUCT.md`: two-column table (substrate = keep vs identity = replace) for all files. Explicitly lists: branding.ts, README intro, CLAUDE.md "What This Project Is"/"Current State", dev-docs config, CI badge URLs, lib/permissions.ts roles/flags, drizzle/seed.ts demo accounts, template-only skills.
- Port `new-project/SKILL.md` from rc-engineer-pm; adapt to this template's identity strings (remove RC-specific `R#####` badge logic, adapt to email-based auth, adapt role names admin/editor/viewer).

### Phase 2 — Wizard script
- Port `scripts/new-project.sh` from rc-engineer-pm. Adapt: auto-detect APP_NAME from `next-app/lib/branding.ts` (not `next-app/lib/rc-permissions.ts`); detect repo slug from `git remote get-url origin`; detect docs domain from `dev-docs/.vitepress/config.mts`. Skill list to prune: billing (ecpay/stripe install skills), landing install skill, openapi-first skill; user selects which to remove.
- Dry-run by default — prints a plan. `--apply` prompts once then executes scoped find/replace.
- End with: `grep -rn "ai-coding-nexjs-template\|AI App Template" .` brand-staleness report.

### Phase 3 — Command + Makefile
- Create `.claude/commands/athena/new-project.md` — judgment-half command. Reads `docs/TEMPLATE-VS-PRODUCT.md` first, then rewrites CLAUDE.md product sections, PRD intro, roles/permissions, seed accounts.
- Add `make new-project` Makefile target: `git mv docs/epics/e*.md docs/epics/archive/template-phases/ 2>/dev/null || true && echo "Template epics archived. Start fresh with /athena:plan"`.
- Update CLAUDE.md: add `new-project` to key skills list; update "Fork 後客製化提示" to reference the wizard.

## Acceptance Criteria

- [ ] `bash scripts/new-project.sh` (dry-run) runs without error; shows current identity + proposed changes
- [ ] `bash scripts/new-project.sh --apply` with a test product name correctly updates branding.ts + README + dev-docs config in a test branch
- [ ] `.claude/skills/new-project/SKILL.md` exists and documents wizard + command + pairs
- [ ] `.claude/commands/athena/new-project.md` exists with judgment-half instructions
- [ ] `docs/TEMPLATE-VS-PRODUCT.md` exists with complete keep/replace map
- [ ] `make new-project` target works (archives epics, prints next step)
- [ ] No rc-specific content (badge login, R#####, seed-admin, etc.) in any shipped asset

## Cross-Epic

- E311 (TONY) — TONY routing table references `new-project` skill
- E313 (docs reorg) — `docs/TEMPLATE-VS-PRODUCT.md` is indexed in `docs/README.md`

## Out of Scope

- Domain scaffold (schema/screens/rules) — that is `/athena:plan` → `/athena:flow` work
- Automated git init or remote setup — wizard only changes local files
- `athena-core` plugin sync — separate concern
