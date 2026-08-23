# E350 — `listSalesPages()` 無守衛：草稿銷售頁洩漏

> Phase 84 addendum · fix/security · Cycle 38（E346 掃描時發現）
> Status: ⬜ pending
> Depends: none

## Problem

`next-app/actions/sales-pages.ts:271`：

```ts
"use server"                                    // ← 檔頭
...
/** List all sales pages for the admin table (newest first). */
export async function listSalesPages() {
  return db.select({ id, slug, productId, content, renderMode,
                     status, publishedAt, updatedAt })
           .from(salesPagesTable)
           .orderBy(desc(salesPagesTable.updatedAt))
}
```

**沒有任何守衛** —— 無 `requireAdmin()`、無 `defineAction()`。同檔案其他五個 action
（create / update / setStatus / delete / previewLink）**全部**走 `defineAction()`，
只有這支讀取 helper 是裸的。

因為檔頭是 `"use server"`，它是任何客戶端都能 POST 的端點。回傳內容包含 `status` 與
完整的 `content` JSONB —— 也就是**草稿與未發布的銷售頁**（定價實驗、未上市產品定位、
未公開文案）會洩漏給任何匿名呼叫端。

註解寫「Server Component loader helper」，作者意圖是從 `page.tsx` 呼叫。但放進
`"use server"` 檔案後，可達性就不由意圖決定。

**與 E346 同一個架構錯誤**：內部 helper 住在公開介面檔案裡。E346 是「可選參數繞過守衛」，
本 epic 是「根本沒有守衛」—— 兩個變體，同一個根因。

## Solution

沿用 E346 剛確立的 `lib/*`（內部）vs `actions/*`（surface）分離：

1. 把查詢移到 `next-app/lib/sales/queries.ts`（或既有的 sales 查詢模組，先確認位置）——
   **不含** `"use server"`。檔頭註解說明信任邊界：只能從已授權的 Server Component 或
   Route Handler 呼叫。
2. `actions/sales-pages.ts` 移除 `listSalesPages` 的匯出（或改為 `defineAction` 包裝的
   admin-gated 版本，若確實有客戶端需要它 —— **先確認是否真的有**，沒有就直接移除）。
3. 呼叫端（admin 頁面的 Server Component）改呼叫內部函式。該頁本身已有 `requireAdmin()`，
   確認後不需重複。

## Key Files
- `next-app/actions/sales-pages.ts`
- `next-app/lib/sales/`（查詢的新家）
- `app/(dashboard)/dashboard/admin/sales-pages/page.tsx`（呼叫端）

## Acceptance Criteria
- [ ] `listSalesPages` 不再是 `"use server"` 檔案的匯出（grep 佐證）
- [ ] admin 銷售頁清單功能不變（e2e `sales-pages.spec.ts` 仍綠）
- [ ] **回歸測試證明洩漏已封**：模擬未驗證呼叫端嘗試取得清單 → 拒絕。紅綠實證：
      還原修正 → 測試變紅（且能證明真的取得了草稿資料）；套用修正 → 綠
- [ ] 內部函式檔頭寫明信任邊界
- [ ] 確認呼叫端頁面本身有 `requireAdmin()`（附證據），不重複加守衛
- [ ] typecheck / lint / unit / int / e2e 綠

## Cross-Epic
- E346 — 同一個根因的另一個變體，修法形狀沿用
- E351 — 系統性守衛，本 epic 是它的第二個實證案例

## Out of Scope
- 其他 action 檔案的稽掃（E346 已掃過 mutation 類；讀取類 helper 的系統性檢查歸 E351）
