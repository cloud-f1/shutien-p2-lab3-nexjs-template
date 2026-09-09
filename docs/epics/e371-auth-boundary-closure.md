# E371 — 認證邊界收口：鎖定完整性 · 身分綁定 · 帳號列舉

> Phase 89 · security · 🟢 **APPROVED — 使用者於 2026-09-09 依 code-review 結果核准**
> 來源：2026-09-09 `next-app/` 產品程式碼審查 F2 + F5 + F8 + F10

四件事共用同一批接線點（`actions/auth.ts` · `lib/auth.ts` · `lib/auth-provision.ts`），
併為一個 epic 以免互相衝突。

## Problem

### F5（本 epic 最重）—— 訪客結帳為未經證實的 email 預蓋已驗證章

`lib/auth-provision.ts:58`：

```ts
.values({
  email: normalized,
  passwordHash: null,
  // Purchase-email ownership is proven by receiving the activation mail.
  emailVerified: new Date(),
})
```

**註解描述的意圖，程式碼沒有實作。** `emailVerified` 是在**建立當下**蓋章，不是在啟用連結
被點擊時。而 `customerEmail` 直接來自訪客結帳表單，從未被證實。

攻擊：用最便宜的商品結帳，email 填 `victim@example.com`。受害者從此有一個自己沒開的帳號。
之後受害者自行註冊時，`registerUser`（`actions/auth.ts:88`）走「已存在 → 靜默跳過 insert」
的**不可列舉**分支 —— 不寄信、不報錯、直接導向 `/verify-email`，受害者在那裡永遠等不到信。
該 email 對自助註冊而言被永久佔用。

（受害者確實會收到當初的啟用信，所以這是**佔位／阻斷**而非帳號接管。但那個預蓋的
`emailVerified` 承擔了它沒賺到的信任。）

### F2 —— `resetPassword` 不清除鎖定狀態

`clearedLoginState()` 全專案只有兩個呼叫點（`lib/auth.ts:140`、`actions/auth.ts:214`），
**兩者都要求密碼比對成功**。`resetPassword`（`actions/auth.ts:366`）只寫
`{ passwordHash, updatedAt }`。

被鎖的使用者做出最自然的補救（忘記密碼 → 重設）後，用**正確的新密碼**仍會被
`loginAction` 的前置檢查擋下。

**嚴重度說明（審查初稿誇大，此處更正）**：`LOCKOUT_DURATION_MS = 15 * 60 * 1000`，且
`isLocked()` 過期即回 false、`nextFailedState()` 也會重置。這是**一個 15 分鐘的困惑窗口**，
不是永久鎖死，因此也**不需要**新增 admin 解鎖動作。修法是一行。

### F8 —— `resendVerificationEmail` 洩漏帳號存在

`actions/auth.ts:283-284`，註解與下一行直接矛盾：

```ts
// Don't reveal whether the email exists
if (!user?.passwordHash) return { success: true }
if (user.emailVerified) return { error: "此電子郵件已驗證。" }   // ← 洩漏
```

未知／OAuth email 回 `{ success: true }`，真實且已驗證的 credentials 帳號回明確錯誤。
攻擊者掃一份名單就能把「已註冊且已驗證」的使用者分離出來。對照 `requestPasswordReset`
（`:305`）—— 它是真正不可列舉的，寫法可直接沿用。

### F10 —— 2FA 挑戰只有記憶體限流，沒接上 E355 的持久化鎖定

`verifyTotpLogin` / `useBackupCode` 用 `rateLimitGuard("2fa:login:"+userId, 5, 15min)`。
其後端是 `lib/rate-limit.ts` 的 `Map`，該檔頭自己寫明「state is lost on restart and is NOT
shared across serverless instances or horizontally-scaled replicas」。

E355 為**密碼**因子引入 DB 欄位正是為了關掉這個弱點；**第二因子沒有跟上**。已握有密碼的
攻擊者可反覆呼叫 `loginAction`（正確密碼會重置 `failedLoginCount`）鑄造新的 pending-2FA
cookie，跨行程重啟／副本持續猜第二因子，全程沒有任何持久化紀錄。

## Solution

1. **F5**：`provisionUserForOrder` 建立新帳號時 `emailVerified: null`；改由啟用連結
   （既有的 password-reset token 流程）在被兌換時蓋章。同時檢查 `resendActivation`
   路徑是否受影響。
2. **F2**：`resetPassword` 的 UPDATE 併入 `clearedLoginState()`。
3. **F8**：`resendVerificationEmail` 對所有分支一律回 `{ success: true }`，比照
   `requestPasswordReset`；保留既有 60s 冷卻。
4. **F10**：失敗的 TOTP／備用碼嘗試也餵給 `nextFailedState()`，與密碼因子共用
   `failedLoginCount` / `lockedUntil`；受同一個 `ENABLE_LOGIN_LOCKOUT` 旗標控制
   （停用時完整 no-op，比照 E355 的語意）。

## Key Files

- `next-app/lib/auth-provision.ts`
- `next-app/actions/auth.ts`（`resetPassword` · `resendVerificationEmail` ·
  `verifyTotpLogin` · `useBackupCode`）
- `next-app/lib/auth-utils.ts`（若 2FA 接線需要新的純函式）

## Acceptance Criteria

1. 訪客以 `victim@example.com` 完成結帳 → 該 `users` 列的 `emailVerified` 為 **null**；
   點擊啟用連結後才變為非 null。
2. 承 (1)，受害者在啟用前自行註冊 → **會收到驗證信**（不再靜默無回應）。
3. 使用者被鎖後重設密碼 → 立即能以新密碼登入（不必等 15 分鐘）。測試須斷言
   `lockedUntil` 為 null。
4. `resendVerificationEmail` 對 {未知 email, OAuth-only 帳號, 已驗證帳號, 未驗證帳號}
   四種輸入回傳**位元組相同**的結果。
5. 連續 5 次錯誤 TOTP → `users.lockedUntil` 被寫入（持久化，非僅記憶體）；
   `ENABLE_LOGIN_LOCKOUT=false` 時完全不寫 DB。
6. E355／E356 既有測試全綠（本 epic 擴充其接線，不得改變密碼因子的既有行為）。
7. 2FA e2e（`e2e/two-factor.spec.ts`，6 個 spec）全綠。

## Cross-Epic

- 與 E367／E368／E370 檔案互斥，可並行。
- 觸及 auth 與 DB → publish 前的 `pre-merge-check.sh` **必須帶 `--e2e`**。

## Out of Scope

- 不新增 admin 解鎖動作（15 分鐘自動過期已足夠，見上）。
- 不把 `lib/rate-limit.ts` 換成 Redis。
