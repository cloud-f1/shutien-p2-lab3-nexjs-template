# docs/specs/ — Feature Specifications

This folder holds non-epic implementation plans produced by @spec-writer.
**Epic specs** (e{n}-*.md) are now in `docs/epics/` alongside EPIC_INDEX.md.

## Conventions

- Non-epic specs: `<feature-slug>.md` (e.g., `auth-register.md`)
- Epic specs: `docs/epics/e{n}-{slug}.md` (e.g., `e16-security-hardening.md`)
- Created by: `/athena:spec "<feature description>"` → @spec-writer
- Consumed by: `/athena:implement` command reads the spec before coding

## Spec Format (required sections)

1. **Goal** — one-sentence purpose
2. **OpenAPI Changes** — endpoints, schemas, error codes to add/modify
3. **Server Implementation** — models, routes, business logic
4. **Client Implementation** — components, hooks, state management
5. **Test Plan** — specific test cases for both suites
6. **Acceptance Criteria** — checkboxes for done definition

## Rules

- OpenAPI changes are listed in the spec but applied to `docs/openapi.yaml` FIRST
- Specs are **immutable after approval** — create a new spec for changes
- @spec-writer validates openapi.yaml after every edit (post-spec-openapi-lint hook)
