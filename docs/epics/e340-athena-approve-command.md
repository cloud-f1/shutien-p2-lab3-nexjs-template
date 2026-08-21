# E340 — `/athena:approve`：四面核准轉換機械化

> Phase 82 · feature/athena-asset · Cycle 36（fork harvest wave 3 — ai-rc-engineer-pm，2026-08-22）
> Status: ⬜ pending
> Depends: none

## Problem

把一個 phase 從 🟡 PROPOSED 翻成 🟢 APPROVED 是**人工跨四個檔案面**的動作，漏掉任一個都會產生
**靜默失敗**（不是報錯，是「什麼都沒發生」，下一輪 session 還以為在跑）：

| # | 狀態面 | 漏掉的後果 |
|---|---|---|
| 1 | `docs/context/epic-progress.md` → **Phase Status** 列 | `epic-graph.sh` exit 3 `phase_blocked` / `batch auto` 永遠跳過該 phase |
| 2 | `docs/context/epic-progress.md` → **Dependency Rules** 區塊（+ Epic Step Matrix 列） | `epic-graph.sh --phase N` 沒有節點 → exit 2 `unknown_phase` 或空 wave |
| 3 | `docs/epics/EPIC_INDEX.md` phase 列 + epic 列 | 目錄與狀態互相矛盾，人類誤讀進度 |
| 4 | `docs/epics/e{n}-*.md` **spec 標頭** | 派工前的 spec-header gate 跳過該 epic；拿到檔案的 implement agent 中途拒跑 |

fork 在 2026-07-10 的手動核准中**四個面全部踩過一次**，之後才寫了這支命令。模板目前沒有——
記憶檔 `epic-phase-status-table-registration` 記的就是同一個坑的其中一面。

## Solution

移植 `.claude/commands/athena/approve.md` 並對齊本 repo 的實際檔案結構（fork 版的表格路徑一致，
但描述文字含 瑞成 專案脈絡，需去品牌化）：

1. **frontmatter**：`description: "(planning) Approve a gated phase → flip 🟡 PROPOSED / ⛔ CR-pending → 🟢 APPROVED across ALL four state surfaces. Usage: \`<phase-number> [--note \"…\"]\`"`，
   `allowed-tools: Read, Edit, Bash, Glob, Grep`。
2. **硬規則**（原樣保留，這是這支命令的價值核心）：
   - 核准是**人類行為**：只有當使用者在本次對話明確表示核准才可執行；
     **禁止**由 cron / `/loop` / `/athena:batch auto` / agent 自行發動。
   - **據實記錄**：寫使用者實際說的核准理由，不得自行升級成「合約已簽」之類未發生的事實。
   - **嚴格作用域**：核准 phase N 不涉及 N+1，不得順手改別的 phase。
3. **協定七步**：解析參數 → 讀現況（已是 🟢/✅ → 回報 nothing to do 並停止；找不到 → 停止並要求先 `/athena:plan`）
   → 依序改四個面（Phase Status 儲存格改寫時**保留既有 wave plan / descope 文字**——核准是解除閘門，不是清除範圍決策）
   → **驗證** → commit → 回報 wave plan。
4. **驗證步驟**（必須真的執行，不可宣稱）：
   ```bash
   bash scripts/epic-graph.sh --phase {N} --pending-only --json   # exit 0 且 waves 非空
   for f in docs/epics/e{n}-*.md; do head -5 "$f" | grep -E "勿實作|勿先實作|CR-pending|PROPOSED" && echo "STILL GATED: $f"; done   # 應無輸出
   ```
   任一項失敗 → 修好才能回報完成（沿用 verification-discipline / Stop Rule #23）。
5. **commit 訊息**：`chore(state): approve Phase {N} ({E-list}) — {date}`。
6. **接線**：
   - `CLAUDE.md` 的 Slash Commands「(planning)」區塊加一行
   - `.claude/commands/athena/plan.md` 在提案落地後指向 `/athena:approve`（取代「請人工翻四個表」的散文）
   - `docs/reference/` 的命令清單（若有）同步
   - 跑 `scripts/command-lint.sh`（若存在）確認 frontmatter 合規

## Key Files
- `.claude/commands/athena/approve.md`（新）
- `CLAUDE.md`（命令清單）· `.claude/commands/athena/plan.md`（指路）
- `docs/reference/*`（命令目錄同步，若存在）

## Acceptance Criteria
- [ ] `/athena:approve` 存在且 frontmatter 通過 command-lint（若無此腳本則人工比對其他命令格式）
- [ ] 文件明列四個狀態面與各自漏掉的後果（表格保留）
- [ ] 硬規則三條完整：人類專屬（明列禁止 cron/loop/batch 自動發動）· 據實記錄 · 嚴格作用域
- [ ] 協定含**可執行的驗證指令**，且要求失敗必須修復而非回報完成
- [ ] 去品牌化：全文無 瑞成 / RC / 案件 等 fork 專屬名詞（grep 佐證）
- [ ] `CLAUDE.md` 與 `plan.md` 已接線
- [ ] **乾跑驗證**：以本 phase（Phase 82）為對象走一次 step 6 的兩條檢查指令，兩者皆通過

## Cross-Epic
- 記憶 `epic-phase-status-table-registration` — 本 epic 是它的機械化解法
- verification-discipline skill — 驗證步驟沿用其「先跑再宣稱」協定

## Out of Scope
- 自動核准 / 信心門檻核准（核准永遠是人類行為，這條不可鬆動）
- 反向操作（🟢 → 🟡 撤銷核准）
