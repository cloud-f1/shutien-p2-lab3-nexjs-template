# E347 — ECPay return/period 結算 handler 測試

> Phase 84 · test/money-path · Cycle 38（/athena:audit 2026-08-22 發現）
> Status: ⬜ pending
> Depends: none

## Problem

三條金流 webhook 路徑中，**ECPay 的兩支結算 handler 完全沒有測試**：

| Route | 職責 | 測試 |
|---|---|---|
| `app/api/billing/stripe/webhook/route.ts` | Stripe 事件 | ✅ 有 `route.test.ts` |
| `app/api/billing/newebpay/return/route.ts` | 藍新 MPG 回傳 | ✅ 有 |
| `app/api/billing/ecpay/renew/route.ts` | 綠界續訂排程 | ✅ 有 |
| **`app/api/billing/ecpay/return/route.ts`** | **首次授權通知 + 訂閱建立** | ❌ **無** |
| **`app/api/billing/ecpay/period/route.ts`** | **每期扣款通知 + 結算** | ❌ **無** |

而 ECPay 是本模板文件指定的 **launch gateway**（`BILLING_PROVIDER=ecpay`）——
覆蓋率最低的偏偏是預設會走的那條路。

## Solution

比照既有 sibling 測試（先讀 `stripe/webhook/route.test.ts` 與 `newebpay/return/route.test.ts`
的形狀，沿用其 mock 與斷言慣例，不另創一套）：

1. `app/api/billing/ecpay/return/route.test.ts` — 首次授權：
   - **簽章驗證**：CheckMacValue 正確 → 處理；錯誤/缺漏 → 拒絕且**不寫入任何列**
   - 成功路徑：訂單結算、訂閱建立、entitlement 開通
   - **冪等**：同一通知重放兩次只產生一次副作用（SQLSTATE 23505 / onConflict 路徑）
   - 失敗/取消狀態碼不誤判為成功
2. `app/api/billing/ecpay/period/route.test.ts` — 每期扣款：
   - 簽章驗證同上
   - 成功扣款 → 訂閱期間延展、payment_events 記錄
   - **扣款失敗** → 訂閱狀態正確轉換，不誤判為成功
   - 冪等：同一期通知重放不重複結算

**斷言必須實質**：驗證 DB 副作用（訂單/訂閱/payment_events 的實際狀態），不是只斷言
HTTP 200。一個只檢查狀態碼的 webhook 測試抓不到任何結算邏輯的錯。

## Key Files
- `next-app/app/api/billing/ecpay/return/route.test.ts`（新）
- `next-app/app/api/billing/ecpay/period/route.test.ts`（新）

## Acceptance Criteria
- [ ] 兩支 handler 各有測試，涵蓋：簽章通過/失敗 · 成功結算 · 失敗狀態 · **冪等重放**
- [ ] 簽章失敗時斷言**零 DB 副作用**（不是只斷言回應碼）
- [ ] 成功路徑斷言實際 DB 狀態轉換，不是只斷言 HTTP 200
- [ ] 沿用 sibling 測試的 mock/斷言慣例，不另創一套
- [ ] 測試會因真實缺陷而紅：對每支 handler 各挑一條斷言，暫時破壞對應的產品邏輯確認測試變紅，還原後變綠（附實證）
- [ ] typecheck / lint / unit 綠

## Cross-Epic
- E329 NewebPay provider · E327 orders/checkout — sibling 測試的形狀來源

## Out of Scope
- 改動 ECPay provider 的產品邏輯（本 epic 只補測試；若測試揭露真實缺陷，另開 bugfix epic 並回報）
