# Debug Log — @debugger
> **Tier 1 Project Memory** · Owner: `@debugger`  
> Updated on each bug resolution. Promote generalizable root causes to template memory.

---

## Current State

**No bugs formally logged** — 102 epics implemented through Phase 28 without @debugger escalation.
Last verified: 2026-03-30

---

## Pre-Loaded Failure Patterns

The following are pre-loaded from architecture decisions and known FastAPI+React failure modes.  
**@debugger checks these first** before running full root cause analysis — saves time on common bugs.

### Pattern 1: Wrong JWT Library Import
```
Symptom: Token validation fails silently, or "from jose" AttributeError
Root cause: Using python-jose instead of PyJWT
Fix: Replace `from jose import jwt` with `import jwt`
     Replace `from jose.exceptions import ...` with `from jwt.exceptions import ...`
Verify: python -c "import jwt; print(jwt.__version__)"  # should be 2.9+
```

### Pattern 2: asyncio Event Loop Error
```
Symptom: RuntimeError: no running event loop / can't run nested event loop
Root cause: asyncio.run() called inside an async context
Fix: Remove asyncio.run(), use `await` directly
     In tests: asyncio_mode = "auto" in pyproject.toml handles this
```

### Pattern 3: Stale UI After Mutation
```
Symptom: Data in UI doesn't update after successful POST/PUT/DELETE
Root cause: React Query cache not invalidated after mutation
Fix: Add to mutation's onSettled:
     queryClient.invalidateQueries({ queryKey: queryKeys.[resource] })
```

### Pattern 4: MSW Handler Missing
```
Symptom: "[MSW] Warning: captured a request without a matching request handler"
Root cause: New endpoint added but no MSW handler in src/tests/handlers/
Fix: Add handler to the appropriate handlers file:
     rest.post('/api/v1/auth/register', resolver)
```

### Pattern 5: Alembic Drift
```
Symptom: "Target database is not up to date" / columns missing in prod
Root cause: Migration file exists but not applied, OR model changed without migration
Fix: alembic upgrade head  (apply pending)
     alembic revision --autogenerate -m "describe_change"  (generate missing)
Verify: alembic current  (should show head)
```

### Pattern 6: tokenCache Always Returns null
```
Symptom: Every request triggers token refresh; 401 loop
Root cause: tokenCache.set() not called after successful login/refresh
Fix: Ensure auth mutation's onSuccess calls tokenCache.set(accessToken)
     Check: tokenCache.get() returns token immediately after set()
```

### Pattern 7: bcrypt Import Error
```
Symptom: AttributeError / ImportError on password hashing
Root cause: Using passlib syntax with direct bcrypt library
Fix: Replace CryptContext usage:
     pwd_context.hash(password) → bcrypt.hashpw(password.encode(), bcrypt.gensalt())
     pwd_context.verify(plain, hashed) → bcrypt.checkpw(plain.encode(), hashed)
```

### Pattern 8: Pydantic v2 Validator Syntax
```
Symptom: PydanticUserError or validators not running
Root cause: Using Pydantic v1 @validator syntax in v2 project
Fix: Replace @validator with @field_validator
     Replace @root_validator with @model_validator
     Replace orm_mode=True with model_config = ConfigDict(from_attributes=True)
```

---

## Resolved Bugs

*(none yet — entries appear here after each bug fix)*

<!-- Template:
## debugger — [ISO timestamp]
Branch: [branch] | Bug: [1-line description]

### Root Cause
[paragraph — what broke and exactly why]

### Fix Applied
File: [path:line]
Before: [code]
After: [code]

### Verification
Command: [exact command]
Result: ✅ passes / ❌ still failing (new hypothesis)

### Prevention
[new test or lint rule to prevent recurrence]

### Promote?
[GENERALIZABLE: applies to any FastAPI+React project]
[PROJECT-SPECIFIC: only relevant to AI-Coding-Template domain]
-->
<!-- debugger stopped at 2026-03-06T15:54:40Z -->
<!-- [2026-03-06T15:54:49Z] VERIFY PASS: pytest tests/test_auth.py -->
