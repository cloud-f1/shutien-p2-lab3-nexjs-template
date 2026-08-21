# E339 — 記錄詳情頁慣例（record detail pattern）

> Phase 82 · feature/UI+convention · Cycle 36（fork harvest wave 3 — ai-rc-engineer-pm，2026-08-22）
> Status: ⬜ pending
> Depends: E338

## Problem

模板**完全沒有詳情頁範例**。所有 CRUD 都在 modal 裡（E273 慣例，正確），但真實產品一定會遇到
「這筆記錄資訊太多，塞不進 modal」的時刻——這時 fork 者只能自己發明結構，於是每個 fork 長得都不一樣。

fork 的 `app/(dashboard)/dashboard/cases/[id]/` 已經證明了一套可複製的骨架：
`page.tsx`（Server Component 取數）→ `_detail/header.tsx`（標題 + 狀態 + 操作按鈕）
+ `_detail/case-side.tsx`（右側屬性卡）+ 數張 `*-card.tsx`（各自一塊職責）
+ `_detail/voided-banner.tsx`（作廢/唯讀狀態橫幅）+ `_detail/types.ts`（共用 view-model 型別）。

模板缺的不是程式碼，是**一個可抄的範例 + 一條寫進 CLAUDE.md 的規則**。

## Solution

1. **範例路由**：`app/(dashboard)/dashboard/items/[id]/page.tsx` — 項目詳情頁（Server Component）：
   - `requireAuth()` → 取單筆 + 擁有者檢查（**IDOR 防護：非擁有者且非 admin → `notFound()`**，
     不是 redirect，避免洩漏存在性）
   - `generateMetadata()` 用記錄標題
   - 找不到 → `notFound()`；`app/(dashboard)/dashboard/items/[id]/not-found.tsx`
2. **`_detail/` 子元件慣例**（每支單一職責，皆為 Server Component 除非需要互動）：
   - `header.tsx` — 標題 + `StatusBadge` + 右側操作（編輯走既有 modal、刪除走 `ConfirmDialog`）
   - `side-card.tsx` — 屬性摘要（建立/更新時間、擁有者、ID）
   - `activity-card.tsx` — 該筆記錄的稽核紀錄（`getAuditLog` 依 targetId 過濾）
   - `readonly-banner.tsx` — 記錄處於唯讀/封存狀態時的橫幅（含原因與可做什麼）
   - `types.ts` — 詳情頁共用 view-model 型別（page.tsx 組出後往下傳，子元件不各自查 DB）
3. **導線接通**：清單列與手機卡片（E338）點擊 → 詳情頁；詳情頁麵包屑用 `NAV_LABELS` + 記錄標題；
   編輯 modal 從詳情頁開啟時，成功後 `router.refresh()` 就地更新（沿用 E273 慣例，不跳頁）。
4. **`CLAUDE.md` 加一條 Architecture Rule**：
   > 記錄詳情用 `dashboard/<domain>/[id]/page.tsx` + `_detail/` 子元件夾；page.tsx 負責全部取數與授權，
   > 子元件只收 props。CRUD 仍走 modal（E273）——詳情頁是**閱讀面**，不是第二套編輯流程。
5. `docs/playbooks/` 補一頁「清單 → 詳情 → 編輯」的三段式導線說明（含何時該做詳情頁的判準）。

## Key Files
- `next-app/app/(dashboard)/dashboard/items/[id]/page.tsx` · `not-found.tsx` · `_detail/*.tsx`
- `next-app/app/(dashboard)/dashboard/items/_items-table.tsx`（列/卡片接上連結）
- `CLAUDE.md`（Architecture Rules）· `docs/playbooks/list-detail-edit.md`（新）

## Acceptance Criteria
- [ ] `/dashboard/items/[id]` 可正常開啟；不存在的 id → 404 頁（非 500、非 redirect）
- [ ] **IDOR**：以 B 使用者的 session 開 A 使用者的項目 → 404；admin 可開（整合或 e2e 測試佐證）
- [ ] 頁籤標題與麵包屑顯示記錄標題
- [ ] 從詳情頁按「編輯」開既有 modal，儲存後**留在詳情頁**且內容已更新（不跳轉）
- [ ] 該筆記錄的稽核紀錄正確過濾（不會顯示別筆記錄的動態）
- [ ] `_detail/` 子元件皆不直接 import `db`（取數集中在 page.tsx — grep 佐證）
- [ ] 深色模式與手機寬度不破版
- [ ] CLAUDE.md 規則與 playbook 完成；typecheck / lint / unit / e2e 綠

## Cross-Epic
- E273 — CRUD 仍走 modal，詳情頁不重造編輯流程
- E338 — 清單/卡片的點擊入口
- E336 — 麵包屑標籤來源

## Out of Scope
- 詳情頁內的分頁式子資源（tabs）— 有需要時再開 epic
- 版本歷史/差異比對（稽核紀錄僅列事件）
