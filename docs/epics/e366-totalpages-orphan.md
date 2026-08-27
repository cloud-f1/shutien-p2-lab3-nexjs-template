# E366 — 收斂 `totalPages` 真孤兒

> Phase 88 · Size S · 2 SP · **P3**
> Status: 🟢 **APPROVED — approved by the user on 2026-08-27**

## Problem

`node scripts/check-orphan-exports.mjs` 回報 `totalPages`（`next-app/lib/billing/pagination.ts:50`）：
1 個測試參照、**0 個正式參照**。`grep` 確認 `_orders-tab.tsx` 與 `_subscriptions-tab.tsx`
都沒有匯入它。

E358 修好孤兒偵測的有狀態 regex 假陽性之後，這一條是**真陽性** —— 當時刻意沒有加進 allowlist，
就是為了留著它當作「偵測器現在真的會抓到東西」的證據。現在該收斂了。

留著不處理的成本：每次 `check-orphan-exports.mjs` 全綠稽核，都要重新人工確認這個已知孤兒
不是新問題 —— 浪費稽核精力，且久了會養成「這條可以忽略」的習慣，下一個真孤兒就混得進來。

## Solution

二選一，實作時擇一並在 epic 收尾說明理由：

**A. 接進 UI** —— admin 訂單／訂閱頁顯示「第 X / Y 頁」。若 `<DataTable>` 的分頁已自帶頁數顯示，
   這條路可能是多餘的，要先確認再做。

**B. 加進 allowlist 並註明理由** —— 若確定要當作公開的 pagination API 保留給 fork 使用，
   在 `check-orphan-exports.mjs` 的 allowlist 加一行**帶理由註解**的條目。

決策依據：先看 `<DataTable>` 現有的分頁 UI 是否已涵蓋這個需求。若已涵蓋 → B；若確實缺 → A。

## Key Files

- `next-app/lib/billing/pagination.ts`（第 50 行）
- `scripts/check-orphan-exports.mjs`（allowlist）
- `next-app/components/data-table-generic.tsx`（先確認既有分頁 UI）
- admin 訂單／訂閱頁 `_orders-tab.tsx` · `_subscriptions-tab.tsx`（若走 A）

## Acceptance Criteria

1. `node scripts/check-orphan-exports.mjs` 不再回報 `totalPages`。
2. 選 A：UI 實際顯示頁數，有測試涵蓋。選 B：allowlist 條目帶理由註解，說明為何保留。
3. epic 收尾明確說明選了哪條路與理由。
4. 偵測器對**其他**真孤兒仍然有效 —— 故障注入一個新的未使用匯出，確認會被抓到
   （避免把 allowlist 改寬到失效）。

## Out of Scope

- 不重構 `pagination.ts` 的其他匯出。

---

## 實作決策（2026-08-28）— 選 B：allowlist + 理由註解

**依 epic 明訂的決策依據執行**：先打開 `next-app/components/data-table-generic.tsx` 確認。
**第 210 行已經在渲染**：

```tsx
第 {table.getState().pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)} 頁
```

再追 admin 流程：`admin/page.tsx` 以 `LIST_CAP = 500` 取列，經 `listAllOrders`/`listAllSubscriptions`
（用 `resolvePagination`，**不用 `totalPages`**）交給 `<OrdersTab>`/`<SubscriptionsTab>`，
再進 `<DataTable>`。DataTable 用 TanStack Table 在客戶端分頁並自行顯示頁數 ——
**`totalPages()` 在整條路徑上從未被呼叫**。

接進 UI（選項 A）等於在 DataTable 已渲染的頁數旁邊再算一次，是多餘的重複實作。
決策依據明確指向 B。

allowlist 條目帶 11 行註解，說明 DataTable 已涵蓋、以及為何仍保留該匯出
（與 `resolvePagination` 成對，後者**確實**接進 `lib/billing/queries.ts`；留給未來
server-side／非 DataTable 的消費者，例如公開 API 端點或 fork 的手寫列表）。

## ⚠ 差點踩到的陷阱：故障注入本身沒有注入

AC #4 的 canary 一開始被命名為 `__e366FaultInjectionCanary`（雙底線）。
但 `scripts/check-orphan-exports.mjs:54` 有這條規則：

```js
const isTestOnlyConvention = (name) => /^_/.test(name)
```

`_` 開頭的匯出會被**結構性豁免**於孤兒偵測。若照原名進行，偵測器根本看不到那個 canary，
「注入後沒有紅」會被誤讀成「注入失敗」或更糟 ——「偵測器壞了」。實作者在出事前改名為
`e366FaultInjectionCanary`（無前綴）。

**這是比空包彈更上一層的失效**：不是測試沒驗到東西，而是**驗證機制本身沒有作用**。
本專案的故障注入紀律要再加一條：**注入的東西必須先確認不在任何豁免清單／規則內。**

## AC #4 實測紅綠

RED（加入 canary + 測試參照）：
```
⚠️ Found 1 export(s) with tests but zero production references...
  • e366FaultInjectionCanary  (lib/billing/pagination.ts)  — 1 test reference(s), 0 production references
```
**`totalPages` 未被重新標記** —— 證明 allowlist 的範圍是精確的，沒有被改寬。

移除 canary 後 `git diff` 兩檔皆空（完全還原）；GREEN：`✅ No orphan exports...`
