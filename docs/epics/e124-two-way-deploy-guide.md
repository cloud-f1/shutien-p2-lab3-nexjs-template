# E124 — Two-Way Deploy Guide (Bilingual)

> Phase 32 — Two-Way Deploy | Size: M | Deps: E120, E121, E122, E123
> Complete step-by-step walkthrough for both platforms, EN + ZH-TW

## Problem

After all deploy infrastructure is built (E120-E123), beginners need a comprehensive guide that walks through the entire deploy journey — from "I just cloned this" to "my app is live." The guide should cover both platforms with a clear decision point at the start.

## Solution

Create a comprehensive deploy walkthrough following the three-file documentation pattern:

### Guide Structure

```
# Deploy Your App — From Clone to Production

## Step 0: Choose Your Platform
[Link to decision guide from E120]

## Step 1: Prerequisites
make doctor-deploy PLATFORM=<choice>

## Step 2: Local Production Test
make docker-prod  →  verify at localhost:3000

## Step 3: First Deploy
### Zeabur Path
make deploy PLATFORM=zeabur ARGS="--first-time"
- Screenshots of Zeabur dashboard
- Where to find logs
- How to set custom domain

### Cloud Run Path
make deploy PLATFORM=cloudrun ARGS="--first-time"
- Database choice (Cloud SQL vs Neon free)
- How secrets work
- Where to find logs (gcloud run logs)
- How to set custom domain

## Step 4: Verify
curl https://your-domain.com/health
Open https://your-domain.com → should see landing page

## Step 5: Ongoing Deploys
make deploy ARGS="--redeploy"

## Troubleshooting
[Common issues from deploy-log.md gotchas table]
```

## Key Files

| File | Action |
|------|--------|
| `docs/guides/en/deploy-walkthrough.md` | New — complete EN guide |
| `docs/guides/zh-TW/deploy-walkthrough.md` | New — ZH-TW version |
| `README.md` | Add deploy section linking to guide |
| `CLAUDE.md` | Update deploy reference |

## Acceptance Criteria

1. Guide covers full journey: choose platform → prerequisites → local test → first deploy → verify → ongoing
2. Both Zeabur and Cloud Run paths with step-by-step commands
3. Cloud Run path includes free-tier DB option (Neon/Supabase)
4. Troubleshooting section covers top 5 gotchas per platform
5. Available in EN + ZH-TW (bilingual pattern)
6. README deploy section updated with link to guide
7. Beginner can follow guide start-to-finish without external documentation
