# E111 — Docker Cleanup & DB Backup Scripts

> Phase 30 — Docker DevOps Maturity | Size: S | Deps: E107
> Learned from: ai-casino-shift + ai-finance-management operational scripts

## Problem

Docker development accumulates dangling images, stopped containers, and unused volumes. Database volumes contain development data with no backup mechanism. Both sibling projects maintain cleanup and backup scripts as standard operational tooling.

## Solution

Two new scripts + two Make targets:

### `scripts/docker-clean.sh`
- Prompt for confirmation before proceeding
- `docker system prune` (containers, images, networks)
- Optionally prune volumes (with extra confirmation)
- Print reclaimed space summary

### `scripts/db-backup.sh`
- `pg_dump` from the Docker PostgreSQL container to `backups/saas_dev_YYYY-MM-DD_HHMMSS.sql.gz`
- Print the exact restore command for convenience
- Graceful error if no container is running

## Key Files

| File | Action |
|------|--------|
| `scripts/docker-clean.sh` | New file — Docker cleanup with confirmation |
| `scripts/db-backup.sh` | New file — pg_dump to timestamped .sql.gz |
| `Makefile` | Add `docker-clean` and `db-backup` targets |
| `.gitignore` | Add `backups/` directory |

## Acceptance Criteria

1. `make docker-clean` prompts for confirmation, prunes containers/images/volumes, shows reclaimed space
2. `make db-backup` creates `backups/saas_dev_YYYY-MM-DD_HHMMSS.sql.gz` via `pg_dump` through Docker
3. Backup script prints the exact restore command to use
4. `backups/` directory is gitignored
5. Both scripts are safe when no containers are running (graceful error messages, not crashes)
6. Both scripts are executable (`chmod +x`)
