# E337 — 儀表板 widget kit（領域中立）+ 首頁混合升級

> Phase 82 · feature/UI · Cycle 36（fork harvest wave 3 — ai-rc-engineer-pm，2026-08-22）
> Status: ⬜ pending
> Depends: E336, E338

## Problem

模板首頁還是 shadcn `dashboard-01` 原裝拼貼（`SectionCards` 四張假數字卡 + 面積圖 + 表格 +
onboarding checklist）。它看起來像**範例**，不像**營運後台**：卡片點不下去、沒有「現在該處理什麼」
的入口、沒有系統動態。fork（`components/rc/dashboard/*`，10 個元件）證明了另一種組裝——
燈號 KPI 卡可深連結到已篩選的清單、注意事項卡把逾期/停滯的列出來、動態 feed 直接讀稽核紀錄——
但那些元件的 props 綁死了案件領域（`StackLevel`、`CaseVM`、`ALERT_META`）。

模板要的是**領域中立的元件庫**：任何 fork 換掉資料來源就能用。

## Solution

新增 `next-app/components/dashboard/`（與既有 `section-cards.tsx` 並存，不刪）：

1. **`row-link.tsx`** — 整塊可點的無障礙包裝：`<Link>` 包住 children，`aria-label` 必填，
   focus-visible ring，`className` 可透傳。所有卡片的點擊行為都走它（避免巢狀互動元素）。
2. **`stat-card.tsx`** — 狀態 KPI 卡：`{ tone: 'success'|'warning'|'danger'|'info'|'muted', label, value, hint?, href?, ariaLabel? }`。
   `value > 0` 且 tone 為 warning/danger 時套同色 8% 淡底（**只有真的要注意時才染色**）；
   顏色一律走 E259/E262 語意 token（`text-warning` / `bg-destructive/8`…），禁止 inline style 色彩；
   有 `href` 時整卡以 `RowLink` 包住。
3. **`stat-card-row.tsx`** — 2/4 欄響應式排列的容器（手機 2 欄、桌機 4 欄，`min-w` 防擠壓）。
4. **`trend-chart.tsx`** — 月度趨勢（Recharts，沿用 `chart-area-interactive` 已有的 chart 設定慣例）：
   `{ data: {label: string; value: number}[], valueLabel, height? }`。
5. **`stack-chart.tsx`** — 分類堆疊長條：`{ rows: {label: string; segments: {key,value,color?}[] }[] }`；
   color 省略時依序取 `--chart-1..5` token。
6. **`rank-chart.tsx`** — 排行橫條（Top N + 「其他」合併）：`{ rows: {label, value}[], topN? }`。
7. **`attention-card.tsx`** — 「需要注意」清單卡：`{ title, groups: {tone, heading, rows: {id,label,meta?,href?}[]}[], emptyText }`；
   每列走 `RowLink`；全空時顯示 emptyText（不是空白卡）。
8. **`upcoming-card.tsx`** — 時間窗清單卡：`{ title, rows: {id,label,dateLabel,overdue?,href?}[], emptyText }`；
   `overdue` 以 `text-destructive font-bold` 標示。
9. **`activity-card.tsx`** — 系統動態 feed：直接吃 `lib/audit.ts` 的 `AuditEntry[]`，
   顯示 actor · 動作 · 對象 · 相對時間；對象優先用人類可讀標籤、否則 `type:id` 截短。
10. **`greeting-header.tsx`** — 時段問候（早安/午安/晚安，時區可由 prop 指定，預設 `Asia/Taipei`）+
    長式繁中日期（含星期）+ 右側次要統計 chip（手機隱藏）。純 Server Component，
    `formatLongDate()` 具名匯出以便單元測試（UTC 解析避免跨日）。

**首頁混合升級**（`app/(dashboard)/dashboard/page.tsx`）——保留現有資產、補上營運感：

- 頂：`GreetingHeader`（使用者名稱 + 今日 + 「共 N 個項目」）
- 次：`StatCardRow` 四張真數字卡，**每張深連結到已篩選的項目清單**
  （`/dashboard/items?status=…`，由 E338 的 filter chips 接收 query param）
- 中：保留 `ChartAreaInteractiveLazy`（不動）
- 下：左 `AttentionCard`（最近建立但久未更新的項目）+ 右 `ActivityCard`（`getAuditLog(8)`）
- `OnboardingChecklist` 維持在最上方、完成後自動消失的既有行為
- **不刪 `SectionCards`**：改在 `/dashboard/components` 元件展示頁保留一份，並補上新 widget kit 的展示區塊
- 資料一次 `Promise.all` 取完（維持現行無 waterfall 的寫法）；admin 才查的統計維持條件式

## Key Files
- `next-app/components/dashboard/*.tsx`（10 個新元件）+ 對應 `*.test.tsx`（至少 stat-card / attention-card / greeting-header）
- `next-app/app/(dashboard)/dashboard/page.tsx`（改組裝）
- `next-app/app/(dashboard)/dashboard/components/page.tsx`（元件展示頁補區塊）

## Acceptance Criteria
- [ ] 10 個元件全部領域中立：props 只含 primitive / 泛型結構，**不 import 任何 `lib/items-*`、`lib/sales/*` 等領域模組**（grep 佐證）
- [ ] 無 inline style 色彩、無硬編色碼；全部走語意 token 與 `cn()`（stop-verifier 過）
- [ ] `StatCard` 有 href 時整卡可鍵盤 focus 並可 Enter 觸發；`aria-label` 含數值語意
- [ ] 首頁四張 stat card 為**真數字**（來自 DB），點擊後落在已套用該篩選的項目清單
- [ ] 動態 feed 讀真稽核紀錄；無紀錄時顯示 empty state 而非空卡
- [ ] 深色模式下 10 個元件皆不破版（元件展示頁人工/截圖佐證）
- [ ] 單元測試涵蓋 tone→class 對映、empty state、`formatLongDate` 跨月/跨年邊界
- [ ] typecheck / lint / unit 綠；首頁既有 e2e 不回歸（onboarding checklist 行為不變）

## Cross-Epic
- E336 — 深連結目標不得新增導覽項；沿用既有 `/dashboard/items`
- E338 — stat card 的 `?status=` query 由 filter chip 消費，兩邊 param 名稱必須一致（以 E338 定義為準）
- E262 — StatusBadge 的 tone 命名沿用（success/warning/info/danger/muted），不另創一套

## Out of Scope
- 可拖曳/可自訂版面的 widget dashboard（本 epic 是固定組裝）
- 即時推送（維持 request-time 取數）
