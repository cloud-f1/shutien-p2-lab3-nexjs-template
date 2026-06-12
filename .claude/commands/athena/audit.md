---
description: "(planning) Three-source drift check → OpenAPI ↔ server ↔ client type consistency."
allowed-tools: Read, Bash, Grep, Glob
---

# /athena:audit — Three-Source Consistency Audit

Perform a three-source alignment check across the API contract.

## Sources
1. **OpenAPI spec** (`docs/openapi.yaml`) — declared endpoints and schemas
2. **Server routes** (`server/app/main.py` + `server/app/api/` + `server/app/domains/`) — registered FastAPI routes
3. **Client API calls** (`client/src/api/`) — Axios calls and service definitions

## Audit Steps

### Step 1: Extract OpenAPI endpoints
Read `docs/openapi.yaml` and list all paths with their methods (GET /health, POST /auth/register, etc.).

### Step 2: Extract server routes
Read `server/app/main.py` to find all `include_router` calls. Then read each router file to extract route decorators (@router.get, @router.post, etc.) with their paths. Combine prefix + path to get full endpoint paths.

### Step 3: Extract client API calls
Search `client/src/api/` for all Axios method calls (apiClient.get, apiClient.post, etc.) and extract the URL paths.

### Step 4: Cross-reference
Produce a gap report as a markdown table:

| Endpoint | OpenAPI | Server | Client | Status |
|----------|---------|--------|--------|--------|
| GET /health | ✅ | ✅ | ✅ | Aligned |
| POST /auth/register | ✅ | ✅ | ✅ | Aligned |
| GET /admin/stats | ✅ | ❌ | ❌ | MISSING from server+client |
| DELETE /users/me | ❌ | ✅ | ❌ | NOT in spec |

### Step 5: Schema drift check
For each endpoint in OpenAPI, verify the response schema name exists as a Pydantic model in the server code. Report any schemas referenced in OpenAPI but missing from server models.

### Step 6: Summary
Report:
- Total endpoints: {count}
- Fully aligned: {count}
- Missing from server: {list}
- Missing from client: {list}
- Missing from OpenAPI: {list}
- Schema drift: {list}

## Output
Write the audit report to stdout (not to a file). The user decides what to do with the findings.

## Rules
- This is a **read-only** audit — do NOT modify any source files
- Do NOT write the report to a file unless the user explicitly asks
- If `$ARGUMENTS` is provided, use it to filter (e.g., `auth` audits only auth endpoints)
