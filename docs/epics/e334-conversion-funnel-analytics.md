# E334 — 轉化漏斗數據迴路（銷售頁 first-party analytics + UTM）

> Phase 81 · feature/backend+ui · Cycle 35 addendum 4（創作者價值評估，2026-07-12）
> Status: ⬜ pending
> Depends: E326, E327, E331

## Problem

Phase 77–80 給了創作者「開店、風格、客製」的全部工具，但**沒有任何成效測量** — 換了
style preset、改了痛點文案、上了新 hook 影片，看不到漏斗變化，就無法迭代。創作者的
思考循環是「假設 → 測量 → 迭代」；沒有這個 epic，前面蓋的都是盲目工具。原則：
**first-party、無第三方 cookie、不追個人** — 只做銷售頁聚合漏斗，隱私足跡最小。

## Solution

1. **事件表** — `sales_page_events`（高流量表，與 audit log 分開）：slug, event
   (`page_view | cta_click | checkout_started`), utm (source/medium/campaign, nullable),
   day-scoped anonymous session hash（**不存 IP/UA 原文、不設跨站 cookie、無 PII**）,
   created_at。付款完成不用進這表 — `orders`（E327）就是漏斗最後一層。
2. **採集** — 極輕量：`page_view` 在 `/p/[slug]` route 端記（ISR 下用一個 1px beacon route
   或輕量 client ping — 實作時選不傷 TTFB 的方案）；`cta_click`/`checkout_started` 由 E326
   的 CTA/結帳 client 元件發 beacon（`navigator.sendBeacon`，失敗靜默 — 絕不影響結帳）。
3. **UTM 落單** — 進頁時捕捉 UTM → 帶進 `createOneTimeCheckout` → 寫到 `orders.utm`
   （E327 表加 nullable JSONB 欄，expand-only）— 創作者能看「哪個渠道真的帶來付款」，
   不只帶來流量。
4. **後台漏斗視圖** — E331 的 admin tabs 加「轉化」tab（本 epic 在 E331 之後，不衝突）：
   每個銷售頁一列 — 瀏覽 → CTA 點擊 → 進結帳 → 付款（率 + 絕對數，7/30 天區間切換），
   點開看 UTM 渠道分解。`<DataTable>` 慣例。
5. **保留策略** — 事件表保留 90 天（cron 清理 note，或文件化手動清理 SQL）；聚合數字
   永久（訂單表本來就在）。

## Key Files
- `next-app/lib/schema.ts` + migrations（sales_page_events + orders.utm，expand-only）
- `next-app/lib/analytics/funnel.ts`（記錄 + 聚合查詢，含單元測試）
- `next-app/app/(dashboard)/dashboard/admin/**`（轉化 tab — E331 落地後追加）
- E326 CTA/countdown 元件的 beacon 掛點（一行級改動）

## Acceptance Criteria
- [ ] 三事件 + 訂單構成完整漏斗；admin 轉化 tab 正確顯示率與數（seed 數據驗證）
- [ ] UTM 從進頁一路落到 `orders.utm`（e2e 或 int test 佐證）
- [ ] 無 PII / 無第三方請求 / 無跨站 cookie（grep + 檢視佐證）；beacon 失敗不影響任何主流程
- [ ] 事件寫入對銷售頁 TTFB 零影響（page_view 不在 render path 同步寫 DB）
- [ ] Migration expand-only + review artifact；typecheck/lint/build + Vitest 綠

## Cross-Epic
- E326 — beacon 掛點；E327 — orders.utm；E331 — 轉化 tab 宿主
- E332/E333 — 漏斗按 slug 聚合，三層渲染模式一視同仁（custom page 也自動被測量）

## Out of Scope
- A/B 分流（有了本 epic 的測量，A/B 才有意義 — 列為其前置；future）
- 第三方 analytics（GA4/Plausible）整合 — 用戶要接可自行掛，模板保持 first-party
- 熱圖/錄屏/個人層級行為追蹤（隱私紅線）
