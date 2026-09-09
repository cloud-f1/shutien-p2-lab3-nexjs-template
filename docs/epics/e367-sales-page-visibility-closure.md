# E367 — 銷售頁可見性收口（custom 路徑的 status 閘門 + 改名後的舊路徑失效）

> Phase 89 · security/correctness · 🟢 **APPROVED — 使用者於 2026-09-09 依 code-review 結果核准**
> 來源：2026-09-09 `next-app/` 產品程式碼審查 F1（HIGH）+ F6

## Problem

**F1（HIGH，實際外洩）** —— `app/(marketing)` 之外的公開路由 `app/p/[slug]/page.tsx:116` 先查
E333 的 custom registry，命中就無條件渲染，**完全不讀 `sales_pages.status`**：

```ts
const customLoader = getCustomSalesPageLoader(slug)
if (customLoader) {
  const { default: CustomSalesPage } = await customLoader()
  const product = await getSalesPageProduct(slug)
  return (<><FunnelTracker slug={slug} /><CustomSalesPage slug={slug} product={product} /></>)
}
```

而唯一的狀態閘門 `canServeSalesPageRow`（`lib/sales/visibility.ts`）對 custom 模式**直接回
`false`** —— 註解寫明「the E333 custom-page registry owns that slug」。**兩側都認為對方負責，
結果沒有任何一側檢查。** `generateMetadata:52` 是同一個形狀。

這不是理論問題。admin 介面完整支援對 custom 列做狀態操作：

| 位置 | 行為 |
|---|---|
| `_sales-pages-table.tsx:116` | 顯示「已發佈／草稿」badge（在 `:118` 的 custom 判斷**之前**） |
| `_sales-pages-table.tsx:169` | 提供「發佈」動作 |
| `_sales-page-form.tsx:260,278` | 表單可同時選 `status` 與 `renderMode: custom` |

於是：管理員對 `ai-launch-intensive`（目前註冊表唯一條目）按下取消發佈 →
`setSalesPageStatus` 回成功 → 寫入 `sales_page.unpublished` 稽核 → `revalidatePath('/p/<slug>')`
→ **頁面照樣對匿名訪客送出**。UI 說已下架，實際還在線上。

這是 **E350 的同類外洩在 E333 路徑上的殘留** —— E350 當時只修了 list query 那一側。

**F6** —— `updateSalesPageAction`（`actions/sales-pages.ts:91`）選出 `id/status/publishedAt`
但**沒選 `slug`**，收尾只 `revalidateSalesPage(input.slug)`。把 `/p/black-friday` 改名為
`/p/bf-2026` 後，舊路徑保有 ISR 快取，無限期繼續送出一個已不存在的頁面。

## Solution

1. **把狀態決策移到 render mode 之前。** 在 `page.tsx` 與 `generateMetadata` 兩處，**先**做
   一次 DB 可見性查詢（slug → `{status, renderMode}` + preview token 驗證），再決定走
   custom 或 structured。custom 命中但不可見 → `notFound()`。
2. **`canServeSalesPageRow` 不再對 custom 短路。** 改為對兩種 render mode 施加同一條規則
   （published → 可見；draft → 需有效 preview token）。**保留**「registry 未認領的 custom
   slug 應 404」這條，但改由路由層（loader 不存在）表達，而非混進可見性函式。
3. **註冊表中但 DB 無列的 slug**：維持現行可見（純程式碼頁面，無 DB 列可談狀態）。此為刻意
   決策，須在 `custom-pages.ts` 與可見性函式各留一句註解說明，避免下次有人「順手補齊」而
   把純程式碼銷售頁全部關掉。
4. **F6**：`existing` select 加入 `slug`；`existing.slug !== input.slug` 時，對**新舊兩個**
   路徑都 `revalidatePath`。

## Key Files

- `next-app/app/p/[slug]/page.tsx`（`generateMetadata` + default export 兩處）
- `next-app/lib/sales/visibility.ts`
- `next-app/lib/sales/resolver.ts`（若可見性查詢需新增一支僅取 meta 的函式）
- `next-app/actions/sales-pages.ts:91,132`
- `next-app/lib/sales/custom-pages.ts`（僅補註解）

## Acceptance Criteria

1. 對 `ai-launch-intensive` 建立／更新一列 `sales_pages`，`renderMode: custom`、
   `status: draft`，匿名 GET `/p/ai-launch-intensive` 得到 **404**。
2. 同一列改為 `status: published`，匿名 GET 得到 **200 且渲染 custom 元件**。
3. 承 (1)，帶有效 `?preview=<token>` 時得到 **200**（草稿預覽仍可用）。
4. `generateMetadata` 與頁面主體對同一列給出**一致**的可見性判定（草稿時不得洩漏標題／描述）。
5. 註冊表有 loader 但 DB 無對應列的 slug → 仍為 200（純程式碼頁面不受影響）。
6. 改 slug 後，舊路徑與新路徑**皆**被 revalidate（以 `revalidatePath` 的呼叫參數斷言）。
7. `canServeSalesPageRow` 的單元測試涵蓋 custom × {published, draft} × {有/無 preview} 六種組合。

## Out of Scope

- 不動 E326/E332 的 structured 渲染管線。
- 不改 preview token 的簽章機制（E332 既有）。
