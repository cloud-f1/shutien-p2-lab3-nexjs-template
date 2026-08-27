# E362 — `/athena:batch` Step 4 補回逐-epic PRE-PUBLISH GATE

> Phase 88 · Size M · 8 SP · **P1**
> Status: 🟢 **APPROVED — approved by the user on 2026-08-27**
> 來源：Cycle 42 稽核。使用者原本的候選是「`pre-merge-check.sh` 不發事件」，查證後**該前提是錯的** —— 真正的洞在呼叫端。

## Problem

`loop.md` 的 canonical Publish block 第 1 步把 `scripts/pre-merge-check.sh` 明文列為
**MANDATORY**，且寫明「ABORT the publish if it exits non-zero」。但 `.claude/commands/athena/batch.md`
第 150–166 行的「Step 4 — publish/verify sequence」範例碼，**直接從 `git push` 開始** ——
註解說「follow the Publish step in loop.md (CANONICAL)」，範例碼卻跳過了那個 block 的第一步。

### 這不是理論問題，Phase 83–87 每一輪都中

`.claude/audit.jsonl` 的證據：每個 phase 收尾時，`gate_result` 事件永遠只有**一組**
（typecheck/lint/unit/int/e2e 各一），時間戳完全相同，`epic` 欄位永遠是 `null`。

決定性證據是那個 `int` gate：`pre-merge-check.sh` **根本沒有 `int` gate**
（它只有 typecheck/lint/unit/e2e/command-lint）—— `int` 只有 `/athena:integrate` 的整合閘門會發。
所以那一組事件的來源是整合閘門，不是任何一次 per-epic 的 pre-merge-check。

Phase 87 實測：五個 epic 的 publish，`pre-merge-check.sh` 總共執行 **1 次**（13:02:48Z 的整合閘門）。

### 被跳過的是什麼

整合閘門跑 typecheck/lint/unit/int/e2e，對**組合缺陷**其實比 per-epic 更強。真正的損失是
`pre-merge-check.sh` **獨有**、整合閘門沒有的四項：

| 檢查 | 來源 | 跳過的後果 |
|---|---|---|
| repo hygiene（巢狀 `.git`、大量未提交刪除） | 原始設計 | 半遷移樹狀態直接進 main |
| Gate 2.5 狀態漂移 | E353 | `EPIC_INDEX.md` 與 SSOT 不一致沒被擋 |
| **Gate 2.6 狀態自洽** | **E361** | **本 phase 才交付的守衛，從未在任何 per-epic publish 執行過** |

最後一列是這個 epic 存在的理由：**我們持續交付守衛，然後在預設執行路徑上不呼叫它們。**

### 次要問題：帳本無法區分兩種來源

`gate-ledger.sh` 把整合閘門的 5 筆和 per-epic 的 N×5 筆混在一起呈現。本次稽核就有人
（orchestrator 自己）看著那一組事件誤判成「五個 epic 各自跑過但沒被記錄」，並把這個錯誤
寫進了已合併的 PR #158 commit message。帳本要能防止這種誤讀。

## Solution

1. **`batch.md` Step 4 範例碼補回 canonical 第 1 步** —— 在 `git push` 之前插入
   `pre-merge-check.sh` 呼叫與非零即中止的分支，並把 `PMC_EPIC`/`PMC_PHASE` 環境變數帶進去
   （`pre-merge-check.sh` 第 52–54 行已支援，只是沒人傳）。
2. **`gate-ledger.sh` 區分來源** —— 依 `epic` 欄位是否為 null 分成「wave 整合閘門」與
   「per-epic pre-merge-check」兩區塊呈現，並在 per-epic 區塊為 0 筆時**明確標示**
   「本 phase 沒有任何 per-epic 閘門紀錄」，而不是靜靜地只顯示整合閘門那一組。
3. **對稱檢查 `flow.md` / `ship.md` / `pr.md`** —— 它們同樣宣稱 follow canonical block，
   要確認範例碼沒有同一個省略。

## Key Files

- `.claude/commands/athena/batch.md`（第 150–166 行）
- `.claude/commands/athena/loop.md`（canonical block，作為對照基準，**不改**）
- `.claude/commands/athena/{flow,ship,pr}.md`（對稱檢查）
- `scripts/gate-ledger.sh`
- `scripts/pre-merge-check.sh`（第 52–54 行 `emit_gate`，**不改**，只是傳入 epic/phase）

## Acceptance Criteria

1. `batch.md` Step 4 的範例碼包含 `pre-merge-check.sh` 呼叫，且非零時中止 publish；
   `PMC_EPIC` 與 `PMC_PHASE` 有被設定。
2. `flow.md`/`ship.md`/`pr.md` 三者經檢查，若有同樣省略一併補上；若無，在 epic 收尾說明「已檢查、無此問題」。
3. `gate-ledger.sh` 輸出把 per-epic 與 wave-整合兩種來源分開呈現。
4. **per-epic 區塊為 0 筆時要明確警告**，不可靜默。以 Phase 87 的實際 audit 資料重跑驗證：
   輸出必須明白指出 Phase 87 沒有任何 per-epic 閘門紀錄。
5. 故障注入：刻意讓某個 gate 失敗，確認 `batch.md` 的新流程真的會中止而非繼續 push
   （紅綠兩態都要驗，避免恆真斷言）。

## Out of Scope

- 不改 `pre-merge-check.sh` 的 gate 內容（E364 處理它的輸出）。
- 不追溯補發 Phase 83–87 的歷史 gate 事件 —— 那些閘門確實沒跑，補發等於偽造紀錄。
