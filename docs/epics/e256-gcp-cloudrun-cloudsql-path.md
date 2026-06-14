# E256 — GCP Cloud Run + Cloud SQL Path + Guide

**Phase:** 59 | **Status:** ⬜ | **Depends:** E254

## Problem

There is no documented second deploy road. Users wanting GCP need a reproducible Cloud Run + Cloud SQL runbook using `gcloud` (571 present), with no real infra baked into the repo.

## Solution

Document the GCP road (Road 2): containerize `next-app/` (existing Cloud-Run-ready Dockerfile) → Artifact Registry → Cloud Run, backed by Cloud SQL Postgres via the connector, with secrets in Secret Manager — all parameterized with `${PROJECT_ID}` / `${REGION}` / `${INSTANCE}` placeholders.

## Key Files

- `docs/guides/deployment.md` (new) — Road 2 section

## Implementation

1. `gcloud` setup: project, enable `run`, `sqladmin`, `artifactregistry`, `secretmanager` APIs.
2. Build & push image to Artifact Registry (`gcloud builds submit` or docker push), or `gcloud run deploy --source`.
3. Cloud SQL Postgres instance; connect Cloud Run via `--add-cloudsql-instances` (unix socket) → `DATABASE_URL`.
4. Secrets: `AUTH_SECRET`, `DATABASE_URL` in Secret Manager → `--set-secrets`.
5. `NEXT_PUBLIC_*` baked at build time (`--build-arg` / Cloud Build substitutions).
6. Migrate/seed one-shot: Cloud Run Job or `gcloud run jobs` against the same image.
7. Custom domain mapping; `AUTH_URL`/`AUTH_TRUST_HOST`.

## Acceptance Criteria

- [ ] `docs/guides/deployment.md` Road 2 covers APIs, build/push, Cloud Run deploy, Cloud SQL connector, Secret Manager, migrate/seed, domain.
- [ ] All GCP identifiers use `${PLACEHOLDER}` form — no real project/region/instance values.
- [ ] Cloud SQL connector + build-time `NEXT_PUBLIC_*` gotchas are explicit.

## Out of Scope

- Zeabur path (E255). Real GCP provisioning. Terraform/IaC (could be a later epic).
