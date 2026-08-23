# E346 — `recordUsage` 未驗證寫入路徑（安全修補）

> Phase 84 · fix/security · Cycle 38（/athena:audit 2026-08-22 發現）
> Status: ⬜ pending
> Depends: none

## Problem

`next-app/actions/usage.ts` 檔頭是 `"use server"` —— **每個匯出函式都是任何客戶端都能
POST 的公開端點**，不只是內部 helper。

```ts
export async function recordUsage(metric: string, delta = 1, userId?: string) {
  let ownerId = userId
  if (!ownerId) {                    // ← 只有省略 userId 時才驗證
    const session = await requireAuth()
    ...
    ownerId = session.user.id
  }
  // ownerId 直接寫入 usage_events
}
```

傳入 `userId` 時 `requireAuth()` **完全不執行** —— 沒有 session 檢查、沒有擁有權檢查、
沒有任何守衛。未驗證的呼叫端可以替**任意使用者**偽造 `usage_events` 列。

影響：`usage_events` 是 `getCurrentMonthUsage()` 的資料來源，驅動用量計費與配額顯示
（`lib/usage-utils.ts`）。偽造寫入可以灌爆他人配額或扭曲計費基礎。

這**不是**擁有權範圍化的模式 —— 那個分支裡根本沒有任何範圍檢查。已對照兩個守衛家族
（`lib/permissions.ts` 與 `defineAction()`），兩者都未在該分支被呼叫。

唯一的正當呼叫端是 `app/api/v1/items/route.ts:145`（Route Handler，傳 API-key 解析出的
`auth.userId`）。**那個路徑本身是對的** —— 錯在把內部用途的參數暴露在公開 action 的簽章上。

## Solution

分離內部函式與公開 action，比照本 repo `lib/*`（內部）vs `actions/*`（surface）的既有慣例：

1. **`next-app/lib/usage.ts`**（新，**不含** `"use server"`）—— `recordUsageFor(userId, metric, delta)`。
   純內部函式，呼叫端自己負責已完成授權。檔頭註解明寫：**此函式信任呼叫端已驗證 `userId`，
   只能從 Route Handler 或其他 server 端情境呼叫，永遠不要從 `"use server"` 檔案原樣重新匯出。**
2. **`next-app/actions/usage.ts`** —— `recordUsage(metric, delta)`：**移除 `userId` 參數**，
   一律 `requireAuth()` 取 session 使用者，再委派給 `recordUsageFor`。
3. **`app/api/v1/items/route.ts:145`** 改呼叫 `recordUsageFor(auth.userId, "api_request", 1)`。
   該處的 API key 驗證維持不變。
4. 若有其他 `"use server"` 檔案存在同形狀（可選的 `userId`/owner 參數繞過守衛），一併列出並修正。

## Key Files
- `next-app/lib/usage.ts`（新）+ `lib/usage.test.ts`（新）
- `next-app/actions/usage.ts`（收窄簽章）
- `next-app/app/api/v1/items/route.ts`（改呼叫內部函式）
- `next-app/test/int/usage.int.test.ts`（既有測試傳 `userId` 給 action，需改指內部函式）

## Acceptance Criteria
- [ ] `actions/usage.ts` 匯出的 `recordUsage` **不再接受 `userId`**；型別層即不可能傳入
- [ ] `recordUsage` 一律先 `requireAuth()`，未登入回錯誤且**不寫入任何列**
- [ ] **回歸測試證明漏洞已封**：模擬未驗證情境呼叫 action 並企圖指定他人 `userId` ——
      必須被拒絕。以紅綠實證：還原修正 → 測試變紅；套用修正 → 綠
- [ ] `/api/v1/items` 的用量計數行為不變（API key 驗證後仍正確歸戶），既有 int 測試調整後通過
- [ ] `lib/usage.ts` 檔頭明寫信任邊界與「不得從 `"use server"` 檔案重新匯出」
- [ ] 掃過所有 `"use server"` 檔案，確認無其他「可選 owner 參數繞過守衛」的同形狀（附掃描結果）
- [ ] typecheck / lint / unit / int 綠

## Cross-Epic
- `security-audit` skill — Server Actions 是公開 POST 端點，此案例值得補進該 skill 的檢查清單
- E345 關卡帳本 — 本 epic 的關卡結果應留帳

## Out of Scope
- 用量計費本身的邏輯變更
- 為 `usage_events` 加 rate limiting（另議）
