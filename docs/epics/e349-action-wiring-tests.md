# E349 — 7 個 action 檔的 wiring 整合測試

> Phase 84 · test/coverage · Cycle 38（/athena:audit 2026-08-22 發現）
> Status: ⬜ pending
> Depends: E346

## Problem

稽核以 action/handler 名稱掃過所有 `*.test.ts` / `test/int/**` / `e2e/**`，發現 7 個
action 檔**沒有任何測試直接呼叫它們匯出的函式**：

`actions/admin.ts`（setUserRole · deleteUser · resetUserTotp · exportAuditLog）·
`actions/api-keys.ts`（3）· `actions/notifications.ts`（2）· `actions/sales-pages.ts`（6 個
admin CRUD）· `actions/team.ts`（4）· `actions/webhooks.ts`（9）· `actions/checkout.ts` 的
action wrapper

**必須誠實界定這個缺口**：這是「沒有測試直接呼叫該 action」，**不是**「底層邏輯沒測試」。
`team-utils` / `webhooks-utils` / `api-keys-utils` / `export-row-mappers` / `admin-revenue`
的 helper 都有單元測試，e2e 也會渲染部分畫面。

真正沒被涵蓋的是**串接層**：guard → validate → DB write → audit 這條線。
`test/int/rbac.int.test.ts` 已經為 `items.ts` 提供了這種測試，其他 7 個檔案沒有。

而 Phase 84 的頭號發現（E346 的 `recordUsage` 未驗證寫入）**正是串接層的缺陷** ——
底層邏輯完全正確，錯在守衛沒接上。這說明這一層的測試不是形式主義。

## Solution

比照 `test/int/rbac.int.test.ts` 的既有形狀（先讀它，沿用 throwaway DB harness 慣例），
為 7 個檔案補 wiring 測試。**每個 action 至少一條「守衛真的擋住」的斷言**：

1. **授權邊界**（最高價值）：以無權限角色呼叫每個 mutation → 必須被拒絕**且零 DB 副作用**。
   admin-only 的用 editor/viewer 試；owner-scoped 的用非擁有者試。
2. **正向路徑**：有權限角色呼叫 → 預期的列被寫入/更新/刪除。
3. **稽核落地**：會寫 audit 的 action（admin 類）確認 `audit_log` 真的多一列且欄位正確。

不追求每個分支都覆蓋 —— 追求**每個 action 的守衛都被實際執行過一次**。

`actions/checkout.ts` 的 `createOneTimeCheckout` 是刻意的 public action
（`// stop-verifier:public-action`），測試應斷言它**確實**不需登入即可呼叫，且金額/幣別
由 server 決定而非取自輸入 —— 那是它的安全性所在。

## Key Files
- `next-app/test/int/{admin,api-keys,notifications,sales-pages,team,webhooks,checkout}.int.test.ts`（新）
- 參考：`next-app/test/int/rbac.int.test.ts` · `test/int/harness.ts`

## Acceptance Criteria
- [ ] 7 個 action 檔各有 int 測試，**每個 mutation 至少一條授權邊界斷言**
- [ ] 授權被拒時斷言**零 DB 副作用**（不是只斷言回傳錯誤）
- [ ] admin 類 action 斷言 `audit_log` 實際落地
- [ ] `createOneTimeCheckout` 斷言 public 行為正確且金額/幣別 server-owned
- [ ] 沿用 `rbac.int.test.ts` 與 `harness.ts` 的既有慣例，不另創一套
- [ ] 測試會因真實缺陷而紅：任挑 2 個 action 暫時移除其守衛，確認對應測試變紅，還原後綠（附實證）
- [ ] `pnpm test:int` 綠；typecheck / lint 綠
- [ ] 若過程中發現真實的守衛缺陷 —— **回報，不要順手修**（另開 bugfix epic，比照 E346 的處理）

## Cross-Epic
- E346 — 頭號發現正是這一層的缺陷，本 epic 是它的系統性防線
- E345 關卡帳本 — 本 epic 的關卡結果留帳

## Out of Scope
- 追求分支覆蓋率數字
- 改動任何 action 的產品邏輯
