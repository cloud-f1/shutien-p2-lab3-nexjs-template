# E105 — Admin Health Dashboard API & View

> **Phase 29** | Priority: P1 | Points: 13 | Size: L
> **Depends on**: none

---

## Problem Statement

The template has `GET /health` with DB probe, but no structured health dashboard for operators. After deployment, there's no admin-visible view showing: DB connection status, email provider config, OAuth provider status, app version, uptime, last migration. Template cloners must build their own operational visibility from scratch.

## Stories

### S1: OpenAPI Spec — Admin Health Endpoint

**AC:**
- [ ] `docs/openapi.yaml` updated with `GET /admin/health` endpoint
- [ ] Response schema: `{ db: {status, latency_ms}, email: {provider, configured}, oauth: {providers: []}, app: {version, uptime_seconds, environment}, migrations: {current, pending} }`
- [ ] Requires superuser auth (401 for non-superuser)
- [ ] Spec-first: openapi.yaml edited BEFORE any code

### S2: Server Implementation

**AC:**
- [ ] `server/app/api/v1/endpoints/admin.py` with `GET /admin/health`
- [ ] Checks: DB ping with latency, email provider detection, OAuth provider list, app version from config, process uptime, Alembic migration status
- [ ] Protected by `current_superuser` dependency
- [ ] Returns structured JSON matching OpenAPI schema
- [ ] Router registered in `main.py`

### S3: Client Dashboard View

**AC:**
- [ ] New "System Health" view in Dashboard (alongside existing 7 views)
- [ ] Displays: DB status (green/red), email provider, OAuth providers, app version, uptime
- [ ] Auto-refreshes every 30 seconds
- [ ] Only visible to superuser accounts
- [ ] Graceful handling when endpoint returns 401/403

### S4: Tests

**AC:**
- [ ] Server: integration tests for GET /admin/health (superuser access, non-superuser rejection, response schema)
- [ ] Client: component test for System Health view (loading, success, error states)
- [ ] Contract test: response matches OpenAPI schema

## Risk Notes

- New API endpoint — must follow spec-first workflow (OpenAPI → server → client)
- Migration status check requires Alembic runtime access (may need offline mode fallback)
- Superuser-only gate must be tested thoroughly

## Files to Touch

```
docs/openapi.yaml                                    — update: add GET /admin/health
server/app/api/v1/endpoints/admin.py                 — new: health dashboard endpoint
server/app/main.py                                   — update: register admin router
server/tests/integration/test_admin_health.py        — new: endpoint tests
server/tests/contract/test_openapi_contract.py       — update: add admin/health contract
client/src/pages/dashboard/DashboardPage.tsx          — update: add System Health view
client/src/pages/dashboard/views/SystemHealthView.tsx — new: health dashboard component
client/src/hooks/useAdminHealth.ts                    — new: React Query hook
client/src/tests/handlers/admin.ts                    — new: MSW handler
```
