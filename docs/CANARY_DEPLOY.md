# Canary Deployment Guide

> Traffic splitting strategies for safe production rollouts.

## What is Canary Deployment?

Route a small percentage (5-10%) of traffic to the new version while monitoring error rates. If errors stay below the SLO threshold, gradually increase traffic. If errors spike, roll back instantly.

## Zeabur

### Traffic Splitting

Zeabur uses deployment slots. To canary:

1. Deploy the new version to a **preview environment**
2. Use Zeabur's domain routing to split traffic:
   - 90% → current production service
   - 10% → preview service
3. Monitor for 15-30 minutes
4. If healthy: promote preview to production
5. If unhealthy: remove traffic split, delete preview

### Rollback

- Instant: remove the traffic split rule
- The previous production version continues serving 90% of traffic throughout

## Cloud Run

### Traffic Splitting (Native Support)

Cloud Run has built-in traffic splitting via revisions:

```bash
# Deploy new revision without routing traffic
gcloud run deploy SERVICE --image IMAGE --no-traffic

# Route 10% to new revision
gcloud run services update-traffic SERVICE \
  --to-revisions=LATEST=10

# Monitor, then promote to 100%
gcloud run services update-traffic SERVICE \
  --to-revisions=LATEST=100

# Rollback: route 100% to previous revision
gcloud run services update-traffic SERVICE \
  --to-revisions=PREVIOUS_REVISION=100
```

### Gradual Rollout Schedule

| Time  | New Version Traffic | Action              |
|-------|---------------------|---------------------|
| T+0   | 5%                  | Deploy canary       |
| T+15m | 10%                 | Check error rate    |
| T+30m | 25%                 | Check latency P99   |
| T+1h  | 50%                 | Check all metrics   |
| T+2h  | 100%                | Full promotion      |

## Monitoring Checklist

Before promoting each traffic increment, verify:

- [ ] Error rate < 0.5% (matches SLO from ERROR_BUDGET.md)
- [ ] P99 latency < 2s
- [ ] No new error types in logs (check structlog JSON output)
- [ ] Health endpoint returns healthy on new revision
- [ ] No increase in 5xx responses
- [ ] Memory/CPU usage within normal bounds

## Rollback Triggers (Automatic)

Immediately roll back if ANY of these occur:

- Error rate exceeds 2% (4x the SLO)
- Health endpoint returns unhealthy
- P99 latency exceeds 5s
- Memory usage exceeds 80% of limit
- Any 503 Service Unavailable responses

## Integration with Error Budget

See `docs/ERROR_BUDGET.md` (E142) for SLO tracking.
If the error budget is already exhausted before a canary:

1. **Do not deploy** — fix reliability first
2. Exception: security patches and critical hotfixes bypass this gate

## Quick Reference

```bash
# Zeabur canary
make deploy PLATFORM=zeabur ARGS="--preview"

# Cloud Run canary
gcloud run deploy my-service --image gcr.io/PROJECT/IMAGE --no-traffic
gcloud run services update-traffic my-service --to-revisions=LATEST=10
```
