# E330 — CRM 整合：`order.completed` 事件 + 系統級 Webhook Egress + Recipes

> Phase 78 · feature/backend+docs · Cycle 35 addendum（CRM 整合需求，2026-07-12）
> Status: ⬜ pending
> Depends: E327, E328

## Problem

用戶需要購買後把訂單/會員資料送進 CRM，三個 use case：**UC1 slim**（Google Sheet 對帳/客服看板）·
**UC2 integration**（MailerLite 打標籤 → 自動寄開課信）· **UC3 單一真相來源**（內部會員系統）。
UC3 已由 E327/E328 落地（內部 DB 先落庫、先開通 — Event-Driven 的第一線）。UC1/UC2 需要的
「內部 Webhook 事件分發器」模板其實已存在（E268：`lib/webhooks.ts` — HMAC 簽章、3 次重試 +
backoff、`webhook_deliveries` 投遞紀錄），**但它是 user-scoped**（使用者訂閱自己的事件）——
CRM 場景需要 **admin 擁有的系統級 endpoint** 接「全站訂單事件」，且目前沒有 `order.completed`
事件源。

User decisions (2026-07-12)：webhook + recipe 先行（第一方 connector 列 backlog）；會員開通 =
自動建帳 + 啟用信（E328）。

## Solution

1. **Schema（expand-only migration）** — `webhooks` 表加 `scope` 欄位（`'user' | 'system'`，default
   `'user'`，NOT NULL with default — 不動既有列）。System endpoints 由 admin 管理、接全站事件。
2. **事件源** — `settleOrder()`（E327）在 paid 轉換 commit 後 emit `order.completed`：
   `dispatchSystemEvent(event, payload)`（新 helper，重用 `deliverToEndpoint` 的簽章/重試/紀錄）。
   Fire-and-forget、絕不阻擋核帳（沿用現行 best-effort posture）。**Exactly-once 事件語意綁在
   E327 的單次 pending→paid 轉換上** — 重複 webhook 不會重發事件。
   Outbound payload 照 PRD 格式：
   ```json
   { "event": "order.completed", "timestamp": "...",
     "data": { "orderId", "amount", "currency", "productName", "gateway",
               "customer": { "email", "name", "phone", "isNewUser" } } }
   ```
   `isNewUser` 來自 E328 auto-provision 的 settlement result。
3. **Admin 管理面** — 擴充現有 webhooks dashboard：admin 可 CRUD system-scope endpoints（modal
   convention）+ 檢視投遞紀錄；非 admin 完全看不到 system scope（live role re-read）。
4. **Recipes（UC1/UC2 零代碼上線）** — `docs/guides/crm-recipes.md`：
   - **UC1 Google Sheet**：Make.com/Zapier custom-webhook 接收 → append row（對帳欄位對映表）
   - **UC2 MailerLite**：Make 接收 → MailerLite API upsert subscriber + 打
     `{product}_buyer` group/tag → MailerLite automation 寄開課信
   - 兩份都含：`x-webhook-signature` 驗證說明（Make 驗 HMAC 的做法/限制）、重試語意、PII 注意
     （payload 含 email/name/phone — endpoint URL 視同 secret）
5. **稽核** — system-endpoint CRUD 寫入現有 audit log（E268/E269 慣例）。

## SOLID / 架構備註

分發器是既有 OCP 點：未來第一方 connector（`@saas/crm-google-sheets` / `@saas/crm-mailerlite`，
backlog）只是同一事件的另一個訂閱者 — 核心零修改。不引入 queue/outbox worker（現階段流量下
inline best-effort + 投遞紀錄足夠；transactional outbox 列為未來硬化選項，記在 out-of-scope）。

## Key Files
- `next-app/lib/schema.ts` + migration（webhooks.scope，expand-only）
- `next-app/lib/webhooks.ts`（`dispatchSystemEvent`）· `next-app/lib/billing/orders.ts`（emit 點）
- `next-app/actions/webhooks.ts` + webhooks dashboard page（admin system-scope CRUD）
- `docs/guides/crm-recipes.md`

## Acceptance Criteria
- [ ] Migration expand-only（不碰既有 user-scoped 列；migration-review artifact）
- [ ] 一筆訂單核帳 → 每個 active system endpoint 恰好收到一次 `order.completed`（重複金流
      webhook → 不重發；Vitest on the transition guard）
- [ ] Payload 與 PRD 格式一致（含 `isNewUser`）；HMAC 簽章可驗（既有 verifyWebhook 測試模式）
- [ ] user-scoped webhooks 行為零變化（既有測試全綠）
- [ ] 非 admin 無法讀/寫 system endpoints（server-side 驗證測試）
- [ ] 兩份 recipe 文件完成，欄位對映與簽章驗證段落齊全
- [ ] dispatch 失敗不影響核帳與開通（settle 測試斷言）

## Cross-Epic
- E268 — 重用其分發器/簽章/重試/投遞紀錄；只加 scope 維度
- E327 — 事件源掛在 settleOrder 的單次 paid 轉換；E328 — `isNewUser` 來源
- security-audit skill — webhook egress PII + admin-only 面向

## Out of Scope
- 第一方 connector 模組 `@saas/crm-google-sheets` / `@saas/crm-mailerlite`（backlog — 免 Make 月費
  的直連版；同一事件源加 adapter 即可）
- Transactional outbox / 佇列化投遞（未來硬化）
- `order.refunded` 等更多事件（狀態 enum 已支援，之後按需求加）
