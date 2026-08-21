# E342 — context 三件套：架構速查一頁紙 · 領域摘要 · handoff 慣例

> Phase 82 · docs/context · Cycle 36（fork harvest wave 3 — ai-rc-engineer-pm，2026-08-22）
> Status: ⬜ pending
> Depends: none

## Problem

新 session（人或 agent）要「知道這個系統長怎樣」目前只有三條路：讀 `CLAUDE.md`（規則，不是形狀）、
讀 `EPIC_INDEX.md`（343 條歷史，不是現況）、或直接讀程式碼。fork 解決了這件事，做法值得回收：

1. **`docs/architecture/product-overview.md`** — 一頁紙：這是什麼、給誰用、技術棧、版本、
   登入方式、migration 數量、**「明確不做的事」**（non-goals）、角色與權限、主要畫面。
   任何人 90 秒內拿到系統形狀，不用讀 PRD 也不用讀 epic 史。其中 **non-goals 區塊最有價值**——
   它防止後續 agent「好心」把已經刻意排除的功能加回來。
2. **`docs/reference/guide-domain-digest.md`** — 領域規則速查：**每個數字/規則都標來源**，
   並宣告「衝突時 SSOT 勝」。它是餵給 `user-guide-builder` 的事實清單，讓寫手冊的 agent
   不用自己從程式碼推規則（推錯就寫進手冊）。
3. **`docs/_handoff/`** — 設計交付區慣例：`README.md` 說明這個資料夾是什麼、
   `project/`（PRD / 領域 SSOT / 原型）、`screenshots/`（逐頁截圖）。
   `mockup-to-epics` 與 `alignment-audit` 兩支 skill 都預設有這個位置，但模板從沒建立過它。

模板現在完全沒有這三樣。fork 者第一天就會需要它們，而且是**每個 fork 都要重新發明**。

## Solution

1. **`docs/architecture/product-overview.md`** — 寫模板自己的版本（不是空殼樣板）：
   - 這是什麼 / 給誰 / 技術棧表格 / 版本來源（`lib/branding.ts` `APP_VERSION` ← `package.json`）
   - **登入與身分**：Auth.js v5 Credentials + **JWT sessions（非 DB sessions）** 的硬性理由、
     RBAC 每次從 DB 重讀 role 的理由（這是模板最常被踩的坑，一頁紙就該講）
   - **明確不做的事**：多租戶隔離、i18n 抽字串檔、server-side 分頁、即時推送、
     production-grade rate limiting（現為 in-memory 單行程）— 各附一句「若要做，從哪裡開始」
   - 角色三階（admin/editor/viewer）與能力矩陣指向 `lib/team-utils.ts`（不複製數值，避免與 E341 契約打架）
   - 主要畫面清單指向 `lib/nav.ts`（E336 落地後的唯一導覽源）
   - migration 數量與範圍指向 `next-app/drizzle/migrations/`
   - 檔頭標註「Current as of vX.Y.Z (日期)」，並在 `release-versioning` skill 的清單加一條：發版時更新此行
2. **`docs/reference/domain-digest.md`** — 模板版的領域摘要 + **給 fork 者的填寫指引**：
   結構（分類/狀態機/計算規則/權限例外/邊界值）、每條標來源的格式、SSOT 衝突處置原則；
   模板本身的內容以「項目 items + 內容庫 library + 訂單 orders」三個現有領域示範一遍。
   `user-guide-builder` skill 補一行：撰寫前先讀這份 digest。
3. **`docs/_handoff/`** — 建立資料夾 + `README.md`（慣例說明 + `.gitkeep` 於 `project/`、`screenshots/`）：
   誰放什麼、什麼會被 `mockup-to-epics` 讀、什麼會被 `alignment-audit` 拿來比對、
   哪些檔案該進版控（設計產出：是；大型二進位原稿：否）。
4. **`docs/README.md`**（導覽索引）加入這三個新入口；`CLAUDE.md` 的 File Layout 區塊同步。

## Key Files
- `docs/architecture/product-overview.md`（新）
- `docs/reference/domain-digest.md`（新）
- `docs/_handoff/README.md` + `project/.gitkeep` + `screenshots/.gitkeep`（新）
- `docs/README.md` · `CLAUDE.md`（File Layout）· `.claude/skills/user-guide-builder/SKILL.md` · `.claude/skills/release-versioning/SKILL.md`

## Acceptance Criteria
- [ ] `product-overview.md` 一頁讀完（≤ 一螢幕捲動的密度），含 non-goals 區塊且每條附「若要做從哪開始」
- [ ] 一頁紙**不複製**任何 E341 已納入契約的常數（改為指向程式碼源，避免雙重真相）
- [ ] `domain-digest.md` 以模板現有三個領域示範完整格式，並含 fork 者填寫指引
- [ ] `docs/_handoff/` 結構建立且 README 說明兩支 skill 的讀取預期
- [ ] `docs/README.md` 與 `CLAUDE.md` File Layout 已收錄；`user-guide-builder` / `release-versioning` 已接線
- [ ] 全文無 fork 專屬名詞（瑞成 / RC / 案件 / 業主）— grep 佐證
- [ ] 文件內所有相對連結可解析（連結檢查腳本或人工逐一點過）

## Cross-Epic
- E341 — 常數的唯一真相在契約測試，本 epic 只指路不複製
- E336 — 畫面清單指向 `lib/nav.ts`
- E343 — `docs/_handoff/` 是設計回流的落點

## Out of Scope
- 自動產生一頁紙（維持人寫；`/athena:audit` 的 brand-staleness 檢查已能抓到過期識別資訊）
- 把 EPIC_INDEX 歷史濃縮進一頁紙（歷史是 append-only 的，不改寫）
