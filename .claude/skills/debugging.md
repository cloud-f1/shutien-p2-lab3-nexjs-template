---
name: debugging
description: >
  Quick debugging reference for common issues in this project. Use this skill when tests
  fail, server errors appear, rendering breaks, or when someone encounters an error
  message they don't understand. Also use when investigating build failures, import errors,
  migration issues, or auth flow problems. Provides fast-lookup failure patterns and
  diagnostic commands.
---

# Debugging — AI-Coding-Template

## Quick Diagnosis Commands

```bash
# Unit tests (Vitest)
cd next-app && pnpm test -- --reporter=verbose   # Detailed test output
cd next-app && pnpm test -- --run -t "test name" # Run specific test

# E2E tests (Playwright)
cd next-app && pnpm test:e2e                     # Run all e2e tests
cd next-app && pnpm test:e2e --debug             # Debug mode

# Type checking
cd next-app && pnpm typecheck                    # TypeScript errors

# DB migrations (Drizzle)
cd next-app && pnpm db:generate                  # Generate migration from schema
cd next-app && pnpm db:migrate                   # Apply pending migrations
```

## Known Failure Patterns

### Server (Next.js Route Handlers / Server Actions)

| Symptom | Root Cause | Fix |
|---|---|---|
| `NEXT_AUTH` session undefined in Server Component | Not calling `auth()` from Auth.js v5 | Import `auth` from `next-app/auth.ts` and `await auth()` |
| `401 Unauthorized` on API Route | Missing `auth()` session check | Guard route with session check and return `NextResponse.json({}, {status:401})` |
| Drizzle query fails silently | Missing `await` on async DB call | Add `await` before `db.select(...)` / `db.insert(...)` |
| `DATABASE_URL` undefined at runtime | Env var missing or wrong prefix | Check `next-app/.env.local`; server vars need no `NEXT_PUBLIC_` prefix |
| Migration not applied | Schema changed but `db:migrate` not run | Run `pnpm db:generate && pnpm db:migrate` |
| Server Action "use server" error | Missing directive or wrong file boundary | Add `"use server"` at top of file or function |
| `UNIQUE constraint` on insert | Duplicate record | Check existing rows before insert or use `onConflictDoUpdate` |

### Client (React / Next.js)

| Symptom | Root Cause | Fix |
|---|---|---|
| Hydration mismatch | Server/client render differs | Remove browser-only APIs from Server Components; use `"use client"` |
| Auth redirect loop | `middleware.ts` matcher misconfigured | Check `next-app/middleware.ts` matcher patterns |
| Test: element not found | Rendered before data loads | Use `findByText` (async) not `getByText` |
| Test: "not wrapped in act" | Async state update not awaited | Use `waitFor` or `findBy*` queries |
| `NEXT_PUBLIC_*` undefined | Env not set before build | Set in `next-app/.env.local`; baked at build time |
| Dark mode flicker | Theme applied after hydration | Ensure `next-themes` is configured with `attribute="class"` |
| shadcn component missing | Not installed | Run `npx shadcn@latest add <component>` from `next-app/` |

### Build & Deploy

| Symptom | Root Cause | Fix |
|---|---|---|
| `pnpm build` fails | Type errors or missing deps | Run `pnpm typecheck` first |
| Zeabur deploy hangs | Migration timeout or bad `DATABASE_URL` | Check `DATABASE_URL` env var in Zeabur; run `pnpm db:migrate` manually |
| Health check fails | DB connection failed | Verify PostgreSQL is running and `DATABASE_URL` is reachable |
| Image not found | Next.js Image `domains` not configured | Add domain to `next.config.ts` `images.remotePatterns` |

## Debug Strategy

1. **Read the error message carefully** — most errors are self-explanatory
2. **Check `docs/context/debug-log.md`** — might be a known pattern
3. **Isolate** — run the single failing test by name
4. **One hypothesis at a time** — test it before moving to the next
5. **Minimum fix** — address root cause, don't refactor during debugging
6. **Verify** — re-run the original failing command
7. **Log it** — if generalizable, tag `[GENERALIZABLE]` in debug-log.md
