# E332 — 多銷售頁管理（DB-backed content + Admin CRUD + ISR）

> Phase 79 · feature/ui+backend · Cycle 35 addendum 2（後台管理面 audit，2026-07-12）
> Status: ⬜ pending
> Depends: E326, E327

## Problem

E326 的銷售頁內容住在 code config（`lib/sales/content.ts`）— 技術上支援多 slug，但每開一頁
要開發者改 code + 部署。用戶需求：**營運能在後台自行開/編/發佈多個一頁式銷售頁**。E326 已
預埋解耦（Zod `SalesPageContent` schema + 單一 `getSalesPageContent(slug)` resolver + pure
section components），本 epic 只換資料源，渲染層零修改。

## Solution

1. **Schema** — `sales_pages` 表：id, slug UNIQUE, `product_id` FK（E327 products）,
   `content` JSONB（**寫入時用 E326 的同一份 `SalesPageContent` Zod schema 驗證** — 單一內容
   契約，壞資料進不了庫；含 E326 的 `style` 欄位：preset + sectionVariants + sectionOrder）,
   `render_mode` (`structured|custom`, default `structured` — `custom` 表示此 slug 由 E333 的
   custom page registry 接管，本表只管 metadata/狀態), status (`draft|published`), published_at,
   timestamps。Migration expand-only；dev seed 把 E326 的 example config 灌成第一列。
2. **Resolver 切換** — `getSalesPageContent(slug)`：查 `sales_pages`（published only）→ miss 時
   fallback 到 config（向後相容 + seed 前可用）。（E333 之後會在最前面加 custom page registry
   判斷 — 本 epic 只需讓 `render_mode=custom` 的列不進 structured 渲染。）`/p/[slug]` 從純 SSG 改 **ISR**
   （`generateStaticParams` 從 DB + config 聯集；`revalidatePath('/p/[slug]')` on publish）。
3. **Admin CRUD** — `dashboard/admin/sales-pages/`（**獨立 route，不碰 E331 的 admin tabs 檔** —
   兩 epic 檔案不相交，可平行）：
   - 列表 `<DataTable>`：slug/標題/連結產品/狀態/更新時間 + 「檢視」連 `/p/[slug]`
   - 新增/編輯走 **modal convention**（Dialog + onSuccess；deep-link `?new=1` / `?edit=<id>`）：
     表單依 `SalesPageContent` 結構分區（Hero/痛點/模組/見證/定價/FAQ），陣列欄位可增刪列；
     Zod 驗證失敗逐欄報錯；**風格區**：style preset 下拉（bold/premium/clean）+ 區塊 variant/
     順序調整（E326 的 style 契約）— 營運不寫 code 就能讓每個產品長得不一樣
   - `render_mode=custom` 的列顯示「由 code 管理（E333）」badge，內容表單唯讀（避免兩邊打架）
   - 發佈/下架 action：flip status + `revalidatePath`；刪除用 `confirm-dialog`
   - 全部 `defineAction` + admin authorize（live role re-read）
4. **Draft 預覽** — `/p/[slug]?preview=<signed-token>`（admin 產生短效 token）可看 draft 版；
   無 token 時 draft 一律 404。
5. **導覽** — admin 區加入口連結（sidebar 或 E331 tabs 旁的連結 — 只加 link，不改 E331 檔）。

## Key Files
- `next-app/lib/schema.ts` + migration（sales_pages）+ migration-review artifact
- `next-app/lib/sales/content.ts`（resolver 改 DB-first + config fallback；Zod schema 本身不動）
- `next-app/app/(dashboard)/dashboard/admin/sales-pages/**`（page + form modal + actions）
- `next-app/actions/sales-pages.ts` · `next-app/app/p/[slug]/page.tsx`（SSG→ISR + preview）

## Acceptance Criteria
- [ ] 後台建一頁 → 發佈 → `/p/<new-slug>` 立即可見（revalidate 生效，不用部署）；下架 → 404
- [ ] JSONB content 寫入前過 `SalesPageContent` Zod 驗證（壞 payload 進不了庫 — 測試佐證）
- [ ] E326 example slug 在 seed 前仍由 config fallback 服務（零回歸）
- [ ] Draft：無 preview token 404；有效 token 可預覽；token 過期失效
- [ ] 非 admin 無法 CRUD/預覽 draft（server-side 測試）
- [ ] Modal + DataTable + confirm-dialog 慣例全數遵循；typecheck/lint/build + Vitest 綠

## Cross-Epic
- E326 — 同一份 Zod 內容契約 + resolver 解耦（該 epic 的驗收已保證 pure components）
- E327 — product_id 連結（一頁賣一個 SKU；CTA 自動綁該 product 結帳）
- E331 — 同 phase 平行：本 epic 獨佔 `admin/sales-pages/**`，E331 獨佔 `admin/` tabs 檔

## Out of Scope
- 視覺化拖拉編輯器 / 區塊重排（表單式編輯即可；future）
- A/B testing、每頁自訂主題色（future）
- 多語系銷售頁（i18n 架構已在，content schema 預留擴充即可，不本次實作）
