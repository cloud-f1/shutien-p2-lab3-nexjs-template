# E317 — Zeabur Deploy Skill Enhancement

> Phase 73 · deployment · toolchain
> Status: ⬜ pending

## Problem

The template's `zeabur-deploy` skill (E306, Phase 71) encodes 5 gotchas and a single source-build path. The `ai-rc-engineer-pm` downstream project battle-tested Zeabur deploys on a live 2C4G dedicated box and discovered 2 additional gotchas and a second deploy path (prebuilt-image) that is REQUIRED on small boxes where source-build fails. The enhanced skill (250 lines vs 163 lines in the template) adds:

1. **Prebuilt-image deploy path** — mandatory when the dedicated box is too small to source-build. One-time setup (dashboard only; no headless CLI), then: cross-build `--platform linux/amd64` → push → `zeabur service update tag`. Critical: Mac (arm64) images won't run on the amd64 server.
2. **Box-sizing guidance** — a 2C4G box (~3.66 GB) can run one web+Postgres env comfortably, but `dev+stg+prd` = 6 services + a build → OOM risk. Concrete measured headroom numbers.
3. **Port-forward security pattern** — `zeabur service port-forward --enable` before migration, `--disable` after. The public TCP endpoint is only open during the migration window; leaving it open is a security risk.
4. **Gotcha #6** — small boxes can't schedule a source-build (`startedAt: 0001`, ~10 s fail, EMPTY build log — NOT a code error). Leads people to debug the code when the real issue is RAM.
5. **Gotcha #7** — built the web service BEFORE Postgres existed? `DATABASE_URL=${POSTGRES_CONNECTION_STRING}` resolves to empty → `/login` 500s but `/api/health` still 200s. Fix: provision Postgres → `zeabur service restart`.
6. **`which path?` decision guide** — source-build vs prebuilt-image selection criteria.

## Solution

Update `.claude/skills/zeabur-deploy/SKILL.md`:
- Add prebuilt-image deploy section (one-time setup + each-deploy commands)
- Add box-sizing section with concrete headroom numbers
- Update step 7 (migrate) with port-forward enable/disable pattern + "forwarded port reassigned on each enable — always re-read" note
- Expand gotchas from 5 to 7 (add gotcha #6 small-box + gotcha #7 build-before-postgres)
- Add "Which path?" selection guide
- Strip rc-specific content (badge login, `db:seed-admin`, `R#####`, `seed-baseline` — these are rc domain-specific)

## Key Files

- `.claude/skills/zeabur-deploy/SKILL.md` — update in place (163 → ~230 lines)

## Implementation

### Phase 1 — Port enhancements (strip rc-specific)
Read the current `zeabur-deploy/SKILL.md` and the rc-engineer-pm version. Apply these diffs:
- **Description block**: expand to mention both deploy models (source-build + prebuilt-image).
- **Step 7 (migrate)**: add `port-forward --enable` before, `--disable` after; add "forwarded port is reassigned on each enable — always re-read it" note. Keep template's standard `pnpm db:seed` (not rc's `seed-admin`/`seed-baseline`).
- **New section "Prebuilt-image deploy path"**: one-time setup (dashboard only to create the service) + each-deploy commands: `docker buildx build --platform linux/amd64`, `docker push`, `zeabur service update tag`. Note `NEXT_PUBLIC_*` build-args.
- **New section "Sizing"**: 2C4G box headroom, one-env comfort limit, dev+stg+prd OOM risk, "Which path?" guide.
- **Expand gotchas 5 → 7**: add #6 (small-box build fails) + #7 (build before postgres).
- **Remove**: rc-specific gotcha #5 ("Badge login, not email" — that's an rc domain convention, not a template gotcha). Replace with a generic reminder about demo login env var.
- **Remove**: `db:seed-admin`, `db:seed-baseline`, `ADMIN_BADGE` — rc domain-specific seeding. Template uses standard `pnpm db:seed` (dev) / skip seed (production).
- **Remove**: "Production / staging — bootstrap an admin without demo data" section that references badge format. Replace with the existing template pattern (drop `NEXT_PUBLIC_ENABLE_DEMO_LOGIN`, no seed).

### Phase 2 — Verify
- Re-read the updated skill; confirm: no `R#####`, no `seed-admin`, no `seed-baseline`, no "badge login" in the text.
- Confirm: both source-build and prebuilt-image paths documented; 7 gotchas; port-forward enable/disable; sizing section.

## Acceptance Criteria

- [ ] `.claude/skills/zeabur-deploy/SKILL.md` updated: 7 gotchas, prebuilt-image path, sizing section, port-forward pattern
- [ ] No rc-specific content (badge login, R#####, seed-admin, seed-baseline, ADMIN_BADGE)
- [ ] "Which path?" guide present (source-build vs prebuilt-image decision)
- [ ] Port-forward enable/disable pattern in step 7 with the "port reassigned on each enable" note
- [ ] `pnpm typecheck && pnpm lint` clean (skill is markdown, trivially clean)

## Cross-Epic

- E312 (new-project) — new projects deploying to small Zeabur boxes will need the prebuilt-image path

## Out of Scope

- Updating `deploy/deploy-zeabur.sh` to support the prebuilt-image path (interactive script — separate concern)
- Zeabur multi-environment topology in CLAUDE.md (rc-specific; template uses single-env deployment)
- Adding a second CI workflow for prebuilt-image builds
