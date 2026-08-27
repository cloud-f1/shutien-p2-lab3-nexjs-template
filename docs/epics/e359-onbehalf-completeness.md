# E359 — `on_behalf` 完整性收口（漏標 + CSV 匯出）

> Phase 87 · Size S · 3 SP · P1
> Status: 🟢 **APPROVED — approved by the user on 2026-08-27**
> 來源：E356 的 QA 發現（Cycle 41）

## Problem

E356 交付了 `audit_log.on_behalf` 代操作旗標，但有兩個缺口讓它**不完全可信**。

### (a) `actions/admin-revenue.ts:142` `resendActivation` 漏標

該 action 是 admin **為另一個使用者鑄造 password-reset token 並寄出啟用信**：

```ts
db.insert(passwordResetTokensTable).values({ userId: user.id, … })
// metadata 甚至記了 { userId: user.id }
```

這正是 E356 規格 Solution §4 字面點名的「**重設他人密碼**」情境，卻寫成 `on_behalf = false`。

E356 規格的 Key Files 只列 `actions/admin.ts`，所以就字面而言未違約 —— 但 AC#5
（「admin 代他人操作 → true」）在語意上涵蓋它。

**QA 是怎麼找到的（本 epic 的驗收要複製這個方法）**：E356 的實作者用 `grep -rn "logAudit("`
列舉所有寫稽核的 action，做出一份**看起來完整**的表格（10 行、每行都有理由）。但 `defineAction`
走 `lib/define-action.ts:203` 的**宣告式**路徑（`audit:` 參數），那一族的 **9 個寫入點永遠不含
`logAudit(` 字樣**。QA 多加一個 `grep -rn "audit:"` 才發現。

### (b) CSV 匯出與 UI 不一致

`actions/admin.ts:161` 的 `headers` 陣列是
`["id", "action", "actorEmail", "targetType", "targetId", "createdAt"]` —— **不含 `on_behalf`**，
`:152` 的 row mapper 同樣沒有。

而匯出按鈕就長在 `_audit-panel.tsx` 裡：使用者在 UI 看得到「代操作」badge，按下旁邊的匯出，
拿到的 CSV 卻沒有這一欄。**稽核匯出的用途正是離線調查與合規交付** —— 恰好是最需要這個旗標的場景，
也是 E356 整個賣點（「可用 SQL／表格篩選代操作」）延伸到檔案時斷掉的地方。

E356 規格把 CSV 欄位列為 Out of Scope，但排除的**理由**是 fork 的 `rc-audit-utils.ts` 綁死
`actorBadge`/`beforeValue`/`afterValue`（模板沒有這些欄位）—— 那個理由不適用於 `on_behalf`。

## Solution

架構已支援：`lib/define-action.ts:40` 的 `AuditEntry = Parameters<typeof logAudit>[0]`，
`onBehalf` 自動透傳 `defineAction`，零型別改動。

- (a) `resendActivation` 的 `audit:` 加 `onBehalf: <actor !== target 的判斷>`。
  比照 E356 的慣例寫成**比較式**而非字面 `true`，這樣守衛日後放寬仍正確。
- (b) `exportAuditLog()` 的 `headers` 加 `"onBehalf"`、`rows` mapper 加對應欄位。

## Key Files

- `next-app/actions/admin-revenue.ts` — 第 142 行附近
- `next-app/actions/admin.ts` — 第 152 / 161 行
- 對應的 int / unit 測試

## Acceptance Criteria

1. `resendActivation` 對他人 → `on_behalf = true`；對自己（若可能）→ `false`。
   以**真實資料列**（`SELECT on_behalf FROM audit_log`）斷言，非讀 `logAudit` 參數。
2. 匯出的 CSV 含 `onBehalf` 欄，值與 UI 顯示一致。
3. **必須用兩個 grep 重新完整列舉一次**（`grep -rn "logAudit("` **與** `grep -rn "audit:"`），
   在 PR 中附上清單，確認沒有第三個漏網。這是本 epic 的核心驗收 —— 補兩行很容易，
   確認「沒有別的漏掉」才是價值所在。
4. 故障注入證明測試有效：把 `onBehalf` 硬寫成 `true` → 「對自己 → false」那條必須轉紅。
5. 既有測試零改動全綠（E356 的 4 條 `on_behalf` int 測試不得受影響）。

## Out of Scope

- 其他被 QA 判為「組織治理動作」而刻意不標的呼叫點（`order.refunded`、`invitation.revoked`、
  `system_webhook.*`）—— 若要改變那些判斷，應另開 epic 並重新論證，不在本 epic 順手改。
