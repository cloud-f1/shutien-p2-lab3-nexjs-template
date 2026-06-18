# E306 — Zeabur Deploy Skill (Headless CLI Flow)

> Phase 71 · toolchain enrichment · deployment
> Status: ⬜ pending

## Problem

`docs/deployment/zeabur.md` and `deploy/deploy-zeabur.sh` (E255/E287) provide an interactive deployment guide, but there is no skill that encodes the exact headless CLI flow for automation. Fork teams deploying to a Zeabur dedicated server hit 5 recurring gotchas that are not documented:

1. **Deprecated marketplace** — `zeabur service add postgresql` fails with `MARKETPLACE_IS_DEPRECATED`; must use template `B20CX0`
2. **Dotfile-dropping uploader** — `zeabur deploy` silently drops `.env.example` and other dotfiles; these must be provided as explicit env vars
3. **Standalone runtime can't migrate** — `next build --standalone` output has no `drizzle-kit` binary; migrations must run via a builder image step or separate service
4. **NEXT_PUBLIC bakes at build** — `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_APP_NAME` are baked at `next build`, so env vars must be set *before* the first deploy (not after)
5. **Env-then-redeploy ordering** — setting env vars after deploy has no effect until a full redeploy; the correct order is: create project → provision DB → generate domain → set ALL env vars → deploy → migrate → seed

## Solution

**`.claude/skills/zeabur-deploy/SKILL.md`** — headless CLI flow encoding all 5 gotchas:

1. Find server's region ID (`zeabur server list --json -i=false`)
2. Create project on that region (`zeabur project create --region server-<ID>`)
3. Provision PostgreSQL via template B20CX0 (NOT marketplace)
4. Generate a domain (needed BEFORE setting env — `NEXT_PUBLIC_APP_URL` bakes at build)
5. Set ALL env vars including `${POSTGRES_CONNECTION_STRING}` (literal, not expanded)
6. Deploy web service from `next-app/` (`zeabur deploy --create`)
7. Run migrations in-service (via `zeabur service exec` or builder step)
8. Seed the database + verify
9. Health check the production URL

Also document:
- `ZEABUR_API_KEY` setup (env token — never `wrangler login` or interactive auth)
- Always pass `--json -i=false` to prevent interactive hangs in automation
- The `deploy/deploy-zeabur.sh` interactive script (for humans who prefer prompts)

## Key Files

- `.claude/skills/zeabur-deploy/SKILL.md` (NEW) — headless CLI flow + 5 gotchas
- `docs/deployment/zeabur.md` — update to cross-reference the skill
- `deploy/deploy-zeabur.sh` — cross-reference skill in header comment

## Implementation

### Phase 1 — Skill
- Port `zeabur-deploy/SKILL.md` from pm reference
- Adapt to this template (Next.js service in `next-app/`, standard seed credentials)
- Ensure all 5 gotchas are documented with exact error messages and fixes
- Include the `--json -i=false` discipline throughout all CLI examples

### Phase 2 — Cross-references
- Add a note in `docs/deployment/zeabur.md`: "For automated/headless deploys, see the `zeabur-deploy` skill"
- Add a comment in `deploy/deploy-zeabur.sh`: "For non-interactive automation, see `.claude/skills/zeabur-deploy/SKILL.md`"

## Acceptance Criteria

- [ ] `.claude/skills/zeabur-deploy/SKILL.md` exists and covers: 9-step flow + 5 gotchas + ZEABUR_API_KEY setup
- [ ] All 5 gotchas are explicitly named with their error messages
- [ ] `docs/deployment/zeabur.md` cross-references the skill
- [ ] No code changes to the app itself

## Out of Scope

- Implementing a new deploy script (the existing `deploy-zeabur.sh` is sufficient for interactive use)
- GCP Cloud Run deploy (separate skill in `deploy-config`)
- Vercel deploy (not the primary deploy target)
