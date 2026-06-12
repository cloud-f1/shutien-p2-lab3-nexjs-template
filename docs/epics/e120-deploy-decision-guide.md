# E120 — Deploy Decision Guide + Prerequisites Checker

> Phase 32 — Two-Way Deploy | Size: S | Deps: none
> Beginner-first: help users choose a platform BEFORE running any deploy command

## Problem

A beginner clones the template and runs `make deploy` — but which platform? Zeabur is simpler (GitHub login, 1-click DB), Cloud Run offers more control (30+ regions, free compute tier). Without guidance, beginners either pick randomly or give up. There's also no way to verify they have the right tools installed for their chosen platform.

## Solution

### 1. Deploy Decision Guide (`docs/guides/en/deploy-guide.md` + `zh-TW/`)

A flowchart-style guide that helps beginners choose:

```
Do you need GCP specifically? (work/school requirement)
  → YES: Cloud Run path
  → NO: Do you want the simplest possible deploy?
    → YES: Zeabur path (recommended for first-timers)
    → NO: Do you want free tier + more control?
      → YES: Cloud Run path (free compute, ~$7/mo DB or use Neon free)
      → NO: Zeabur path
```

Include comparison table: cost, complexity, cold starts, regions, DB options.

### 2. Prerequisites Checker (`make doctor-deploy`)

New Make target that checks platform-specific prerequisites:

```bash
make doctor-deploy              # auto-detect from .deploy-platform or ask
make doctor-deploy PLATFORM=zeabur
make doctor-deploy PLATFORM=cloudrun
```

Zeabur checks: `zeabur` CLI installed, authenticated, Node.js available
Cloud Run checks: `gcloud` CLI installed, authenticated, project set, APIs enabled, Docker available

## Key Files

| File | Action |
|------|--------|
| `docs/guides/en/deploy-guide.md` | New — decision guide + comparison |
| `docs/guides/zh-TW/deploy-guide.md` | New — Traditional Chinese version |
| `scripts/doctor-deploy.sh` | New — platform prerequisites checker |
| `Makefile` | Add `doctor-deploy` target |

## Acceptance Criteria

1. Decision guide with flowchart helps beginners choose zeabur vs cloudrun
2. Comparison table covers: cost, complexity, cold starts, regions, DB options, secrets
3. `make doctor-deploy PLATFORM=zeabur` checks zeabur CLI + auth
4. `make doctor-deploy PLATFORM=cloudrun` checks gcloud CLI + auth + project + APIs + Docker
5. Each failed check has a "Fix:" hint with the exact install/auth command
6. Guide available in EN + ZH-TW (bilingual pattern)
