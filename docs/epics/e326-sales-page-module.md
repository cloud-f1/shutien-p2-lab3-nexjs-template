# E326 — 高轉換銷售頁模組（Sales Page — AIDA sections + hook video）

> Phase 77 · feature/ui · Cycle 35（數位產品/課程銷售頁 PRD，2026-07-12）
> Status: ⬜ pending

## Problem

The template ships a SaaS marketing homepage (`app/page.tsx` + `components/marketing/*`) but no
**dedicated high-conversion sales page** for digital products / online courses. The approved PRD
defines an AIDA-structured page (Hero → 痛點共鳴 → 解決方案 → 模組大綱 → 見證 → 定價+風險逆轉 →
FAQ) with a 3-second hook video and countdown urgency — 4 of those sections don't exist yet.

## Solution

Data-driven sales page route reusing existing marketing primitives, plus the missing sections.

1. **Route** — `app/p/[slug]/page.tsx` (Server Component, SSG via `generateStaticParams` from the
   content config; ISR-ready). Only countdown + CTA hydrate client-side.
2. **Content config** — `lib/sales/content.ts`: typed `SalesPageContent` (hero copy, pain points[],
   solution, modules[], testimonials[], price/originalPrice/deadline, faq[]) keyed by slug. Ship one
   example product with the PRD's zh-TW 文案範本 as placeholder copy (【】markers kept). DB-backed
   products/pricing come from E327 — this config owns *copy*, not SKUs.
   **設計約束（E332 鋪路，user decision 2026-07-12）**：`SalesPageContent` 必須是 **Zod schema**
   （不只是 TS type — E332 的 DB JSONB 內容用同一份 schema 驗證），且 route 取內容只透過**單一
   resolver `getSalesPageContent(slug)`**；所有區塊元件是 pure（吃 content prop，不知道內容來源）。
   E332 把 resolver 換成 DB-backed（config 降級為 fallback/seed）時，元件層零修改。
3. **Style presets + 區塊 variants（user requirement 2026-07-12：不同產品要長得不一樣）** —
   `lib/sales/styles.ts`: `SalesPageStyle` preset 系統（每個 preset = 一組 Tailwind class 組合：
   配色強調、字級節奏、區塊底色/間距、CTA 樣式），內建 3 個轉化導向 preset：
   - `bold` — 高對比促購型（亮色 CTA、大字痛點、緊湊節奏）
   - `premium` — 深色質感型（適合高單價課程）
   - `clean` — 極簡信任型（適合 B2B/專業受眾）
   全部走 design tokens + `dark:` variants（**不產生 inline style 色彩** — stop-verifier 規則），
   `cn()` 組合。每個區塊元件收 `variant` prop（如 hero: `video-left | video-top | minimal`）。
   content 契約加 `style: { preset, sectionVariants?, sectionOrder? }` — **區塊順序可重排/可省略**
   （不是每個產品都要全部 7 區塊）。
4. **New sections** under `components/marketing/sales/`:
   - `pain-points.tsx` — 痛點共鳴 checklist (「你是否也正深陷這些困境？」)
   - `solution.tsx` — 解決方案 + product mockup slot
   - `modules-table.tsx` — 模組/章節 → 核心內容 → 預期收穫 (marketing content table, not a record
     list — `<DataTable>` rule does not apply)
   - `countdown-timer.tsx` — `"use client"`, counts to `deadline` from config; hides gracefully when
     expired (no fake-reset dark pattern)
   - `risk-reversal.tsx` — 30 天退款保證 badge + 信任小字（學員數）
5. **Hook video** — extend/reuse `components/marketing/video-demo.tsx`: `muted autoPlay playsInline
   loop` + `<track kind="captions">` slot + poster; lazy below-fold.
6. **Reuse as-is**: `hero`(variant props if needed), `social-proof`, `testimonials`, `faq`, `cta`.
   CTA accepts an `href`/`onCheckout` binding point — actual checkout wiring lands in E327.
7. Metadata: OG/Twitter tags per product for ad-traffic sharing.

## Key Files
- `next-app/app/p/[slug]/page.tsx`
- `next-app/lib/sales/content.ts`
- `next-app/components/marketing/sales/{pain-points,solution,modules-table,countdown-timer,risk-reversal}.tsx`
- `next-app/components/marketing/video-demo.tsx` (enhance, don't fork)

## Acceptance Criteria
- [ ] `/p/<example-slug>` renders all 7 PRD sections in order, zh-TW placeholder copy from config
- [ ] `SalesPageContent` is a Zod schema; page/route reads content ONLY via `getSalesPageContent(slug)`;
      section components are pure (no config/DB imports — grep 佐證)
- [ ] 3 style presets (`bold`/`premium`/`clean`) 可切換且皆過 dark-mode 檢查；`sectionOrder` 重排/
      省略區塊正常渲染（example config 展示至少 2 個 preset 的差異）
- [ ] Page is statically generated; only countdown/CTA are client components (`"use client"` count ≤ 2 new)
- [ ] Countdown renders remaining time and hides after deadline (unit test on the pure time helper)
- [ ] Video: muted autoplay + captions track slot + poster; no CLS (fixed aspect ratio)
- [ ] Dark mode correct (Tailwind `dark:` only — no inline style colors); `cn()` for conditionals
- [ ] typecheck / lint / build green; Vitest for content-config resolver + countdown helper

## Cross-Epic
- E327 — CTA binds to one-time checkout (soft: E326 ships with placeholder CTA link)
- E250/E261 — existing landing/marketing components are the primitive source; do not duplicate

## Out of Scope
- Purchasable SKUs / checkout / orders → E327；交付開通 → E328
- Admin 多銷售頁管理（DB-backed content + CRUD）→ E332（resolver 已為其解耦）
- A/B testing, analytics events (future epic)
