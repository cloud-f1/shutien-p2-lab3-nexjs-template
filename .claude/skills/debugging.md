---
name: debugging
description: >
  Quick debugging reference for common issues in this project. Use this skill when tests
  fail, server errors appear, client rendering breaks, or when someone encounters an error
  message they don't understand. Also use when investigating build failures, import errors,
  migration issues, or auth flow problems. Provides fast-lookup failure patterns and
  diagnostic commands.
---

# Debugging — AI-Coding-Template

## Quick Diagnosis Commands

```bash
# Server
pytest tests/ -x --tb=short              # Stop at first failure, short traceback
pytest tests/ -k "test_name" -s          # Run specific test with print output
alembic current                           # Check migration version
alembic history                           # List all migrations

# Client
pnpm test:run -- --reporter=verbose       # Detailed test output
pnpm typecheck                            # TypeScript errors
npx @redocly/cli lint docs/openapi.yaml   # OpenAPI spec validation
```

## Known Failure Patterns

### Server

| Symptom | Root Cause | Fix |
|---|---|---|
| `from jose import jwt` | python-jose referenced | `import jwt` (PyJWT) |
| `RuntimeError: event loop already running` | `asyncio.run()` in async context | Use `await` directly |
| `alembic: not up to date` | Migration not applied | `alembic upgrade head` |
| `NoResultFound` in user lookup | User not in test DB | Create user in test fixture first |
| `401 Unauthorized` on protected route | Missing `Depends(current_active_user)` | Add dependency |
| Test passes alone, fails in suite | Shared state between tests | Ensure `db` fixture rolls back |
| `IntegrityError: UNIQUE constraint` | Duplicate email in tests | Use unique emails per test |
| `AttributeError: 'coroutine'` | Missing `await` on async call | Add `await` |
| Coverage low on async code | Missing concurrency config | `concurrency = ["greenlet", "thread"]` |

### Client

| Symptom | Root Cause | Fix |
|---|---|---|
| `[MSW] Warning: no handler` | New endpoint missing mock | Add handler in `src/tests/handlers/` |
| `tokenCache.get()` always null | `set()` never called after login | Check login flow calls `setAccessToken` |
| Stale UI after mutation | Missing invalidation | Add `onSettled: qc.invalidateQueries(...)` |
| Test: "not wrapped in act" | Async state update not awaited | Use `waitFor` or `findBy*` queries |
| Test: element not found | Rendered before data loads | Use `findByText` (async) not `getByText` |
| `VITE_API_URL` undefined | Env not set before build | Set in `.env` or Zeabur before `pnpm build` |
| Auth redirect loop | `ProtectedRoute` using non-reactive check | Use `useAuthStore`, not `getAccessToken()` |
| Type error after spec change | Types not regenerated | Run `npx openapi-typescript docs/openapi.yaml --output client/src/api/types.ts` |

### Build & Deploy

| Symptom | Root Cause | Fix |
|---|---|---|
| `pnpm build` fails | Type errors or missing deps | Run `pnpm typecheck` first |
| Docker build fails | Lock file mismatch | Run `pnpm install` at root, commit lock |
| Zeabur deploy hangs | Migration timeout | Check `DATABASE_URL` is correct |
| Health check returns "degraded" | DB connection failed | Verify PostgreSQL is running |

## Debug Strategy

1. **Read the error message carefully** — most errors are self-explanatory
2. **Check `docs/context/debug-log.md`** — might be a known pattern
3. **Isolate** — run the single failing test with `-x -s` flags
4. **One hypothesis at a time** — test it before moving to the next
5. **Minimum fix** — address root cause, don't refactor during debugging
6. **Verify** — re-run the original failing command
7. **Log it** — if generalizable, tag `[GENERALIZABLE]` in debug-log.md
