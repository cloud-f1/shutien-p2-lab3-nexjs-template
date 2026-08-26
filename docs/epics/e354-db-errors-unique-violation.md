# E354 — `isUniqueViolation` 泛化到 `lib/db-errors.ts` + 修掉兩處字串比對

> Phase 86 · Size S · 來源：fork backlog（`../ai-rc-engineer-pm` 回收清單）
> Status: 🟢 **APPROVED — approved by the user on 2026-08-27**

## Problem

`isUniqueViolation()` 住在 `next-app/lib/billing/idempotency-utils.ts`，它自己的註解寫著：

> Detection is by error CODE only — **never the message text**.

但 **`actions/sales-pages.ts` 兩處正好在做被禁止的事**：

```ts
// actions/sales-pages.ts:66（createSalesPage）與 :126（updateSalesPage）
if (err instanceof Error && err.message.includes("sales_pages_slug_unique")) {
  return { error: "此網址代稱已被使用，請換一個。" }
}
throw err
```

這是脆弱的三重耦合：
1. **綁死約束名字串** —— `sales_pages_slug_unique` 由 Drizzle 從 `.unique()` 自動產生。
   任何重新命名／重建該約束的 migration 都會讓友善訊息無聲變成 500。
2. **綁死錯誤訊息格式** —— Postgres 訊息文字與語系可能變動；driver 若包裝錯誤，`.message` 就變了。
3. **與既有正解不一致** —— 同 codebase 已有以 SQLSTATE 判斷的正確做法，只是藏在 `billing/` 底下找不到。

**這使本 epic 不是投機性重構** —— 若只是搬檔案而無受益者，那是 YAGNI；但這裡有兩個真實的
脆弱呼叫點正等著這個函式。

## Solution

1. 新增 `next-app/lib/db-errors.ts` —— 領域中立的 Postgres 錯誤判定：
   `PG_UNIQUE_VIOLATION` 常數 + `isUniqueViolation(err)`（實作原封不動搬移，行為零變更）。
2. `lib/billing/idempotency-utils.ts` 改為從 `lib/db-errors` **re-export**，
   使 billing 的既有呼叫端與測試零改動（`app/api/billing/stripe/webhook/route.ts` 的
   re-export、`lib/billing/plans.ts`）。
3. `actions/sales-pages.ts` 兩處改用 `isUniqueViolation(err)`。
4. 測試移到 `lib/db-errors.test.ts`（既有 8 條斷言全數保留），
   並補 sales-pages 的紅綠：以帶 `code: "23505"` 的錯誤驗證回傳友善訊息、
   以其他 code 驗證仍然 `throw`。

## Key Files

- `next-app/lib/db-errors.ts`（新）+ `next-app/lib/db-errors.test.ts`（新）
- `next-app/lib/billing/idempotency-utils.ts` — 改為 re-export
- `next-app/actions/sales-pages.ts` — 兩處改用 code 判定

## Acceptance Criteria

1. `lib/db-errors.ts` 匯出 `isUniqueViolation` + `PG_UNIQUE_VIOLATION`，斷言與原本相同。
2. billing 既有呼叫端與測試**零改動**仍全綠（re-export 相容）。
3. `actions/sales-pages.ts` 不再出現 `err.message.includes(...)`。
4. 紅綠證明：`code: "23505"` → 友善訊息；`code: "23503"` → 原樣拋出。
5. 全 repo `grep -r "sales_pages_slug_unique" next-app --include="*.ts"` 在 actions/ 下無殘留。

## Out of Scope

- 不新增其他 SQLSTATE 判定（FK violation 等）—— 目前沒有呼叫端，加了就是投機性一般化。
