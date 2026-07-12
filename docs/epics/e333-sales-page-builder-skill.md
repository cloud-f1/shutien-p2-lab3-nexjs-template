# E333 — sales-page-builder skill：HTML 一頁式 ingest → 客製 TSX 銷售頁

> Phase 80 · feature/skill+infra · Cycle 35 addendum 3（銷售頁風格多樣化需求，2026-07-12）
> Status: ⬜ pending
> Depends: E326, E327, E332

## Problem

高轉換銷售頁的常態是「各顯神通」：設計師/AI 常交付**一個獨立 HTML**（Claude-Design、Figma export、
外包產出），視覺完全客製、不受版型約束。E326 的 preset/variant 系統覆蓋 80% 場景，但頂級單品
（旗艦課程、大檔期活動頁）需要整頁客製。用戶要求：**保留 code / agent-skill 路徑** — 把一頁 HTML
交給 agent，產出正式的 `/p/[slug]` 客製頁，銷售機能（結帳/倒數/影片）自動接上。模板已有現成
拼圖：`mockup-to-epics` skill（HTML handoff ingest 慣例）、`@designer` agent + `/athena:design`
（tokens → TSX 頁）、design-system skill — 缺的是把它們串成「銷售頁專用」流水線的 skill + 掛載點。

## Solution

1. **Custom page registry** — `lib/sales/custom-pages.ts`：`Record<slug, React.ComponentType
   <SalesPageProps>>`（lazy import）。`app/p/[slug]/page.tsx` 渲染順序：**custom registry →
   structured renderer（DB/config）**。`SalesPageProps` 注入 product（E327）+ checkout binding —
   客製頁不用自己查價格/接金流。
2. **Skill** — `.claude/skills/sales-page-builder/SKILL.md`（agent 工作流，非 runtime code）：
   - **輸入**：一個 HTML 檔（或 Claude-Design handoff 目錄）+ 目標 product slug
   - **Phase 1 拆解**：沿用 `mockup-to-epics` 的 ingest 慣例 — 讀 HTML、抽出視覺結構/配色/字型/
     區塊，對照 design-system tokens 做映射表（哪些客製色升格為 page-scoped CSS vars）
   - **Phase 2 轉換**：產出 `components/sales-pages/<slug>/page-content.tsx`（Client/Server 邊界
     依 E326 慣例：只有倒數/CTA hydrate）— **強制規則**：不搬 HTML 的 inline style 色彩
     （stop-verifier 會擋）、dark-mode 至少不破版、`cn()` 組合、圖片走 `next/image`
   - **Phase 3 接機能**：CTA → E327 `createOneTimeCheckout`（product 從 props 來）、倒數計時 →
     E326 `countdown-timer`、hook video → `video-demo` 慣例、感謝頁沿用 `/p/[slug]/thanks`
   - **Phase 4 驗收**：registry 註冊 + E332 後台把該 slug 標 `render_mode=custom` + typecheck/
     lint/build + Playwright smoke（頁面渲染 + CTA 觸發結帳 action）+ Lighthouse 提示
     （SSG/ISR 維持極速加載 — PRD 的「慢 1 秒掉 7% 轉化」紅線）
   - Skill 文件含**轉換對照表**（HTML pattern → 模板慣例）與常見陷阱（字型自載、hero 影片
     autoplay 政策、CSP 內聯 script 禁用）
3. **範例**：轉換一個 example HTML（可用 Claude-Design 產一頁）作為 reference 實作 +
   skill 的 walkthrough 素材。
4. **文件**：`docs/playbooks/` 加一頁「三層銷售頁架構」（structured preset / style variant /
   custom page — 何時用哪層、成本對照），連回 E326/E332/E333。

## Key Files
- `.claude/skills/sales-page-builder/SKILL.md`
- `next-app/lib/sales/custom-pages.ts` + `app/p/[slug]/page.tsx`（registry 判斷）
- `next-app/components/sales-pages/<example-slug>/page-content.tsx`（reference 實作）
- `docs/playbooks/sales-page-tiers.md`

## Acceptance Criteria
- [ ] Custom registry 生效：註冊 slug 走客製頁、未註冊走 structured renderer（測試佐證兩路徑）
- [ ] Reference 客製頁：由一個 example HTML 轉換而來，CTA 真接 E327 結帳、倒數/影片機能正常、
      無 inline style 色彩（stop-verifier 過）、dark-mode 不破版
- [ ] E332 後台：custom slug 顯示 badge + 內容表單唯讀（不與 code 打架）
- [ ] Skill 走完一輪 walkthrough 可重現 reference 頁（文件含轉換對照表 + 陷阱清單）
- [ ] Playwright smoke：兩種 render mode 各一條；typecheck/lint/build 綠
- [ ] 三層架構 playbook 完成（何時 preset / variant / custom 的決策表）

## Cross-Epic
- E326 — SalesPageProps/機能元件來源；E327 — checkout binding；E332 — render_mode 互斥保護
- `mockup-to-epics` / `@designer` / `design-system` — 直接沿用其 ingest 與 token 慣例，
  skill 只做「銷售頁專用」的窄化版，不重造

## Out of Scope
- Runtime HTML 上傳/渲染（XSS/CSP/token 漂移風險 — 客製頁一律走 code + PR + 部署）
- A/B testing 分流（future — registry 結構已預留同 slug 多版本的擴充空間）
- 視覺化編輯器（維持 agent/code 路徑）
