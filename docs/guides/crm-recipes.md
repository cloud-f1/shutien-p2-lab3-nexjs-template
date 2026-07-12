# CRM 整合 Recipes — `order.completed` Webhook Egress

> E330 · 讓「購買完成」的訂單/會員資料零代碼流進你的 CRM / 試算表 / EDM。
> 前置：管理員已在 **系統 → 系統 Webhooks** 建立一個系統級端點（見下方「設定系統端點」）。

本文件提供兩份可直接照做的無代碼串接：

- **UC1 — Google Sheet 對帳/客服看板**（Make.com 或 Zapier → 試算表 append row）
- **UC2 — MailerLite 打標籤 → 自動寄開課信**（Make.com → MailerLite upsert + group/tag）

兩者共用同一個事件源，差別只在「接收端做什麼」。未來的第一方 connector 模組
（`@saas/crm-google-sheets` / `@saas/crm-mailerlite`，backlog）只是同一事件的另一個訂閱者，
核心零修改。

---

## 事件契約：`order.completed`

一筆訂單在 `settleOrder()` 完成 **pending → paid** 轉換後（E327），系統會對每個
**active 的系統級端點** POST 一次這個事件。語意上是 **exactly-once**：綁在單次 paid
轉換上，重複的金流 webhook **不會**重發此事件（見「重試與去重語意」）。

### HTTP 請求

```
POST <你的端點 URL>
Content-Type: application/json
x-webhook-event: order.completed
x-webhook-signature: t=<unixSeconds>,v1=<hex HMAC-SHA256>
```

### Body

```json
{
  "event": "order.completed",
  "timestamp": "2026-07-13T09:41:02.113Z",
  "data": {
    "orderId": "b0c1…",
    "amount": 149900,
    "currency": "TWD",
    "productName": "AI Coding 進階班",
    "gateway": "ecpay",
    "customer": {
      "email": "buyer@example.com",
      "name": "王小明",
      "phone": null,
      "isNewUser": true
    }
  }
}
```

| 欄位 | 型別 | 說明 |
|---|---|---|
| `data.orderId` | string (uuid) | 內部訂單 ID，對帳主鍵 |
| `data.amount` | integer | **最小貨幣單位**（TWD 為 1:1 元；USD 為 cents）。顯示金額時自行換算 |
| `data.currency` | string | ISO-4217（如 `TWD`、`usd`） |
| `data.productName` | string | 產品名稱快照 |
| `data.gateway` | string | 金流商：`ecpay` / `newebpay` / `stripe` … |
| `data.customer.email` | string | 買家 email（會員系統唯一鍵） |
| `data.customer.name` | string \| null | 買家姓名 |
| `data.customer.phone` | null | 目前結帳未收集電話，固定為 `null`（欄位保留給未來） |
| `data.customer.isNewUser` | boolean | `true` = 這筆核帳「自動建立」了新帳號（E328）；`false` = 既有會員 |

> **絕不外洩：** payload 不含任何 secret（無密碼、無 token、無金流機密）。但它**含買家個資**
> （email / name）——**端點 URL 視同 secret**，只放在你信任的自動化平台，勿貼上公開場合。

---

## 簽章驗證（`x-webhook-signature`）

每個請求都帶 Stripe 風格的簽章 header：

```
x-webhook-signature: t=<unixSeconds>,v1=<hexdigest>
```

`v1` = `HMAC_SHA256(secret, "<t>.<raw request body>")` 的 hex。`<t>` 是簽發時的 Unix 秒數，
一起被簽入以防重放。**secret** 是你建立系統端點時顯示一次的 `whsec_…` 值。

驗證步驟：

1. 取出 header 的 `t` 與 `v1`。
2. 用你保存的 secret 計算 `HMAC_SHA256(secret, t + "." + rawBody)`。
3. 常數時間比對是否等於 `v1`。
4.（建議）拒絕 `|now - t| > 300s` 的請求以防重放。

> 本模板的參考實作見 `next-app/lib/webhooks-utils.ts` 的 `verifyWebhook()`——
> 需要對照時可直接讀該檔的簽章格式。

### 在 Make.com 驗簽的做法與限制

Make 沒有內建「HMAC 驗簽 webhook」開關，兩個實務選項：

- **簡單版（多數人用）：** 把端點 URL 當成 secret（Make 的 custom webhook URL 本身就是不可
  猜的長隨機字串）。不主動驗 `v1`，靠 URL 保密擋掉偽造。**風險：** 任何拿到該 URL 的人都能
  灌假資料——URL 只在 Make/你之間流通即可接受。
- **嚴謹版：** 在 flow 第一步加一個 **Tools → 自訂 function / 或一段 code module**，用你的
  secret 重算 HMAC 並和 `x-webhook-signature` 的 `v1` 比對，不符就 `Filter` 掉。Make 的
  webhook module 可讀取 headers 與 raw body；把 raw body 餵進 HMAC 即可。

Zapier 同理：Zapier 的 "Catch Raw Hook" 能拿到 raw body，配一個 **Code by Zapier**（Python/JS）
step 重算 HMAC 比對 `v1`，再接後續動作。

---

## 重試與去重語意

- **重試：** 投遞失敗（non-2xx 或連線/逾時）會**最多重試 3 次**，退避 1s / 4s / 9s。你的端點
  只要**回 2xx** 就視為成功；回 4xx/5xx 或逾時（>5s）會觸發重試。
- **請讓接收端具冪等性：** 重試可能讓同一 `orderId` 被送達多次。用 `data.orderId` 當去重鍵
  （試算表：找到既有列就更新而非新增；EDM：upsert by email）。
- **事件層 exactly-once：** 事件本身綁在單次 paid 轉換——**重複的金流 webhook 不會重發**
  `order.completed`。你只需要防「投遞重試」造成的重覆，不需要防「重複核帳」。
- **best-effort：** egress 失敗**絕不影響核帳與會員開通**——訂單照樣 paid、帳號照樣建立。
  投遞結果可在 **系統 → 系統 Webhooks**（管理員）檢視。

---

## 設定系統端點（管理員）

1. 以 **admin** 登入 → 側欄 **系統** → **系統 Webhooks** 分頁（非 admin 看不到此分頁）。
2. **新增系統端點** → 貼上你的 Make/Zapier custom webhook URL（必須是 HTTPS）→ **建立**。
3. **立即複製顯示一次的簽章密鑰**（`whsec_…`）——關閉後不再顯示。需要嚴謹驗簽時會用到。
4. 用 **測試** 送一筆 `ping` 驗證端點通、用 **停用/啟用** 控制流量、用 **刪除** 下線。

> RBAC：所有系統端點的建立/停用/刪除/測試都在 server 端 `requireAdmin()`（即時 re-read
> 角色）把關，非 admin 完全無法讀寫。每次 CRUD 都寫入稽核紀錄。

---

## UC1 — Google Sheet 對帳 / 客服看板

**目標：** 每筆完成訂單自動 append 一列到 Google Sheet，供財務對帳、客服查詢。

### Make.com

1. 建立 scenario：**Webhooks → Custom webhook** 當觸發器，複製它產生的 URL。
2. 把該 URL 貼到本站 **系統 Webhooks** 建立端點；回 Make 按 **Re-determine data structure**，
   在本站按該端點的 **測試** 送一筆樣本讓 Make 學會欄位結構。
3. 加 **Google Sheets → Add a Row** module，選好試算表與工作表。
4. 欄位對映：

   | 試算表欄 | 來源 |
   |---|---|
   | Order ID | `data.orderId` |
   | 日期 | `timestamp` |
   | 金額 | `data.amount`（TWD 直接用；其他幣別自行 /100） |
   | 幣別 | `data.currency` |
   | 產品 | `data.productName` |
   | 金流 | `data.gateway` |
   | Email | `data.customer.email` |
   | 姓名 | `data.customer.name` |
   | 新會員？ | `data.customer.isNewUser` |

5.（建議冪等）改用 **Search Rows → Update/Add a Row**：以 `data.orderId` 找列，有就更新、
   沒有才新增，避免投遞重試造成重覆列。
6. 儲存並開啟 scenario。用本站端點的 **測試** 或跑一筆真實小額訂單驗證。

### Zapier

- Trigger：**Webhooks by Zapier → Catch Hook**（要驗簽改用 **Catch Raw Hook**）。
- Action：**Google Sheets → Create Spreadsheet Row**（冪等版用 **Lookup Spreadsheet Row** +
  **Update Row**）。欄位對映同上表。

---

## UC2 — MailerLite 打標籤 → 自動寄開課信

**目標：** 完成訂單 → 在 MailerLite upsert 訂閱者並打上 `{product}_buyer` group/tag →
由 MailerLite automation 觸發寄「開課通知信」。

### Make.com

1. 觸發器同 UC1：**Webhooks → Custom webhook**，URL 貼到本站建立系統端點，**測試**學結構。
2. 加 **MailerLite → Create/Update a Subscriber**（upsert by email）：
   - Email = `data.customer.email`
   - Name = `data.customer.name`
   - （選）自訂欄位：last_order_product = `data.productName`、last_order_id = `data.orderId`
3. 加 **MailerLite → Add Subscriber to a Group**（或 Add a Tag）：
   - Group/Tag 名稱用固定值或動態組出 `{product}_buyer`
     （例：`AI Coding 進階班_buyer`；建議先把 `data.productName` 正規化成穩定 slug）。
4. 在 **MailerLite 後台**建立一個 **Automation**：
   - **Trigger：** "When subscriber joins a group"（選上一步的 buyer group）
   - **Action：** 發送你的「開課通知 / 課程連結」email。
5.（可選分流）用 Make 的 **Router + Filter** 讀 `data.customer.isNewUser`：
   - `true`（新會員）→ 走「新帳號啟用 + 開課」信序；
   - `false`（既有會員）→ 只寄「開課」信，避免重覆歡迎訊息。
6. 儲存啟用；用本站端點 **測試** 跑一次確認訂閱者被建立且進了正確 group。

### 注意

- **冪等：** MailerLite 的 upsert-by-email 天生冪等；投遞重試不會產生重覆訂閱者。Group/Tag
  重覆加入亦為 no-op。
- **PII：** payload 含 email/name——確認你的 MailerLite 帳號與 Make 連線符合當地個資規範，
  端點 URL 保密。
- **開課信內容**由 MailerLite 端維護（不需改本站程式），行銷可自助調整。

---

## 疑難排解

| 症狀 | 可能原因 / 處置 |
|---|---|
| 端點沒收到任何事件 | 端點是否 **active**？scope 是否為 **system**？訂閱事件是否含 `order.completed` 或 `*`？先按 **測試** 送 `ping` 驗證連線 |
| 收到但 Make/Zapier 報 401/簽章錯 | 嚴謹驗簽時 secret 或 raw-body 取法不對——確認用 **raw body**（非重新序列化的 JSON）計算 HMAC，且 `t` 用 header 內的值 |
| 同一訂單出現重覆列/訂閱者 | 投遞重試所致——接收端改用 `data.orderId` / email 做 upsert（見各 UC 的冪等步驟） |
| 金額顯示成 149900 而非 1499 | `amount` 是最小貨幣單位；TWD 為 1:1，其他幣別（如 USD cents）需 `/100` |
| 訂單 paid 了但 CRM 沒更新 | egress 是 best-effort，不影響核帳。到 **系統 → 系統 Webhooks** 看該端點的投遞紀錄／重試該事件 |

---

## 範圍外（backlog）

- 第一方 connector 模組 `@saas/crm-google-sheets` / `@saas/crm-mailerlite`（免 Make 月費的直連版；
  同一事件源加 adapter 即可）。
- Transactional outbox / 佇列化投遞（未來硬化）。
- `order.refunded` 等更多事件（狀態 enum 已支援，之後按需求加）。
