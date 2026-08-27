# E363 — Tier 0 記憶層：陳舊警報 + 登錄表分歧

> Phase 88 · Size M · 8 SP · **P1**
> Status: 🟢 **APPROVED — approved by the user on 2026-08-27**
> **範圍已於核准時調整** —— 原提案的第一部分（套用擱置的 promotion）在提案寫成後、核准前已由
> orchestrator 執行完畢，故移除；改納入兩個提案當時未發現的問題。

## Problem

### 已解決的部分（記錄在此以免重做）

提案原本要求「套用擱置 6 週的 `docs/context/promotion-proposals/20260713-005943.md`（22 條）」。
**2026-08-27 已完成**：`/athena:promote` 從零建立 `~/.claude/template-memory/`，促銷 30 條教訓到
9 個檔案。抽驗該 proposal 的 5 條特徵教訓（worktree 雙層探測、`gh pr merge --auto` 假錯誤、
schemathesis、Jaccard+cosine、雙語行數對等）全部命中。**本 epic 不需再做這件事。**

### 剩餘問題 1 — 沒有陳舊警報，所以擱置 6 週沒人發現

`scripts/hooks/auto-promote-check.sh` 會在累積 ≥3 條新 `[GENERALIZABLE]` 時產生 proposal 檔，
但**沒有任何機制在 proposal 長期未被套用時發聲**。那份 2026-07-13 的 proposal 靜靜躺了
**6 週、跨 11 個 phase**，期間 `tier0_loaded` 事件數維持在 0 —— 整條 E158/E180–E191 記憶
pipeline 完整存在、有測試，卻從未真正跑完一次。

`learn.md` 第 140/167/188 行用 `|| true` 包住 `score.sh`、`promotion-follow-through.sh`、
`consolidation-detect.sh`。**這是刻意的設計**（檔案自述 "best-effort... skip silently"），
不是隱藏 bug —— 但在 Tier 0 目錄根本不存在時，這三支腳本分別回 exit 1／2／2，全部被吞掉，
於是「記憶層不存在」這件事沒有任何一條路徑會報出來。

### 剩餘問題 2 — 兩份登錄表不一致（提案時未發現）

| 登錄表 | 條目數 | 誰讀它 |
|---|---|---|
| `scripts/memory/lesson-tags.json` | **12** | `match.sh`（檢索相關性計分） |
| `scripts/memory/half-life-defaults.json` | **8** | `backfill-half-life.sh` · `score.sh`（decay + flag-weak 兩個迴圈）· `forget.sh` |

這三支腳本用 `jq -r '.defaults | keys[]'` **迭代登錄表**，而不是掃描目錄
（`backfill-half-life.sh:66`、`score.sh:395,410`）。後果：只登錄在 `lesson-tags.json`、
沒登錄在 `half-life-defaults.json` 的檔案 **永遠不會衰減、永遠不會被標為 weak、
永遠不會被 `/athena:forget` 封存** —— 靜默地不在 E181 衰減／E184 遺忘的生命週期裡。

現在磁碟上就有兩個中招：`dx-patterns.md`（6 條）與 `workflow-patterns.md`（3 條）。
差集共 5 個檔名：`architecture-patterns` · `design-handoff-pattern` · `dx-patterns`
· `mockup-contract` · `workflow-patterns`。

注意 `backfill-half-life.sh` 的檔頭是**誠實的**（明寫 "Walks the 8 documented Tier 0 files
per half-life-defaults.json"），所以這不是文件與程式不符，而是**設計上讓登錄表成為唯一真相，
卻沒有任何機制檢查登錄表與磁碟是否一致**。與 E362 同一類：迴圈跑登錄表而非實際狀態，未登錄 = 不存在。

### 剩餘問題 3 — `domains:` 是遷移前的路徑

Tier 0 檔案的 `domains:` 欄位沿用 `lesson-tags.json` 的既有值，裡面仍是 `server/tests/`、
`client/src/api/` 這類 **FastAPI/Vite 時代**的路徑，不是現在的 `next-app/`。
`match.sh` 用 `domains` 與變更檔案路徑做交集計分，路徑對不上 → 檢索相關性系統性偏低。

### 剩餘問題 4 — CLAUDE.md 的數量宣稱

CLAUDE.md 寫「Tier 0 (global): ~/.claude/template-memory/ cross-project wisdom (15 files)」，
實際現在是 9 個。稽核另發現 Tier 1 宣稱「16 files」而 `docs/context/*.md` 實為 25。
硬編數字必然漂移。

## Solution

1. **`scripts/memory/check-promotion-staleness.sh`（新）** —— 掃 `docs/context/promotion-proposals/`，
   任何 proposal 檔的 mtime 超過 N 天（預設 14）→ **非零退出並大聲輸出**。

   **⚠ 更正（implement 階段實測發現）**：本 spec 原本寫的判定條件是「mtime 超過 N 天
   **且 watermark 未越過它**」—— **後半段永遠不可能成立**。`scripts/hooks/auto-promote-check.sh:148`
   在**產生 proposal 的當下就把 watermark 輪轉成 `date +%s`**（註解自述：「Advance the watermark
   so the NEXT run only scans history since this proposal」），所以 `watermark >= file_mtime`
   從檔案誕生那一刻起就恆為真，該條件會讓守衛**永遠不觸發** —— 正好是這個 epic 要消滅的那種靜默失效。

   實際採用的等價條件：**watermark 本身超過 N 天沒有前進，而 proposal 檔仍然存在**。
   以真實 fixture（`20260713-005943.md` + 凍結在其建立時間的 watermark）重放該事故，得到正確的 RED，
   watermark 前進後轉 GREEN。
   接進 `make verify`，**不要**用 `|| true` 包起來。
2. **登錄表一致性檢查** —— 比對 `lesson-tags.json` ∪ `half-life-defaults.json` ∪ 磁碟實際檔案，
   三者差集非空即報告。可併入上述腳本或獨立一支。同時把 5 個缺漏檔名補進 `half-life-defaults.json`。
3. **更新 `domains:`** —— 把 Tier 0 檔案與 `lesson-tags.json` 的 domains 改成 `next-app/`-relative 路徑。
4. **CLAUDE.md 的數量改為不寫死** —— 拿掉硬編數字，或改成由腳本產生。

## Key Files

- `scripts/memory/check-promotion-staleness.sh`（新）
- `scripts/memory/half-life-defaults.json` · `lesson-tags.json`
- `scripts/memory/{backfill-half-life,score,forget}.sh`（迭代來源）
- `.claude/commands/athena/learn.md`（第 140/167/188 行的 `|| true`）
- `CLAUDE.md`（Memory System 段）· `Makefile`（`verify` target）

## Acceptance Criteria

1. 新腳本能偵測到擱置的 proposal 並**非零退出**；以那份 2026-07-13 的檔案做 fixture 驗證。
2. 登錄表差集檢查能抓出目前 `dx-patterns.md`／`workflow-patterns.md` 不在
   `half-life-defaults.json` 的狀況；補齊後重跑應為空。
3. 補齊後 `backfill-half-life.sh` 對 9 個磁碟檔案全部 `[keep]`，且 `score.sh flag-weak`
   與 `decay-all` 涵蓋全部 9 個（不再靜默跳過兩個）。
4. `domains:` 不再出現 `server/`、`client/` 路徑；`match.sh` 對一個 `next-app/` 變更能算出非零分數。
5. CLAUDE.md 不再有寫死的 Tier 0／Tier 1 檔案數。
6. **故障注入**：把新腳本接進 `make verify` 後，刻意放一個舊 proposal，確認 `make verify` 真的紅；
   移除後轉綠。

## Out of Scope

- 不再執行 promotion 本身（已完成）。
- 不改 `learn.md` 既有的 `|| true` 語意 —— 那是刻意的 best-effort 設計；新守衛走 `make verify` 這條會擋人的路徑。
