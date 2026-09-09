# E373 — e2e 種子狀態隔離：讓 teardown 失敗不會污染下一輪

> Phase 90 · infra/test · 🟢 **APPROVED — 2026-09-09**

## Problem

Phase 89 期間，e2e **被同一個坑擊倒三次**，每次都花掉一輪完整的閘門執行時間去證明
「不是我的 epic 造成的」。

機制在 `next-app/e2e/two-factor.spec.ts` 自己的註解裡已經寫過一半：

```ts
test.afterAll(async ({ browser }) => {
  if (!capturedSecret) return          // ← 這一行是引信
  ...
})
```

`capturedSecret` 由該檔**第一個測試**擷取。只要該檔任何一個測試先失敗（或整輪被
中斷），`capturedSecret` 為空 → teardown 直接 return → **2FA 留在
`editor@example.com` 上**。下一輪所有以 editor 密碼登入的 spec 都會被導向
`/login/2fa` 而逾時。

實測的自我放大：第一次 11 個失敗 → 下一次 16 個失敗。每次都要
`pnpm db:e2e-setup`（drop → create → migrate → seed）才能回到 51/51。

**為什麼 CLAUDE.md 的既有說明不足**：它已經寫了「e2e uses its OWN database」與
drop 的理由，但那是**跑之前**的保證。這裡的問題是**跑之後**留下的狀態，而
下一輪不會自動重建 DB。

## Solution（方向，實作時再定案）

候選做法，實作前應先比較：

1. **teardown 不依賴測試擷取的 secret** —— 直接對 DB 下
   `UPDATE users SET totp_enabled=false, totp_secret=null, backup_codes=null`，
   放在 `globalTeardown` 而非 spec 的 `afterAll`。最直接，但讓 e2e 多一條 DB 依賴。
2. **2FA 測試改用專屬帳號** —— 不碰 `editor@example.com`，用該 spec 自己建立、
   自己刪除的使用者。污染面積歸零，但要處理帳號建立的前置。
3. **`globalSetup` 主張乾淨起點** —— 若偵測到任何種子帳號 `totp_enabled=true`，
   直接 abort 並提示重建（比照 E357 的目標身分檢查姿態：寧可明確失敗，
   不要靜默測錯）。

(1)+(3) 或 (2)+(3) 的組合最可能是對的：修掉來源，同時讓殘留變成**大聲的失敗**
而非一批看似隨機的逾時。

## Acceptance Criteria

1. 人為讓 `two-factor.spec.ts` 的第一個測試失敗，整輪結束後
   `editor@example.com` 的 `totp_enabled` 仍為 `false`。
2. 承 (1)，緊接著再跑一次完整 e2e → 51/51（不需重建 DB）。
3. 若起點被污染（手動把 `totp_enabled` 設為 true），該輪以**明確訊息**失敗，
   而不是產出一批 30 秒逾時。
4. 不得延長正常路徑的執行時間超過 10%。

## Out of Scope

- 不重寫 2FA 的產品程式碼（E297/E371 的行為不變）。
