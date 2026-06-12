---
name: openapi-first
description: >
  OpenAPI-first (SDD) workflow for this project. Use this skill whenever starting a new
  feature, adding an endpoint, changing a schema, or modifying docs/openapi.yaml. Also use
  when someone asks about the API contract, type generation, or the spec-driven development
  process. The spec is the single source of truth — code follows the spec, never the reverse.
---

# OpenAPI-First (SDD) — AI-Coding-Template

The spec at `docs/openapi.yaml` is the **single source of truth** for all API types.
Edit the spec FIRST, then implement. Never write server or client code before the spec.

## Workflow (NEVER SKIP steps)

1. **Edit** `docs/openapi.yaml` — add paths, schemas, parameters
2. **Lint** `npx @redocly/cli lint docs/openapi.yaml`
3. **Generate types** `npx openapi-typescript docs/openapi.yaml --output client/src/api/types.ts`
4. **Write server route** — response shape must match spec exactly
5. **Write client Zod schema** with `satisfies z.ZodType<ApiType>` for drift detection
6. **Write client hook** — use generated types + Zod validation

## Schema Conventions

Naming: PascalCase, domain-prefixed for clarity.
```yaml
components:
  schemas:
    UserRead:        # GET response
    UserCreate:      # POST request body
    UserUpdate:      # PATCH request body
    BearerResponse:  # Token response
    ErrorDetail:     # Standard error shape
```

Reuse `$ref` for shared schemas. Define once in `components/schemas/`, reference everywhere.

## Path Conventions

```yaml
paths:
  /resource:
    get:    { operationId: resourceList,   tags: [resource] }
    post:   { operationId: resourceCreate, tags: [resource] }
  /resource/{id}:
    get:    { operationId: resourceGet,    tags: [resource] }
    patch:  { operationId: resourceUpdate, tags: [resource] }
    delete: { operationId: resourceDelete, tags: [resource] }
```

- `operationId`: camelCase, `{domain}{Action}` format
- `tags`: one tag per domain, matches endpoint file name
- `security: []` on public endpoints (register, login, forgot-password)
- Protected endpoints inherit global `security: [bearerAuth: []]`

## Current Structure

Inspect `docs/openapi.yaml` for the current endpoint and schema set — counts change as epics land.

## New Endpoint Checklist

- [ ] Path + method added to openapi.yaml
- [ ] Request/response schemas defined (reuse existing where possible)
- [ ] operationId assigned (camelCase)
- [ ] Tag assigned (matches endpoint file)
- [ ] Security set (public = `security: []`, protected = inherits global)
- [ ] Lint passes: `npx @redocly/cli lint docs/openapi.yaml`
- [ ] Types regenerated: `npx openapi-typescript ...`
- [ ] Zod schema uses `satisfies z.ZodType<ApiType>`
- [ ] Tests written (RED first — must fail before implementation)

## Common Mistakes

- Adding a server route without updating the spec first → spec drift
- Editing `client/src/api/types.ts` manually → gets overwritten on next generate
- Forgetting `security: []` on public endpoints → clients get 401
- Using `type: integer` for UUIDs → should be `type: string, format: uuid`
