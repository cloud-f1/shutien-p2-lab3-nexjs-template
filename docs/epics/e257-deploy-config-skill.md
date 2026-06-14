# E257 — Deploy-Config Skill (both roads)

**Phase:** 59 | **Status:** ⬜ | **Depends:** E255, E256

## Problem

The existing `deploy-gcr-zeabur` skill is stale (GCR + dual FastAPI client/server). There is no skill that helps a user configure + execute a Next.js deploy on either road, so the knowledge lives only in docs.

## Solution

Create `.claude/skills/deploy-config/SKILL.md` — the execution layer that walks a user through configuring and running a deploy for either Road 1 (Zeabur) or Road 2 (GCP Cloud Run + Cloud SQL), and retire the stale skill.

## Key Files

- `.claude/skills/deploy-config/SKILL.md` (new)
- `.claude/skills/deploy-gcr-zeabur.md` (deprecate/retire)
- `docs/guides/deployment.md` (referenced by the skill)

## Implementation

1. Preflight gate: `pnpm build` green, migrations generated, `.env` complete (cross-check `.env.example`), `make smoke` optional.
2. Road 1 (Zeabur): project link, Postgres, env (build vs runtime), `zeabur` CLI deploy; defer to the official `zeabur@zeabur` plugin skill for internals.
3. Road 2 (GCP): `gcloud` build/push, Cloud Run deploy, Cloud SQL connector, Secret Manager, migrate/seed job.
4. Gotchas section: build-time `NEXT_PUBLIC_*`, JWT `AUTH_SECRET`, Cloud SQL connector socket path, `lib/db.ts` lazy-init (build with placeholder env).
5. Deprecate `deploy-gcr-zeabur.md` (tombstone pointing to the new skill).

## Acceptance Criteria

- [ ] `.claude/skills/deploy-config/SKILL.md` covers preflight + both roads + gotchas and references `docs/guides/deployment.md` + the Zeabur plugin.
- [ ] Stale `deploy-gcr-zeabur` skill retired/tombstoned.
- [ ] Skill front-matter description triggers on deploy-config intents.

## Out of Scope

- Executing a real deploy. Authoring new `@saas` modules (that's `module-author`).
