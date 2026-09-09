# E375 — 限流可觀測性 + 公開結帳門檻檢討 + 一處假宣稱

> Phase 90 · security/ops · 🟢 **APPROVED — 2026-09-09**

## Problem

### (a) 限流觸發是完全靜默的

`lib/rate-limit.ts` 的 `rateLimitGuard` 只做一件事：

```ts
export function rateLimitGuard(key, limit, windowMs): { error: string } | null {
  const { ok, retryAfter } = rateLimit(key, limit, windowMs)
  if (ok) return null
  return { error: `請求過於頻繁，請於 ${retryAfter} 秒後再試。` }
}
```

**沒有任何事件、日誌或稽核紀錄。** E370 之後，`createOneTimeCheckout`（唯一的
免登入端點、且直接連著金流）受限流管轄 —— 但當它開始擋人時，fork 的營運者
看不到任何訊號。失敗模式是**靜默的營收損失**：買家看到「請求過於頻繁」，
營運者看到轉換率下降，兩者之間沒有可查的線索。

### (b) 10 次/分鐘/IP 對真實買家可能過嚴

E370 選的預設值（`PUBLIC_ACTION_DEFAULT_RATE_LIMIT = 10/min`）對「阻擋匿名迴圈
灌 orders」是合理的，但**沒有對照真實流量驗證過**。具體風險：行動網路的 CGNAT
與企業 NAT 會讓大量真實買家共用同一個出口 IP。一場成功的發表會 —— 正是這個
模板存在的目的 —— 可能是最容易觸發它的場景。

且 `clientIpKey` 讀的 `x-forwarded-for` 在沒有可信代理覆寫的部署上是客戶端可控的
（E370 的函式註解已誠實記錄），所以現行設計同時**既可能擋到真人、又可能被繞過**。

### (c) `lib/billing/orders.ts:138` 的宣稱不成立

```
* and a lost activation mail degrades to the standard forgot-password flow.
```

實際上不會。`requestPasswordReset` 只在 `user?.passwordHash` 為真時才寄信，而
訪客結帳建立的空殼帳號 `passwordHash` 是 `null` —— 它會拿到
`{ success: true }` 然後什麼都不發生。

（E371 之後**確實**有了一條自助救援路徑：空殼可以自助註冊。但那是 register，
不是 forgot-password，註解仍然指向錯的那條。）

## Solution

1. **可觀測性**：`rateLimitGuard` 觸發時發出結構化事件（沿用 `logAudit` 或
   `scripts/hooks/audit-emit-*` 的既有管道），至少含 key 前綴（不含完整 IP）、
   limit、windowMs。**不得**記錄完整 IP —— 那會把限流器變成一個未經同意的
   訪客紀錄表。
2. **門檻檢討**：把 public action 的預設維持保守（新端點應保守），但為
   `createOneTimeCheckout` 明確設定一個較寬鬆、有理由的值；理由寫進程式碼註解。
   若採用「登入者用 session key、匿名者用 IP」以外的分層，一併說明。
3. **修正 (c) 的註解**，指向實際存在的救援路徑（register 與 admin 的重寄啟用信
   `canResendActivation`）。

## Acceptance Criteria

1. 限流觸發會產生一筆可查詢的事件；`.claude/audit.jsonl` 或 `audit_log`
   （擇一，實作時決定並說明）可用 `jq`/SQL 撈出。
2. 事件**不含**完整 IP（以測試斷言）。
3. `createOneTimeCheckout` 的門檻值在程式碼中附有選擇理由。
4. `orders.ts` 的註解與實際行為一致（可用 E341 的 doc-contract 測試釘住更好）。
5. 既有的 E370 限流測試仍全綠。

## Out of Scope

- 不把 `lib/rate-limit.ts` 換成 Redis/edge-KV（該檔頭已載明此為模板取捨，
  屬 fork 團隊的決定；本 epic 只讓現況可觀測、參數有據）。
