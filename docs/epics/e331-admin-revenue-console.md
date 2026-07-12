# E331 — Admin 營收後台（會員/訂單/訂閱管理台）

> Phase 79 · feature/ui+backend · Cycle 35 addendum 2（後台管理面 audit，2026-07-12）
> Status: ⬜ pending
> Depends: E327, E328

## Problem

後台 audit（2026-07-12）：`dashboard/admin` 只有基本會員管理（列表/角色/刪除/TOTP/邀請，且是舊式
raw `<Table>`）；訂閱只有 `dashboard/system` 的**個人** Billing tab（E292 portal）。Phase 77 上線
後會有全站 orders / entitlements / （既有）subscriptions 資料，但 **admin 沒有任何全站營收視角**，
客服場景（查單、重寄啟用信、退款後收回權限）無介面可作業。操作深度 user decision：**讀 + 基本
操作**（金流端退款仍在金流商後台執行；本系統標記狀態 + 收回權限）。

## Solution

`dashboard/admin` 擴成 tabs（沿用 `dashboard/system` 的 `_*-tabs.tsx` 模式），admin-only
（live role re-read，非 admin 404/redirect 不變）：

1. **會員 tab** — 現有用戶列表遷移到 **`<DataTable>`**（filter/分頁，符合 CLAUDE.md 慣例；現有
   setUserRole/deleteUser/resetTotp/邀請功能全保留）。點列開 **會員詳情 Sheet/Dialog**：該會員的
   orders、entitlements（來自 E328 guard 的同一查詢）、active subscription、基本資料。
2. **訂單 tab** — 全站 orders `<DataTable>`：訂單號/產品/買家 email/金額/gateway/狀態/時間；
   filter by 狀態+產品。列操作（`defineAction` + admin authorize）：
   - **重寄啟用信**（E328 activation mail 重發，冪等）
   - **標記退款**（orders.status → `refunded`，寫 audit log；entitlement 因 guard 只認 `paid`
     而自動失效 — 不需要第二個開關）
3. **訂閱 tab** — 全站 subscriptions `<DataTable>`（read-only）：用戶/plan/provider/狀態/
   current_period_end；新增 `lib/billing/queries.ts` 的 admin 全站查詢（現有 per-user 查詢不動）。
   金流端操作連結到各 provider 後台（文件註明），本系統不代打退訂 API。
4. **稽核** — 所有 admin 操作寫入現有 audit log（E269 慣例），CRUD 走 modal convention。

## Key Files
- `next-app/app/(dashboard)/dashboard/admin/**`（page.tsx 改 tabs + `_members-tab` / `_orders-tab` /
  `_subscriptions-tab`；本 epic 獨佔此目錄 — 與 E332 的 `admin/sales-pages/**` 不相交）
- `next-app/actions/admin-revenue.ts`（resendActivation / markRefunded — defineAction + admin）
- `next-app/lib/billing/queries.ts`（+ listAllOrders / listAllSubscriptions，分頁）

## Acceptance Criteria
- [ ] 三個 tab 都用 `<DataTable>`；會員 tab 既有功能（角色/刪除/TOTP/邀請）零回歸（既有測試綠）
- [ ] 會員詳情能看到該會員的訂單 + 權限 + 訂閱
- [ ] 標記退款 → orders.status=refunded + audit log 一筆 + 該產品內容庫存取即刻失效（int test）
- [ ] 重寄啟用信冪等（已設密碼的用戶 → 明確拒絕/提示，不重建 token 濫發）
- [ ] 非 admin 對所有新 action/查詢 server-side 擋下（測試佐證，live role re-read）
- [ ] typecheck/lint/build + Vitest（含新 queries 分頁）綠

## Cross-Epic
- E327/E328 — 資料源（orders/entitlements/settlement result）；E292 — 個人 Billing tab 不動
- security-audit skill §8 — authorization flag vs ownership：admin 操作全走 role 檢查，
  entitlement 失效走 ownership 判定（orders.status），兩者不混用

## Out of Scope
- 金流 API 直接退款（Stripe refund / 綠界退刷）— 金流商後台操作；未來如需求穩定再開 epic
- 營收報表/圖表 dashboard（future）
- 多銷售頁管理 → E332
