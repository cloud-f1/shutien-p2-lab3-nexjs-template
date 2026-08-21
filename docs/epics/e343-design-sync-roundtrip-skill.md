# E343 — `design-sync-roundtrip` skill（去品牌化）：Claude Design ↔ repo 往返協定

> Phase 82 · feature/skill · Cycle 36（fork harvest wave 3 — ai-rc-engineer-pm，2026-08-22）
> Status: ⬜ pending
> Depends: none

## Problem

模板已經有設計相關的三支 skill（`design-system`、`mockup-to-epics`、`sales-page-builder`）
和 `@designer` agent，但它們都假設「設計稿已經在你手上」。**設計稿怎麼來、改完怎麼回到 repo**
這段往返沒有任何文件——每個 fork 者都要自己踩一次。

fork 的 `design-sync-roundtrip` skill 把這段寫清楚了，包括那些**只有踩過才知道的陷阱**：
保留路徑會讓整批寫入被拒、`list_projects` 看不到非 design-system 類型的專案、
`get_file` 有 256 KiB 上限、**專案 type 建立後不可變**（挑錯就得重建）。
它唯一的問題是通篇綁死 瑞成 的兩個專案 UUID 與元件名。

## Solution

移植成模板版本 `.claude/skills/design-sync-roundtrip/SKILL.md`，把「哪個專案」換成「怎麼設定」：

1. **兩種專案、兩種用途**（這是最容易搞混、且不可逆的決定）：
   | 類型 | 用途 | 誰寫 |
   |---|---|---|
   | `PROJECT_TYPE_DESIGN_SYSTEM` | **元件庫** — 由 repo 的 `next-app/components/**` 編譯而來 | 只由 `/design-sync` 寫入，**禁止手改** |
   | `PROJECT_TYPE_PROJECT` | **設計畫布** — 畫面原型在這裡做 | 設計/agent 在此工作 |
   明確警告：**type 建立後不可變**；把畫布建成 design-system（或反過來）只能重開一個。
2. **四條資料流**（保留 fork 的圖示，換成模板路徑）：
   ```
   ① repo components ──/design-sync──▶ Design System 專案      （元件庫更新）
   ② docs/_handoff/ ──write_files──▶ 設計畫布專案               （脈絡：PRD/領域摘要/epic 摘要）
   ③ 畫布產出 ──get_file──▶ docs/_handoff/project/              （設計回流進版控）
   ④ docs/_handoff/ ──/athena:plan mockup──▶ docs/epics/        （交付 → UI-ready epics）
   ```
3. **設定而非硬編**：`.design-sync/config.json` 的欄位說明（`projectId`、`shape`、`pkg`、
   `globalName`、`componentSrcMap`、`overrides`）+ 首次設定步驟（怎麼建專案、怎麼取得 id、
   怎麼把 design system 掛到畫布上）。**UUID 一律以 placeholder 呈現**，並說明它應該存在
   `.design-sync/config.json`（進版控）而不是散落在 skill 文件裡。
4. **陷阱清單**（skill 的真正價值，逐條保留並標註是否已驗證於模板）：
   保留路徑會讓整批 `write_files` 被拒 · `list_projects` 只列 design-system 類型 ·
   `get_file` 256 KiB 上限 · 增量同步靠 `_ds_sync.json` 錨點（未變更元件會跳過驗證）·
   同步中途發現的修正要寫回 `.design-sync/config.json` 或 `NOTES.md` 並提交（否則下次還要再講一次）·
   建置產物（`.ds-types/`、`.ds-entry.ts`）需列入 `.gitignore`。
5. **接線**：`CLAUDE.md` 的 skill 清單加一行；`mockup-to-epics` 補一句「若設計來自 Claude Design，
   先讀 design-sync-roundtrip 取得回流協定」；`docs/_handoff/README.md`（E342）互相指路。

## Key Files
- `.claude/skills/design-sync-roundtrip/SKILL.md`（新）
- `next-app/.gitignore` 或 repo `.gitignore`（design-sync 建置產物）
- `CLAUDE.md`（skill 清單）· `.claude/skills/mockup-to-epics/SKILL.md`（指路）

## Acceptance Criteria
- [ ] Skill 存在且 frontmatter 的 `description` 含明確觸發語（同步設計、拉回設計稿、「我們用哪個 design 專案」）
- [ ] 兩種專案類型的差異與**不可變**警告明確載明
- [ ] 四條資料流圖保留，路徑對齊模板（`docs/_handoff/`、`docs/epics/`）
- [ ] **零硬編 UUID / 零 fork 專屬名詞**（grep 佐證）；設定值指向 `.design-sync/config.json`
- [ ] 陷阱清單至少 6 條，逐條標註「已驗證 / 承襲自 fork 未在模板驗證」——**不得把未驗證的說成已驗證**
- [ ] 建置產物已列入 `.gitignore`
- [ ] `CLAUDE.md` 與 `mockup-to-epics` 已接線；skill 為目錄含 `SKILL.md`（散落 `.md` 不會載入）

## Cross-Epic
- E342 — `docs/_handoff/` 是流 ②③ 的落點
- `mockup-to-epics` / `design-system` / `@designer` — 本 skill 只補「往返」這段，不重造其 ingest 與 token 慣例

## Out of Scope
- 實際去建立 Claude Design 專案或執行一次同步（本 epic 只交付協定文件；真的要同步時再由使用者授權執行）
- 自動化雙向同步腳本
