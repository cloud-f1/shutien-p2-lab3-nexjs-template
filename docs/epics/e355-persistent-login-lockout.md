# E355 — 持久登入鎖定（移植 fork E324，適配模板的三條密碼路徑）

> Phase 86 · Size M · 來源：fork `../ai-rc-engineer-pm` E324（已實作並合併，commit `ce79825`）
> Status: 🟢 **APPROVED — approved by the user on 2026-08-27**

## Problem

模板目前**只有記憶體節流**（`lib/rate-limit.ts`，`loginAction` 內以 email + IP 兩個桶計數），
行程重啟即失效。`users` 表沒有 `failedLoginCount` / `lockedUntil` 欄位，`lib/auth-utils.ts`
只有 OAuth provider 標籤，完全沒有鎖定邏輯。

重啟即歸零代表：攻擊者只要能觸發部署／重啟（或單純等 serverless 實例回收），節流就重置。

## 移植風險：模板有三條密碼驗證路徑，fork 只有一條

Fork 的 `authorizeCredentials` 是唯一入口，直接在裡面計數即可。模板不是：

| # | 位置 | 何時走這條 | 若只改 authorize 會怎樣 |
|---|---|---|---|
| 1 | `lib/auth.ts` authorize 標準路徑（`comparePassword` @ :65）| **非 2FA** 使用者 | ✅ 會計數 |
| 2 | `actions/auth.ts` loginAction 的 2FA 分支（`comparePassword` @ :137）| **已啟用 2FA** 使用者 | 🔴 **完全不計數** |
| 3 | `actions/auth.ts` verifyTotpLogin | TOTP 碼（非密碼）| 已有獨立節流，不在本 epic |

**所以直接照抄會留下一個洞：對已啟用 2FA 帳號的密碼暴力破解不會觸發持久鎖定。**
路徑 2 之所以存在，是因為 2FA 使用者的 `authorize()` 走 nonce 路徑，密碼是在 loginAction 驗的。

本 epic 明確要求**兩條密碼路徑都接線**，並各自有測試證明。

## 可開關（使用者要求 2026-08-27）

鎖定必須能**逐環境開啟／關閉**，且不需重新建置。

- **旗標**：`ENABLE_LOGIN_LOCKOUT` —— **不加** `NEXT_PUBLIC_` 前綴，因此是
  **server-side runtime env**（CLAUDE.md 的 runtime-vs-build-time 分類）：在 Zeabur／Cloud Run
  改完下一個 request 就生效，**無需 rebuild**。
- **預設：開啟**（secure by default）。只有明確設為 `false`／`0`／`off` 才停用。
  安全控制若預設關閉，實務上就等於永遠不會被開啟。
- **停用時必須是完整 no-op** —— 比照模板既有的 Sentry 慣例（`SENTRY_DSN` 未設 →
  `instrumentation.ts` 完全不動作）：不計數、不鎖定、**不寫任何 DB**。

### 非顯而易見的語意決定：停用必須同時「解鎖」

停用時，`isLocked()` 對**既有的** `lockedUntil` 也必須回傳 false。

理由：操作者會去關這個旗標，多半正是因為**有人被鎖在外面出不來**。若關閉後仍尊重既存的
`lockedUntil`，這個旗標就不是逃生口，被鎖的使用者還是得等滿 15 分鐘 —— 那就失去了開關的意義。
欄位值保留在 DB（不清除），重新啟用後即恢復原本語意。

旗標的解析抽成純函式 `isLockoutEnabled(raw)`，讓「什麼字串算關閉」只有一個定義且可單元測試。

## Solution

1. **schema** — `users` 加 `failedLoginCount integer not null default 0`
   + `lockedUntil timestamptz null` + migration。
2. **`lib/auth-utils.ts` 純函式**（可無 DB 單元測試，直接移植 fork 版，領域中立）：
   - `isLockoutEnabled(raw = process.env.ENABLE_LOGIN_LOCKOUT)` —— 預設 true；`false`/`0`/`off`（不分大小寫）為 false
   - `MAX_FAILED_LOGIN_ATTEMPTS = 5` / `LOCKOUT_DURATION_MS = 15 * 60 * 1000`
   - `isLocked(user, now)` —— 有 `lockedUntil` 且仍在未來
   - `nextFailedState(user, now)` —— 一次失敗後的下一個狀態；**先前的鎖已過期則計數重新起算**
   - `clearedLoginState()` —— 成功登入的歸零形狀
3. **接線（兩處）**：
   - `lib/auth.ts` — 抽出具名的 `authorizeCredentials()`（使其可在不啟動 NextAuth 的情況下測試），
     鎖定檢查放在 **bcrypt 之前**（被鎖的帳號不做昂貴雜湊）；密碼錯 → 寫入 `nextFailedState`；
     成功 → 若有累積則寫入 `clearedLoginState()`。
   - `actions/auth.ts` loginAction 的 2FA 分支 — 同樣三件事，並在 pre-check 對已鎖帳號回傳友善訊息。
4. **旗標接線** —— 兩條路徑在進入任何計數／鎖定邏輯前先問 `isLockoutEnabled()`；
   為 false 時直接沿用原本行為（僅記憶體節流），不做任何額外 DB 寫入。
5. **`.env.example`** —— 在 runtime 區塊記錄 `ENABLE_LOGIN_LOCKOUT`，
   註明預設開啟、設 false 停用且**會同時解除既有鎖定**。
6. **既有記憶體節流保留** —— 它是第一層（含 IP 桶，鎖定是 per-user 的），本 epic 加的是第二層。

## Key Files

- `next-app/lib/schema/auth.ts` + `next-app/drizzle/migrations/` — 兩欄 + migration
- `next-app/lib/auth-utils.ts` + `.test.ts` — 純決策層
- `next-app/lib/auth.ts` — 抽出 `authorizeCredentials` + 接線（路徑 1）
- `next-app/actions/auth.ts` — loginAction 2FA 分支接線 + 鎖定 pre-check（路徑 2）
- `next-app/test/int/auth-lockout.int.test.ts` — 對真實 DB 驗證持久性

## Acceptance Criteria

1. 連續 5 次密碼錯誤 → 第 6 次被擋，且**不執行 bcrypt**（鎖定檢查在比對之前）。
2. **鎖定跨行程重啟仍有效** —— 以整合測試對真實 DB 驗證欄位確實寫入。
3. 成功登入後 `failedLoginCount` 歸零、`lockedUntil` 清空。
4. 鎖定視窗過後可再嘗試，且計數**重新起算**（不是從第 5 次繼續）。
5. **2FA 使用者的密碼錯誤同樣計數並鎖定** —— 專屬測試覆蓋路徑 2，
   紅綠證明：移除該接線後測試轉紅。
6. 純函式單元測試涵蓋邊界（剛好 4 次不鎖、第 5 次鎖、鎖過期後重新起算、null 使用者）。
7. `ENABLE_LOGIN_LOCKOUT=false` → 連續 10 次密碼錯誤**不**鎖定，且
   `users.failed_login_count` / `locked_until` **完全沒有被寫入**（以整合測試斷言欄位未變動）。
8. `ENABLE_LOGIN_LOCKOUT=false` 時，**既有的 `lockedUntil` 也不再擋人**（逃生口語意），
   且欄位值保留不清除；重新設為 true 後恢復擋人。
9. `isLockoutEnabled()` 單元測試涵蓋：未設定 → true；`"false"`/`"0"`/`"off"`/`"FALSE"` → false；
   `"true"`/其他字串 → true。
10. 既有 auth / 2FA e2e 全數維持綠燈（51/51）。

## Out of Scope

- 首登強制改密（fork 亦已 descope）。
- 帳號永久停用（模板已有 `status` 機制）。
- TOTP 挑戰本身的鎖定（`verifyTotpLogin` 已有獨立節流）。
