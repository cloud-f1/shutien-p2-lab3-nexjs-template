# E368 — 影響列數與稽核完整性：把 items 的正確寫法推及全類

> Phase 89 · security · 🟢 **APPROVED — 使用者於 2026-09-09 依 code-review 結果核准**
> 來源：2026-09-09 `next-app/` 產品程式碼審查 F3

## Problem

`actions/items.ts:66` 對 owner-scoped 寫入做了正確的事，連理由都寫在註解裡：

```ts
// Ownership-scoped WHERE matching zero rows means the item doesn't exist or
// belongs to another user — surface that instead of silently "succeeding".
if (result.count === 0) {
  return { error: "找不到項目，或您沒有權限刪除。" }
}
```

**其他五處同形狀的動作都沒有跟上。** 實測結果：

| 位置 | 函式 | `.count` 檢查 | 無條件寫稽核 |
|---|---|---|---|
| `actions/api-keys.ts:80` | `revokeApiKey` | ✗ | ✓ `api_key.revoked` |
| `actions/webhooks.ts:72` | `setWebhookActive` | ✗ | ✓ |
| `actions/webhooks.ts:87` | `deleteWebhook` | ✗ | ✓ `webhook.deleted` |
| `actions/team.ts:75` | `revokeInvitation` | ✗ | ✓ `invitation.revoked` |
| `actions/notifications.ts:11` | `markRead` | ✗ | — |

後果分兩層：

1. **UI 說謊** —— 動作回 `{}`（成功），前端跳成功 toast，但資料庫一列都沒動。
2. **稽核紀錄可偽造（較嚴重）** —— Server Action 是公開 POST 端點。任何登入者拿**別人的**
   資源 id 打 `revokeApiKey`，owner-scoped WHERE 匹配 0 列、什麼都沒改，但
   `logAudit({ actorId: 自己, action: "api_key.revoked", targetId: 呼叫端給的 id })`
   照樣寫入。攻擊者能往稽核表塞一筆**指名自己、針對自己碰不到的資源**的紀錄。

這正是 E356／E359 剛加固的那個合規面。E356 當時建立的政策是「不為不存在的帳號寫登入失敗
事件，否則稽核表變成未驗證寫入面」—— **同一條政策在資源動作這一側沒有被套用。**

## Solution

不逐案補 if，而是讓「寫入未命中」在型別上就無法靜默通過：

1. **優先改用 `defineAction`。** `items.ts` 走的是 `defineAction`（handler 回
   `{ data, audit }` 或 `{ error }`），稽核由框架在成功路徑寫。上表五處都是手寫
   `requireAuth()` + 裸 `db.update()`。把它們遷移到 `defineAction`，稽核事件就只能在
   handler 回 `data` 時發出。
2. **遷移不可行者（例如回傳形狀特殊）** 至少加上 `result.count === 0 → 回 error`，且
   **`logAudit` 必須在該檢查之後**。
3. **加一條 stop-verifier 規則（沿用 E351 Rule 25 的形狀）**：`actions/*.ts` 中出現
   `db.update(` / `db.delete(` 且同一函式內有 `logAudit(`／`audit:` 時，必須存在
   `.count` 檢查或 `.returning(`＋空值判斷。以本 epic 修正**前**的五處程式碼作回歸
   fixture，證明規則當初抓得到 —— 這是 E351 建立的驗收慣例。

## Key Files

- `next-app/actions/api-keys.ts`
- `next-app/actions/webhooks.ts`
- `next-app/actions/team.ts`
- `next-app/actions/notifications.ts`
- `next-app/lib/define-action.ts`（若遷移需要微調）
- `scripts/hooks/stop-verifier.sh`（+ 其測試 fixture）

## Acceptance Criteria

1. 以使用者 A 的 session 呼叫 `revokeApiKey(<使用者 B 的 key id>)` → 回傳 error，且
   `audit_log` **新增 0 列**（測試須斷言列數，不只斷言回傳值）。
2. 同樣的斷言套用於 `setWebhookActive` / `deleteWebhook` / `revokeInvitation` / `markRead`。
3. 合法的自有資源操作行為不變（既有測試全綠）。
4. stop-verifier 新規則對修正前的五處程式碼 exit != 0；對修正後 exit 0。
5. `make hook-test` 全過。

## Cross-Epic

- **與 E369 檔案衝突** —— 兩者都改 `api-keys.ts` / `webhooks.ts` / `team.ts`。
  **必須序列執行：E368 先，E369 後。** 這正是 Phase 87 E360 與 Phase 88 E365 踩過的坑。

## Out of Scope

- 不重構稽核表 schema。
- 不處理 `actions/items.ts`（已正確）。
