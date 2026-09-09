# E370 — 結帳端點加固：公開動作限流 + 重導 URL 同源

> Phase 89 · security · 🟢 **APPROVED — 使用者於 2026-09-09 依 code-review 結果核准**
> 來源：2026-09-09 `next-app/` 產品程式碼審查 F4 + F7

## Problem

**F4 —— 全專案唯一免登入的 Server Action，是唯一沒有限流的。**

`createOneTimeCheckoutAction`（`actions/checkout.ts:39`）宣告 `{ public: true }`。實測：

```
actions/checkout.ts 內 rateLimit 出現次數: 0
lib/define-action.ts 對 public 路徑套用限流: 0
```

每一個需要登入的動作都帶 `rateLimitGuard(...)`（`apikey:create` / `apikey:revoke` /
`2fa:login` …），偏偏這個**完全無 session 就能打**的沒有。匿名迴圈可以：

- 無上限灌 `orders` 列（`status: pending`，`customerEmail` 由攻擊者指定）
- 燒掉 Stripe／綠界的 session 建立配額
- 每次呼叫連帶觸發一次 `logAudit` 寫入

`defineAction` 的 public 路徑本身也沒有任何節流，所以未來新增的每個 public action 都會
繼承這個缺口 —— 這是框架層的問題，不只是這一個動作的問題。

**F7 —— `createCheckoutSession` 把呼叫端給的重導 URL 原封不動送給金流商。**

```ts
export async function createCheckoutSession(
  providerPriceId: string, successUrl: string, cancelUrl: string,
)
```

兩個 URL 是參數，未經驗證直接進 `provider.createCheckout({ successUrl, cancelUrl })`。
合法呼叫端（`components/marketing/pricing.tsx:30`）傳的是 `window.location.origin` 組出來的
路徑，但動作本身不強制這件事。

**注意：此動作並非公開** —— 第一件事就是 `requireAuth()`（審查初稿誤稱它為 public action，
已更正）。因此攻擊路徑較窄：登入者用惡意 `successUrl` 產生一個**綁在自己帳號上**的
checkout session，再把那個**貨真價實、品牌正確**的金流頁連結發給受害者；受害者付款後被導向
攻擊者控制的頁面。是釣魚輔助，不是直接的帳號接管。

`actions/checkout.ts:104` 已經示範了正確姿勢：**server 端**從 `NEXT_PUBLIC_APP_URL` 組 URL，
不接受呼叫端輸入。

## Solution

1. **`defineAction` 的 public 路徑加入預設限流。** 以 IP／forwarded-for 為 key（無 session
   可用），預設值保守（例如 10 次／分鐘），可由 action 設定覆寫。這是框架層修正 ——
   未來每個 public action 自動受保護。
2. `createOneTimeCheckoutAction` 明確宣告其限流參數（即使沿用預設，也寫出來）。
3. **`createCheckoutSession` 不再接受 URL 參數。** 比照 `checkout.ts:104`，改為 server 端
   從 `NEXT_PUBLIC_APP_URL` 組出成功／取消路徑；簽章改為只收 `providerPriceId`。
   呼叫端 `pricing.tsx:30` 同步簡化。
4. `registry/billing-stripe/actions/billing.ts:29` 是給 fork 用的範例模組，**同步修正**，
   否則它會把已修好的錯誤形狀繼續傳播給每個 fork。

## Key Files

- `next-app/lib/define-action.ts`
- `next-app/lib/rate-limit.ts`（若需要 IP-key 變體）
- `next-app/actions/checkout.ts`
- `next-app/actions/billing.ts`
- `next-app/components/marketing/pricing.tsx`
- `next-app/registry/billing-stripe/actions/billing.ts`

## Acceptance Criteria

1. 連續呼叫 `createOneTimeCheckout` 超過門檻 → 回限流錯誤，且**不再新增 `orders` 列**
   （斷言列數，非只斷言回傳值）。
2. 限流以 IP 為單位：不同 IP 互不影響（測試以 header 模擬）。
3. `createCheckoutSession` 的簽章不再含 `successUrl` / `cancelUrl`（型別層即擋住舊呼叫）。
4. 產生的 checkout session 的 `successUrl` 恆以 `NEXT_PUBLIC_APP_URL` 起頭（斷言傳給
   provider 的參數）。
5. `registry/billing-stripe` 的對應檔案同步修正。
6. 既有結帳 e2e 全綠。

## Cross-Epic

- 與 E367／E368／E371 檔案互斥，可並行。

## Out of Scope

- 不把 `lib/rate-limit.ts` 換成 Redis（該檔頭已註明為模板取捨，屬 fork 團隊的決定）。
