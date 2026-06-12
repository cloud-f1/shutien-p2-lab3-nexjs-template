# Health Log — (reserved)
> **Tier 1 Project Memory** · Reserved for future production monitoring.
> Will be owned by @devops-monitor when reinstated after first deploy.

---

## Current Production State

**⬜ Not deployed** — no production health data available.
Last verified: 2026-03-30

Monitor will auto-activate after first Zeabur deploy.

---

## Health Check Endpoints

Once deployed, `@devops-monitor` checks these on every `/monitor` run:

```bash
# 1. API health
curl -sf https://$SERVER_DOMAIN/health
# Expected: { "status": "healthy", "database": { "connected": true, "migration_version": "..." } }

# 2. DB connection
# Extracted from /health response: database.connected = true

# 3. Client nginx
curl -sf https://$CLIENT_DOMAIN
# Expected: HTTP 200, HTML response

# 4. Auth smoke test
curl -sf -o /dev/null -w "%{http_code}" \
  -X POST https://$SERVER_DOMAIN/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid@x.com","password":"wrong"}'
# Expected: 401 (not 422 = schema mismatch, not 500 = server error)

# 5. Response time
# All responses should be < 500ms (Green threshold)
```

---

## Status Classification

| Status | Criteria | Action |
|---|---|---|
| 🟢 **Green** | All checks pass, all responses <500ms | Log only |
| 🟡 **Yellow** | Any response 500ms–2s, or non-critical warning | Log + notify |
| 🔴 **Red** | Any HTTP 5xx, DB disconnected, migration drift, or >2s | **Auto-escalate to @debugger** |

---

## Performance Baselines

*(established after first week of production traffic)*

| Endpoint | P50 Target | P95 Target | Established |
|---|---|---|---|
| `POST /auth/login` | <100ms | <300ms | ⬜ not yet |
| `POST /auth/refresh` | <50ms | <150ms | ⬜ not yet |
| `GET /users/me` | <50ms | <150ms | ⬜ not yet |
| Client initial load | <1s | <2s | ⬜ not yet |

---

## Incident Log

*(none yet — entries appear here after each production incident)*

---

## Health Run History

*(none yet — entries appear here after each /monitor run)*

<!-- Template:
## devops-monitor — [ISO timestamp]

### Health Check Results
| Service | HTTP | Time | Status |
|---------|------|------|--------|
| API /health | 200 | Xms | 🟢/🟡/🔴 |
| Client nginx | 200 | Xms | 🟢/🟡/🔴 |
| DB connected | true/false | — | 🟢/🔴 |
| Auth smoke test | 401 | Xms | 🟢/🔴 |

Migration: v00N ✅ in sync / ❌ DRIFT (expected vN, actual vM)
DB pool: X/Y connections in use

### Overall: HEALTHY 🟢 / DEGRADED 🟡 / INCIDENT 🔴

### Action Taken
[None] / [Escalated to @debugger: error detail]

### Promote?
[GENERALIZABLE / PROJECT-SPECIFIC]
-->
<!-- test-runner stopped at 2026-03-06T15:53:25Z -->
<!--  stopped at 2026-03-06T16:05:39Z -->
<!--  stopped at 2026-03-06T16:05:53Z -->
<!--  stopped at 2026-03-06T16:06:16Z -->
