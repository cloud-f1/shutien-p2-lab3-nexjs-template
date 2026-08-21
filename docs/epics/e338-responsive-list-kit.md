# E338 — 響應式列表套件：DataTable 手機卡片 + 快篩 chip + dense + 狀態原件

> Phase 82 · feature/UI · Cycle 36（fork harvest wave 3 — ai-rc-engineer-pm，2026-08-22）
> Status: ⬜ pending
> Depends: none

## Problem

`components/data-table-generic.tsx`（188 行）只有：全域搜尋框 + 分頁 + 每頁筆數。手機上它就是
一張硬擠的表格——欄位被壓扁、要橫向捲、主要資訊看不到。fork 的清單在 `<768px` **整個換成卡片列表**
（`mobile-case-card.tsx`：狀態燈 + 編號 + 類型 chip + 標題 + 進度條 + 次要資訊兩端對齊 + `ChevronRight`），
桌機才用表格；並且在搜尋框旁邊放一排 **快篩 chip**（`filter-chip.tsx`）做一鍵狀態篩選，
比下拉選單快得多。

模板另外缺一組小狀態原件：`StatusBadge` 有了，但**進度條**、**類型 chip**、**角色徽章**、
**狀態燈點**都沒有，每個 fork 都要自己重畫一次。

## Solution

1. **`data-table-generic.tsx` 擴充**（維持 API 向後相容，全部新 prop 皆選填）：
   - `renderMobileCard?: (row: TData) => React.ReactNode` — 提供時，`<768px`（`useIsMobile()`）
     改渲染卡片列表；**篩選/分頁/每頁筆數的狀態與桌機共用同一個 TanStack table instance**
     （不是兩套 state）。未提供時行為完全不變。
   - `dense?: boolean` — 緊湊列高（`py-1.5` vs 預設），給資料量大的管理台用。
   - `chips?: React.ReactNode` — 渲染在搜尋框下方的快篩列。
   - `emptyState?: React.ReactNode` — 取代目前的「無資料」文字列（桌機/手機共用）。
2. **`components/filter-chip.tsx`**（移植 + 去領域化）：
   - `<FilterChip active onClick tone? children />` — `tone` 走語意 token（success/warning/danger/info），
     **不接受任意色碼**（fork 版用 inline style + `color-mix` 吃自訂類別色；模板改成 token 對映表，
     符合 stop-verifier 的「禁止 inline style 色彩」規則）。
   - `<FilterChipBar>` 容器（橫向可捲、手機不換行）+ `<Sep />` 分隔線。
   - 快篩狀態同步到 URL query（`?status=`），讓外部可深連結進來（E337 的 stat card 需要）。
     **本 epic 定義 query param 名稱，E337 依此對齊。**
3. **狀態原件三支**（`components/` 根層，與 `status-badge.tsx` 同級）：
   - `status-light.tsx` — 小圓點燈號 `{ tone, pulse? }`，附 `aria-label`。
   - `progress-bar.tsx` — `{ pct, tone?, showLabel? }`，`role="progressbar"` + `aria-valuenow`。
   - `type-chip.tsx` — `{ code, name, tone? }` 分類標籤（代碼 + 名稱，代碼用 mono）。
   - `role-badge.tsx` — 角色徽章，直接吃 `Role` 型別，admin/editor/viewer 各自 tone，
     文案取自單一對映表（未來換角色只改一處）。
4. **套用到既有清單**：`app/(dashboard)/dashboard/items/_items-table.tsx` 接上
   `renderMobileCard`（卡片顯示標題 + 狀態 badge + 建立日期 + `ChevronRight`）+ 快篩 chip；
   `dashboard/admin` 的會員/訂單/訂閱三個管理台改用 `dense`。

## Key Files
- `next-app/components/data-table-generic.tsx`（擴充）
- `next-app/components/filter-chip.tsx` · `status-light.tsx` · `progress-bar.tsx` · `type-chip.tsx` · `role-badge.tsx`（新）
- `next-app/app/(dashboard)/dashboard/items/_items-table.tsx`（套用）
- `next-app/app/(dashboard)/dashboard/admin/_{members,orders,subscriptions}-tab.tsx`（`dense`）
- `next-app/app/(dashboard)/dashboard/components/page.tsx`（展示新原件）
- `CLAUDE.md` — 更新 DataTable 那條規則：清單一律用 `<DataTable>`，手機卡片走 `renderMobileCard`

## Acceptance Criteria
- [ ] **向後相容**：未傳新 prop 的既有呼叫端行為與畫面完全不變（既有測試不改一行即綠）
- [ ] 手機卡片模式與桌機表格**共用同一份篩選/分頁狀態**：手機打字篩選後切到桌機寬度，結果與頁碼一致（測試佐證）
- [ ] 快篩 chip 寫入/讀取 URL query；帶著 `?status=…` 直接開頁面時 chip 已是選取狀態
- [ ] 四支狀態原件皆有無障礙屬性（`aria-label` / `role="progressbar"` / `aria-valuenow`），無 inline style 色彩
- [ ] `dense` 模式在三個管理台生效，欄位不裁切
- [ ] Playwright：一條手機 viewport（390×844）e2e — 項目清單顯示卡片而非表格、點卡片可進入、Tab Bar 未遮住內容
- [ ] 單元測試：`renderMobileCard` 分支、chip↔query 同步、`progress-bar` 邊界（0 / 100 / 超界夾住）
- [ ] typecheck / lint / unit 綠

## Cross-Epic
- E337 — stat card 深連結的 query param 以本 epic 定義為準
- E339 — 詳情頁的入口即卡片/列的 `ChevronRight`
- E262 — tone 命名沿用 `StatusBadge`，不另創

## Out of Scope
- 伺服器端分頁/排序（維持現行 client-side；資料量門檻另議）
- 欄位顯示/隱藏設定與使用者偏好持久化
