# E352 — create 路徑的驗證契約對稱（E348 的收口）

> Phase 85 · fix/contract · Cycle 39（E348 的 QA 指出）
> Status: ⬜ pending
> Depends: none

## Problem

E348 把 update 路徑的契約收口到 `updateItemSchema`，但留下一個不對稱：
**同一個 `items.title` 欄位，create 與 update 由兩套不同機制驗證。**

| 路徑 | 誰驗 |
|---|---|
| `createItem()` action | `validateItemTitle()`（手刻，`lib/items-utils.ts`） |
| RHF 表單 + `POST /api/v1/items` | `createItemSchema`（Zod） |
| `updateItem()` action | `updateItemSchema`（Zod，E348 剛收口） |

也就是說 **create 路徑本身就有「一個欄位兩個驗證器」** —— 只是兩者都有真實消費者，
不像 `updateItemSchema` 修正前是孤兒，所以 E348 明確把它劃在範圍外。

這是同一種病的殘留。而且 E348 的 QA 另外指出：`createItemSchema` 的 max 訊息
（`"標題過長"`）與 `updateItemSchema` 的（`"標題過長（最多 255 個字元）。"`）現在
在同一個檔案裡風格不一致 —— 那是為了保留 update 的既有文案而產生的副作用。

## Solution

比照 E348 的做法收口 create 路徑：

1. `createItem()` 改用 `createItemSchema.safeParse()`，先 trim 再驗（沿用 E348 建立的
   composition 形狀），並補 `invalid_type_error` 以覆蓋 `FormData.get()` 的 `null`/`File`。
2. `validateItemTitle()` 失去最後一個消費者後移除；`lib/items-utils.ts` 若因此變空則一併刪除。
3. **正規化兩個 schema 的錯誤訊息** —— 同一個欄位、同一種違規，文案應一致。
   選定一組並套用到 create 與 update 兩者。

**這一步會改變使用者看到的文案**，這是刻意的（消除不一致），但必須：
- 在 summary 中明列改前/改後的每一則訊息
- 更新任何斷言舊文案的測試（測試斷言要跟著新文案，不是放寬成模糊比對）

## Key Files
- `next-app/actions/items.ts` · `lib/validations/items.ts` · `lib/items-utils.ts`
- 相關測試：`lib/validations/items.test.ts` · `lib/items-utils.test.ts`（若存在）· e2e 中斷言錯誤文案處

## Acceptance Criteria
- [ ] `items.title` 的驗證契約**全 repo 只剩一處**（grep 佐證：`validateItemTitle` 已無呼叫端且已移除）
- [ ] create 與 update 對同一輸入產生**相同**的接受/拒絕與**相同**的錯誤文案 —— 以邊界測試佐證
      （`""` · `" "` · `"a"` · 255 · 256 · `null` · `File`）
- [ ] 除刻意正規化的文案外，接受/拒絕行為不變（改前/改後對照表列在 summary）
- [ ] 文案變更逐則列出；斷言舊文案的測試已更新為新文案（**不得放寬成模糊比對**）
- [ ] `pnpm openapi:generate` 後 `docs/openapi.yaml` 無非預期 diff
- [ ] typecheck / lint / unit / int / e2e 綠

## Cross-Epic
- E348 — 本 epic 是它明確劃出範圍外的那一半
- E341 — 同屬消滅雙重真相的系列

## Out of Scope
- 其他領域（webhooks / api-keys / team）的同類收口 —— 若存在，各自成 epic
