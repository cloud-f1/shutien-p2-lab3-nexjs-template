# E97 — Testing Master Skill — 10 Principles Codified

> **Phase 28** | Priority: P0 | Points: 8 | Size: M
> **Depends on**: none

---

## Problem Statement

The project has mature testing infrastructure (conftest with 3-tier DI chain, MSW + createCrudHandlers, coverage gates 90%/80%) but lacks a **methodology layer**. The existing `tdd-workflow.md` skill covers RED-GREEN-REFACTOR mechanics but not the deeper testing principles: behavior-vs-implementation, triangulation, effective mocking boundaries, contract testing, and AI agent test guidelines.

`docs/test-master.md` (833 lines) contains all 10 principles but in tutorial format — too verbose, generic examples, not project-specific. Agents cannot operationalize it. This epic extracts the actionable value into a concise, project-specific skill that all agents auto-load when writing tests.

## Stories

### S1: Rewrite `tdd-workflow.md` with 10 Principles

**AC:**
- [ ] Skill file `.claude/skills/tdd-workflow.md` rewritten to include all 10 principles
- [ ] Content organized in 4 layers: Philosophy (A), Architecture (B), Boundary Control (C), Agent Rules (D)
- [ ] All examples use THIS project's patterns (FastAPI DI, MSW handlers, conftest fixtures)
- [ ] File organized in 4 layers, approximately 120–150 lines (concise, operational — not tutorial)
- [ ] Frontmatter `description` updated to trigger on test-related queries

### S2: Project-Specific Anti-Pattern Examples

**AC:**
- [ ] Each principle includes a "DO" and "DON'T" example from this codebase
- [ ] Examples reference real files: `server/tests/conftest.py`, `client/src/tests/handlers/`
- [ ] Triangulation examples use `@pytest.mark.parametrize` with real domain types (User, email, UUID)
- [ ] Mocking examples show correct boundary (mock `get_db`, never mock `UserService` methods)

### S3: Delete Tutorial Source

**AC:**
- [ ] `docs/test-master.md` deleted after skill extraction is verified
- [ ] No broken references to `test-master.md` in any other file

## Risk Notes

- Skill rewrite changes agent behavior globally — need to verify existing test commands still work correctly
- Skill must not be so prescriptive that it blocks legitimate test patterns

## Files to Touch

```
.claude/skills/tdd-workflow.md    — rewrite: merge 10 principles + RED-GREEN-REFACTOR
docs/test-master.md               — delete: tutorial absorbed into skill
```
