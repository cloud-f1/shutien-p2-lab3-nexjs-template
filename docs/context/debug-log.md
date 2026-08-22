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

## 2026-08-22 — [GENERALIZABLE] 秒級時間戳的有效性競態，偽裝成不穩定測試

**症狀**：新增的回歸測試 6 次紅 1 次（約 17%）。失敗的永遠是同一條斷言，而且**同一次執行裡**
另一條讀同樣資料的斷言是綠的 —— 同樣的資料、兩條路徑、兩種答案。

**誤判風險**：實作者回報「21/21 綠」，因為它跑了一次。單次執行對 17% 的不穩定毫無鑑別力。

**根因**：不是測試瑕疵。判定式用秒級時間戳（`%Y-%m-%dT%H:%M:%SZ`）比較**兩個獨立產生的事件**
誰讓誰失效：`lastAcceptTs < lastSkipTs`。兩者落在同一秒 → 判定 A；跨秒 → 判定 B。
測試流程中間夾了一次 git clone，耗時剛好在秒邊界附近浮動。

**教訓（可泛化）**：
1. **秒級時間戳不可用於「誰讓誰失效」的判定。** 它適合視窗/門檻查詢（`.ts > cutoff`），
   因為門檻是計算出來的、不是另一個獨立事件。判定有效性時要用身分或明確的狀態，不要用時鐘。
2. **不穩定測試常是產品語意沒想清楚的徵狀**，不只是測試環境雜訊。先問「這兩條路徑為什麼會對
   同樣的資料給出不同答案」，再考慮加 retry。
3. **壓測要在對的層級**。整套 suite 跑一次看不出 17%；單獨對嫌疑檔案跑 20 次才看得出來。
4. 腳本若已支援 `CLOCK_TS` 之類的時鐘覆寫，測試就該用它把時間釘死 —— 讓測試斷言**選定的語意**，
   而不是賭時鐘對齊。
