# E83 — Stop Verifier Enhancement

> **Phase 25** | Priority: P1 | Points: 5 | Size: S
> **Depends on**: none

---

## Problem Statement

The stop verifier (`stop-verifier.sh`) has 5 rules but gaps remain. OpenAPI drift (spec edited but types not regenerated), `console.log` residue in production client code, and large files (>500 lines) are not detected. These are core SDD and production-readiness rules.

## Stories

### S1: OpenAPI Drift Detection

**AC:**
- [ ] Detect when `docs/openapi.yaml` was modified in the current session but `client/src/types/` was not updated
- [ ] Check git diff for openapi.yaml changes vs types file changes
- [ ] Block (exit 2) if drift detected
- [ ] Message: "OpenAPI spec changed but types not regenerated. Run type generation first."

### S2: Console.log Residue Check

**AC:**
- [ ] Scan `client/src/` for `console.log` statements (excluding test files)
- [ ] Exclude `*.test.*` and `*.spec.*` files
- [ ] Exclude legitimate logging (e.g., error handlers with `console.error`)
- [ ] Block (exit 2) if `console.log` found in production source files
- [ ] Message: "console.log found in {file}:{line}. Remove before shipping."

### S3: Large File Warning

**AC:**
- [ ] Detect newly created or modified files > 500 lines
- [ ] Warn (non-blocking) — do NOT exit 2
- [ ] Message: "Warning: {file} is {N} lines. Consider splitting."
- [ ] Exclude generated files, lock files, and documentation

### S4: Update Hook Documentation

**AC:**
- [ ] Update `scripts/hooks/CLAUDE.md` with 3 new rules
- [ ] Update rule count reference (5 → 8 rules)

## Risk Notes

- Low risk — adding rules to existing verifier pattern
- Uses the existing retry verifier pattern (4 retries → 99% success)
- OpenAPI drift check may need tuning to avoid false positives during spec-only changes

## Files to Touch

```
scripts/hooks/stop-verifier.sh     — add 3 rules
scripts/hooks/CLAUDE.md            — documentation
```
