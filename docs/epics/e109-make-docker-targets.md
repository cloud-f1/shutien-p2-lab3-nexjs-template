# E109 — Make Docker Targets

> Phase 30 — Docker DevOps Maturity | Size: S | Deps: E107, E108
> Learned from: ai-casino-shift Makefile `docker-dev`, `docker-prod` targets

## Problem

After E107 and E108 create dev and prod compose files, developers need to remember compose CLI syntax. Both sibling projects offer `make docker-dev`, `make docker-prod`, `make docker-down` as convenience wrappers.

## Solution

Add 5 Docker targets to root Makefile:
- `docker-dev` — `docker compose up` with URL output
- `docker-prod` — `docker compose -f docker-compose.prod.yml up --build` with URL output
- `docker-down` — stops both dev and prod stacks
- `docker-logs` — tails dev stack logs
- `docker-ps` — shows running containers across both compose files

## Key Files

| File | Action |
|------|--------|
| `Makefile` | Add Docker section with 5 targets |

## Acceptance Criteria

1. `make docker-dev` runs dev compose, prints server (8080) + client (5173) URLs
2. `make docker-prod` builds and runs prod compose, prints server (8080) + client (3000) URLs
3. `make docker-down` stops all Docker services gracefully
4. `make docker-logs` tails dev stack logs (follows output)
5. `make docker-ps` shows containers from both compose files
6. All 5 targets appear in `make help` output with `##` descriptions
