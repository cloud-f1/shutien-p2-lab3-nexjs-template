# E123 — `make deploy` Platform Selector

> Phase 32 — Two-Way Deploy | Size: S | Deps: E120, E121
> Single entry point: `make deploy` asks which platform, routes to correct script

## Problem

With two deploy targets (Zeabur + Cloud Run), beginners need to remember which script to run. A single `make deploy` entry point that auto-detects or asks for platform is better DX.

## Solution

Update `make deploy` to be a platform selector:

```bash
# Auto-detect from .deploy-platform file (created on first deploy)
# Or prompt if no file exists:
#   Deploy platform:
#     1. Zeabur (recommended for beginners)
#     2. GCP Cloud Run
#     3. Local production (docker-compose.prod.yml)
#   Choice [1/2/3]:
```

Save choice to `.deploy-platform` for future runs. Override with `PLATFORM=`:

```bash
make deploy                          # auto-detect or ask
make deploy PLATFORM=zeabur          # force Zeabur
make deploy PLATFORM=cloudrun        # force Cloud Run
make deploy PLATFORM=local           # docker-compose.prod.yml
make deploy ARGS="--first-time"      # pass args to platform script
make deploy ARGS="--status"          # check deploy status
```

## Key Files

| File | Action |
|------|--------|
| `Makefile` | Rewrite `deploy` target as platform selector |
| `.gitignore` | Add `.deploy-platform` |

## Acceptance Criteria

1. `make deploy` prompts for platform if no `.deploy-platform` exists
2. `make deploy PLATFORM=zeabur` runs `scripts/deploy-zeabur.sh`
3. `make deploy PLATFORM=cloudrun` runs `scripts/deploy-cloudrun.sh`
4. `make deploy PLATFORM=local` runs `docker compose -f docker-compose.prod.yml up --build`
5. Choice saved to `.deploy-platform` for future runs
6. `ARGS` passed through to underlying script (e.g., `--first-time`, `--status`)
7. `.deploy-platform` is gitignored (per-developer choice)
