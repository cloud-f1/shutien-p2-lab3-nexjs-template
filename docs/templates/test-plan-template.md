# {{PROJECT_NAME}} — Test Plan

> Copy this template into your project and replace all `{{...}}` placeholders.
> Companion template: `manual-test-checklist.md` (E152) for pre-release manual QA.

---

## 1. Test Pyramid

```
        ┌───────────┐
        │  Manual /  │   ~5%   — Exploratory, UX, accessibility
        │  E2E       │
        ├───────────┤
        │Integration │   ~20%  — API contracts, DB, auth flows
        ├───────────┤
        │            │
        │   Unit     │   ~75%  — Pure logic, hooks, utilities
        │            │
        └───────────┘
```

| Layer       | Scope                                  | Target Count | Tools                          |
|-------------|----------------------------------------|--------------|--------------------------------|
| Unit        | Pure functions, hooks, reducers, models | 60–75%       | pytest / Vitest                |
| Integration | API endpoints, DB queries, auth flows  | 20–30%       | httpx (TestClient) / MSW       |
| E2E         | Critical user journeys                 | 3–5 flows    | Playwright (optional)          |
| Manual      | Exploratory, UX, a11y                  | Per release   | See `manual-test-checklist.md` |

---

## 2. Risk Matrix

> Rank each domain risk by **Likelihood x Impact**. Focus testing effort on HIGH-severity items first.

| # | Risk                                         | Likelihood | Impact | Severity | Mitigation (Test Strategy)                |
|---|----------------------------------------------|------------|--------|----------|-------------------------------------------|
| 1 | Auth bypass — token forgery or replay        | LOW        | HIGH   | **HIGH** | Contract tests on JWT validation + E2E login flow |
| 2 | Payment double-charge                        | MED        | HIGH   | **HIGH** | Idempotency key tests + integration with payment mock |
| 3 | RBAC escalation — user accesses admin route  | MED        | HIGH   | **HIGH** | RBAC matrix tests (see Section 3)         |
| 4 | Data loss on migration                       | LOW        | HIGH   | **MED**  | Migration rollback tests + DB snapshot     |
| 5 | Stale cache returns wrong data               | MED        | MED    | **MED**  | Cache invalidation integration tests       |
| 6 | Form validation bypass (client-side only)    | HIGH       | LOW    | **MED**  | Server-side validation unit tests          |
| 7 | Slow query under load                        | LOW        | MED    | **LOW**  | Query plan review + optional load test     |

> **Customize**: Replace or extend rows above with risks specific to {{DOMAIN_LIST}}.
> Severity guide: `HIGH` = Likelihood HIGH+Impact HIGH or MED+HIGH; `MED` = mixed; `LOW` = both low.

---

## 3. RBAC Compatibility Matrix

> Roles as columns, actions as rows. Mark each cell: `Y` (allowed), `N` (denied), `—` (N/A).
> Each `Y`/`N` cell should have a corresponding test assertion.

| Action                          | Anonymous | User  | Admin | Superuser |
|---------------------------------|-----------|-------|-------|-----------|
| View public content             | Y         | Y     | Y     | Y         |
| Create own resource             | N         | Y     | Y     | Y         |
| Edit own resource               | N         | Y     | Y     | Y         |
| Delete own resource             | N         | Y     | Y     | Y         |
| View other users' resources     | N         | N     | Y     | Y         |
| Edit other users' resources     | N         | N     | Y     | Y         |
| Delete other users' resources   | N         | N     | N     | Y         |
| Access admin dashboard          | N         | N     | Y     | Y         |
| Manage users (CRUD)             | N         | N     | N     | Y         |
| Change system settings          | N         | N     | N     | Y         |

> **Customize**: Add or remove roles and actions for {{PROJECT_NAME}}.
> Generate test cases programmatically with `@pytest.mark.parametrize` over this matrix.

---

## 4. Coverage Targets

| Layer   | Target | Rationale                                                        |
|---------|--------|------------------------------------------------------------------|
| Server  | >= 90% | API boundary code is critical — auth, validation, business logic |
| Client  | >= 80% | UI code has diminishing returns past 80% (layout, animations)    |
| Overall | >= 80% | Hard gate — blocks deploy if coverage drops below threshold      |

### Why 90% server / 80% client?

- **Server 90%**: Every API endpoint is a trust boundary. Untested server code means untested security, data integrity, and contract compliance. The 10% margin covers generated code, config files, and defensive branches that are hard to trigger in tests.
- **Client 80%**: UI testing has diminishing returns — snapshot brittleness, layout-only code, animation timing. The 20% margin covers CSS-driven components, third-party widget wrappers, and error boundaries that require complex mocking.
- **Coverage is a floor, not a ceiling**: High-risk areas (auth, payments, RBAC) should aim for 95%+, regardless of the global target.

### Measuring Coverage

```bash
# Server
cd server && uv run pytest --cov=app --cov-report=term-missing

# Client
cd client && pnpm test:coverage
```

---

## 5. When to Stop Testing

> Testing is "done enough" when **all** of the following criteria are met.
> This prevents both under-testing (shipping bugs) and gold-plating (never shipping).

### Quantitative Criteria

| # | Criterion                                    | Threshold               | How to Verify                         |
|---|----------------------------------------------|-------------------------|---------------------------------------|
| 1 | Coverage gates pass                          | Server >= 90%, Client >= 80% | CI coverage report                |
| 2 | All HIGH-severity risks have dedicated tests | 100% of HIGH rows covered | Cross-reference Risk Matrix (Sec 2)  |
| 3 | RBAC matrix fully tested                     | Every Y/N cell asserted  | Count parametrized test cases         |
| 4 | Zero known P0/P1 bugs open                   | 0 open critical/high bugs | Issue tracker query                  |
| 5 | Contract tests pass                          | All API responses match OpenAPI spec | `pytest tests/contract/`     |

### Qualitative Criteria (Secondary)

- **Exploratory testing** completed for new features (at least one session per epic)
- **Edge cases** documented even if not automated (added to `manual-test-checklist.md`)
- **No regression** in existing test suite (zero new failures introduced)

### When to Add More Tests (Post-GA)

- A production bug is found — add a regression test **before** fixing
- A new domain is added — extend Risk Matrix and RBAC Matrix
- Coverage drops below threshold on any PR — CI blocks merge automatically

---

## Appendix: Template Variables

| Placeholder        | Replace With                                    |
|--------------------|-------------------------------------------------|
| `{{PROJECT_NAME}}` | Your project's display name                     |
| `{{DOMAIN_LIST}}`  | Comma-separated list of domains (e.g. billing, teams, places) |

---

*Template source: [ai-coding-template](https://github.com/anthropics/ai-coding-template) E151*
*Companion: E152 — Manual Test Checklist Template*
