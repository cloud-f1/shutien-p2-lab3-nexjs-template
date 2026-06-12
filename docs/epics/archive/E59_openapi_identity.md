# E59 — OpenAPI Spec Identity Hardening

> **Phase**: 19 — Post-v1.0.0 Production Hardening
> **Priority**: P1 | **Points**: 3
> **Depends on**: None (independent)
> **Source**: Cycle 6 audit — OpenAPI description still says "investment tracker"

---

## Problem Statement

`docs/openapi.yaml` line 4: `description: Full-stack investment tracker — Auth & Identity Core (fastapi-users)`. This was the original app description before the template was generalized. The `info.version` is also `0.1.0` while the project is at `v1.0.0`. Template users who run `pnpm generate:types` get types with "investment tracker" in the description.

## Stories

### E59-S01: Update OpenAPI Metadata (2 pts)

**Task**: Update `docs/openapi.yaml` info section:
- `title`: Generic template name (e.g., `{{PROJECT_DISPLAY}} API`)
- `description`: Template-appropriate description
- `version`: `1.0.0`

**Acceptance Criteria**:
- Given `docs/openapi.yaml`
- When I read the `info` section
- Then no reference to "investment tracker" exists
- And `version` matches the project version (`1.0.0`)
- And description uses template placeholder pattern

### E59-S02: Regenerate Types + Verify (1 pt)

**Task**: Run `pnpm generate:types` and verify the generated types are clean.

**Acceptance Criteria**:
- Given updated OpenAPI spec
- When `pnpm generate:types` runs
- Then `client/src/api/types.ts` is updated without "investment tracker"
- And all client tests still pass
- And CI type-staleness check passes

## Risk Notes

- **Zero risk**: Metadata-only change, no endpoint modifications

## Dependency Chain

```
E59-S01 (update spec) → E59-S02 (regenerate types)
```
