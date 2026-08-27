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
