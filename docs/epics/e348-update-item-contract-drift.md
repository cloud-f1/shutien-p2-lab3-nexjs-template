# E348 — `updateItemSchema` 孤兒：文件化的契約與執行的契約是兩份程式碼

> Phase 84 · fix/contract · Cycle 38（/athena:audit 2026-08-22 發現）
> Status: ⬜ pending
> Depends: none

## Problem

`lib/validations/items.ts:7-9` 匯出 `updateItemSchema`，並登記在 OpenAPI registry
（`lib/openapi/registry.ts:36,80`，名為 `UpdateItemInput`）。

但**沒有任何實際更新項目的程式路徑呼叫它**。`actions/items.ts:76-105` 的 `updateItem()`
改用另一份手刻規則 `validateItemTitle()`（`lib/items-utils.ts:9`）。

目前兩者的規則**碰巧一致**（min 1 / max 255），但沒有任何機制維持同步。而且 REST API
根本沒有暴露 update 端點 —— 也就是說：**被文件化的契約與被執行的契約是兩份各自維護的
程式碼，而文件化的那份沒有任何使用者**。

這正是 E341 在治的病（雙重真相），只是這次在 Zod 層而非散文層。

## Solution

先判斷哪一份是對的，再消滅另一份 —— 不要兩份都留著「保持同步」。

1. **決定方向**（實作者需在 summary 說明理由）：
   - **(a) 讓 action 用 schema**：`updateItem()` 改用 `updateItemSchema.safeParse()`，
     刪除 `validateItemTitle()`（或改為 schema 的薄包裝）。契約單一化在 Zod。
     優先考慮此方向 —— 與 `createItemSchema` 的處理方式一致。
   - **(b) 刪除 schema**：若 update 真的沒有、也不會有 REST 端點，`updateItemSchema` 與
     其 OpenAPI 登記一併移除，`validateItemTitle()` 成為唯一契約。
   只有在 (a) 會破壞既有行為時才選 (b)，並說明是什麼行為。
2. **同步 OpenAPI registry** —— 若保留 schema，確認 `UpdateItemInput` 的登記與實際使用
   一致；若移除，一併移除登記，避免文件描述不存在的端點。
3. **測試**：更新路徑的驗證行為需有測試涵蓋（邊界：空字串 · 1 字元 · 255 · 256）。

## Key Files
- `next-app/lib/validations/items.ts` · `lib/items-utils.ts` · `actions/items.ts`
- `next-app/lib/openapi/registry.ts`

## Acceptance Criteria
- [ ] 更新項目的驗證契約**只剩一份**（grep 佐證：沒有第二處獨立維護的標題規則）
- [ ] 選定方向的理由寫在 commit / summary 中，含為何不選另一個方向
- [ ] OpenAPI registry 與實際狀況一致（不描述不存在的端點，不遺漏存在的）
- [ ] 邊界測試涵蓋 空字串 / 1 / 255 / 256 字元
- [ ] 既有 `updateItem` 的行為不變（現行合法輸入仍合法、現行拒絕的仍拒絕）—— 測試佐證
- [ ] typecheck / lint / unit 綠

## Cross-Epic
- E341 doc↔code 契約測試 — 同屬消滅雙重真相的系列

## Out of Scope
- 新增 REST update 端點（若不存在就是不存在，本 epic 不擴功能）
