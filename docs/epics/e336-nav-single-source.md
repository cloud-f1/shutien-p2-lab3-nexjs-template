# E336 — 導覽單一資料源（Nav SSOT）+ 鎖定式權限導覽

> Phase 82 · refactor/UI · Cycle 36（fork harvest wave 3 — ai-rc-engineer-pm，2026-08-22）
> Status: ⬜ pending
> Depends: none

## Problem

同一份導覽資訊目前**寫死在四個地方**，加一個頁面就要改四處，而且已經開始漂移：

| 檔案 | 內容 | 漂移證據 |
|---|---|---|
| `components/app-sidebar.tsx:41` `navMain` | 儀表板/項目/內容庫/設定/系統 + admin 兩項 | 有「內容庫」「系統」 |
| `components/mobile-tab-bar.tsx:28` `TABS` | Dashboard/Items/Admin/Settings（**英文 label**） | 缺內容庫、缺系統，label 語言不一致 |
| `components/app-breadcrumb.tsx:17` `LABELS` | 8 個 segment → 中文字串 | 含已不存在的 `team`、`billing` |
| `components/command-palette.tsx:70` 硬編 `CommandItem` | 只有 4 項 | 缺內容庫/系統 |

同時，權限處理只有「隱藏」一種模式（`adminOnly` → 不渲染）。fork 的做法更好：**桌機側欄上鎖顯示
（Lock icon + tooltip 說明為何不可用），行動 Tab Bar 才隱藏** — 使用者知道功能存在、知道要找誰開權限，
而不是懷疑自己記錯。

## Solution

1. **`next-app/lib/nav.ts`** — 唯一資料源（純資料 + 純函式，無 JSX、可單元測試）：
   ```ts
   export interface NavItem {
     id: string
     label: string        // 側欄 / 麵包屑完整名稱
     short: string        // Tab Bar 精簡名稱
     url: string
     icon: LucideIcon     // 元件參考，非 JSX element
     segment: string      // 麵包屑比對用的 path segment
     lockFor?: Role[]     // 對這些角色「上鎖」（顯示但不可點）
     hideFor?: Role[]     // 對這些角色「隱藏」（完全不渲染）
     inPalette?: boolean  // 是否進 ⌘K 命令面板（預設 true）
     inTabBar?: boolean   // 是否進行動 Tab Bar（預設 false，Tab Bar 只放 5 個主要目的地）
   }
   export interface NavGroup { label: string; items: NavItem[] }
   export const NAV_GROUPS: NavGroup[]      // 桌機側欄分組：總覽 / 內容 / 設定 / 管理
   export const NAV_FLAT: NavItem[]         // 攤平（Tab Bar / 命令面板 / 麵包屑查表用）
   export const NAV_LABELS: Record<string, string>  // 由 NAV_FLAT 推導，麵包屑用；額外 segment（如 `[id]` 之外的靜態段）以 EXTRA_LABELS 併入
   export function isNavLocked(item: NavItem, role?: Role | string): boolean
   export function isNavHidden(item: NavItem, role?: Role | string): boolean
   export function visibleNav(items: NavItem[], role?: Role | string): NavItem[]  // 濾掉 hidden，保留 locked
   ```
   分組建議：**總覽**（儀表板）·**內容**（項目、內容庫）·**設定**（設定、系統）·**管理**（管理、銷售頁 — `hideFor` 非 admin）。
2. **五個消費端改吃 SSOT**（各自只保留渲染邏輯，零導覽資料）：
   - `nav-main.tsx` — 依 `NAV_GROUPS` 分組渲染（`SidebarGroupLabel` 分類標題；收合成 icon rail 時自動隱藏）；locked 項改渲染 `Lock` icon + `aria-disabled` + tooltip 文案、不包 `<Link>`；active 樣式 `bg-primary/10 text-primary`；子路徑仍 active（`pathname.startsWith(url + "/")`，`/dashboard` 例外用嚴格相等）。
   - `app-sidebar.tsx` — 刪掉 `navMain` 陣列，改傳 `role`。
   - `mobile-tab-bar.tsx` — 刪掉 `TABS`，改用 `NAV_FLAT.filter(i => i.inTabBar)` + `visibleNav()`；label 用 `short`（中文，與側欄一致）；**維持 z-40**（E323 已記的教訓：不可蓋過 Dialog/Sheet 的 z-50）。
   - `app-breadcrumb.tsx` — 刪掉本地 `LABELS`，改用 `NAV_LABELS`（順便移除已死的 `team`/`billing`）。
   - `command-palette.tsx` — 「前往」群組由 `visibleNav(NAV_FLAT.filter(i => i.inPalette !== false), role)` 產生；「操作」群組維持手寫。命令面板需要 role → 由 `site-header`/layout 傳入。
3. **`components/sidebar-collapse-persist.tsx`**（移植自 fork）— 把 shadcn Sidebar 的收合狀態鏡射到
   `localStorage["sidebarCollapsed"]`：掛載時套用上次狀態、之後 state 變動寫回；`return null`，
   `try/catch` 包住 storage 存取（無痕視窗/停用 site data 會 throw）。掛在 `app-sidebar.tsx` 內。

## Key Files
- `next-app/lib/nav.ts`（新）+ `lib/nav.test.ts`（新）
- `next-app/components/nav-main.tsx` · `app-sidebar.tsx` · `mobile-tab-bar.tsx` · `app-breadcrumb.tsx` · `command-palette.tsx`（皆改為消費端）
- `next-app/components/sidebar-collapse-persist.tsx`（新）
- `CLAUDE.md` — Architecture Rules 加一條：導覽項目一律加在 `lib/nav.ts`，禁止在元件內硬編

## Acceptance Criteria
- [ ] `lib/nav.ts` 是唯一導覽資料源；上述 5 個元件內**不存在**任何 route/label 字面值陣列（grep 佐證）
- [ ] 單元測試：`isNavLocked` / `isNavHidden` / `visibleNav` 三角色（admin/editor/viewer）矩陣；`NAV_LABELS` 涵蓋所有 `NAV_FLAT` segment
- [ ] 桌機側欄：分組標題顯示；viewer 看到「管理」被隱藏、「系統」上鎖（Lock icon + tooltip、不可點、`aria-disabled`）
- [ ] 行動 Tab Bar：locked 與 hidden 皆不顯示；label 為中文 `short`；z-index 維持 z-40（Dialog 底部按鈕仍可點 — e2e 佐證）
- [ ] 麵包屑與命令面板的可見項目與側欄一致（同一 role 下三者不再有落差）
- [ ] 側欄收合狀態重新整理後保留；localStorage 不可用時不 throw、退回預設展開
- [ ] typecheck / lint / unit 綠；既有 e2e 不回歸

## Cross-Epic
- E323 — Tab Bar z-index 教訓沿用，不可回退
- E337 — 儀表板 stat card 深連結目標需存在於 `NAV_FLAT`（不新增導覽項）
- E339 — 詳情頁麵包屑靠 `NAV_LABELS` + 記錄標題

## Out of Scope
- 導覽項目 CRUD 後台（本 epic 是編譯期常數，不做 DB 驅動導覽）
- i18n 抽字串檔（維持現行繁中內嵌慣例）
