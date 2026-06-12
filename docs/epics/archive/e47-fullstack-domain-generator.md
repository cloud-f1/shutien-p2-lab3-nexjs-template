# E47 — Full-Stack Domain Generator

> **Size**: M (13 SP) | **Priority**: P0 | **Phase**: 17
> **Dependencies**: none

---

## Problem Statement

`scripts/new-domain.sh` generates server-only code (model, schemas, endpoints, migration). No client scaffolding is created, making the "Claude Code-free" path incomplete. A beginner who runs `make new-domain NAME=notes` has no client-side starting point.

## Stories

### S1: Client Schema Generation
**Acceptance Criteria**:
- [ ] Generates `client/src/schemas/<name>.ts` with Zod schema + `satisfies` bridge
- [ ] Schema matches the generated server Pydantic schema structure
- [ ] Includes create/update/response schemas

### S2: Client Service + Hooks
**Acceptance Criteria**:
- [ ] Generates `client/src/api/services/<name>.ts` using `createService` factory
- [ ] Generates `client/src/hooks/use<Name>.ts` with list/detail/create/update/delete hooks
- [ ] Uses correct cache tier imports

### S3: Client Page + Route
**Acceptance Criteria**:
- [ ] Generates `client/src/pages/<name>/<Name>Page.tsx` with basic list view
- [ ] Adds route to `client/src/App.tsx` (protected route)
- [ ] Page uses existing design system CSS variables

### S4: MSW Handler + Test
**Acceptance Criteria**:
- [ ] Generates `client/src/tests/handlers/<name>.ts` MSW handler
- [ ] Generates basic test file for the page component
- [ ] Tests pass out of the box

### S5: Tutorial Integration
**Acceptance Criteria**:
- [ ] `scripts/tutorial.sh` updated to reference generated client files
- [ ] Tutorial step 3 ("explore generated code") lists both server and client files
- [ ] End-to-end flow works: generate domain → see it in browser

## Technical Notes

- Follow existing patterns: places/portfolios as reference implementations
- Use `createService` factory pattern (not manual Axios calls)
- PascalCase for component names, camelCase for hooks
- Generate `satisfies z.ZodType<ApiType>` bridge for drift detection
