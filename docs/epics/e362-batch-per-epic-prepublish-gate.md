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
   **⚠ 更正（implement 階段實測發現）**：本 spec 原本斷言「`pre-merge-check.sh` 第 52–54 行已支援，
   只是沒人傳」—— **這是錯的，未經查證就寫下**。原始那行是
   `PMC_EPIC=$(git branch --show-current ...)` **無條件覆寫**，任何外部匯入的值都會被清掉。

   而 `batch.md` 的 orchestrator **按分支名推送、從不 checkout**（它在 `main` 上依序推每個
   `feat/E{n}-*`），所以 `git branch --show-current` 根本無法辨識當下發布的是哪個 epic ——
   光靠自動偵測會讓每一筆 per-epic 事件都掛空 epic，與 wave 整合閘門的事件無從區分，
   **正好抵銷本 epic 的目的**。故一併加入 `${PMC_EPIC:-}` fallback：外部有設就勝出，
   未設則沿用原本的分支名偵測（`ship.md`/`pr.md` 從已 checkout 的分支呼叫，不受影響）。
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

---

## QA 結果（2026-08-27）— PASS，含三項 ADVISORY

五條 AC 全數由 QA **自行重跑驗證**（未採信 implement 的自述）。RED/GREEN 都是實際執行
`pre-merge-check.sh` 全程：注入巢狀 `next-app/.git` → 真實 exit 1；移除 → 真實 exit 0，
且發出的 `gate_result` 事件確實帶著 `epic:"E362TEST" phase:"999"`，證明覆寫是端到端生效而非只在片段中成立。

### ADVISORY 1 — per-epic 閘門實際重驗的是哪棵樹（文件缺口，非缺陷）

`batch.md` Step 4 的 orchestrator **從不 checkout epic 分支**，所以 `pre-merge-check.sh` 的
typecheck/lint/unit 三個 gate 檢查的是 **orchestrator 當下那棵樹（通常是 main）**，不是該 epic 的 diff。

這不構成缺陷：Step 4a-integrate 已先驗過真正合併後的 wave，而本 epic「Problem」段本來就把這道閘門的
邊際價值定位在 repo-hygiene / 狀態漂移 / 狀態自洽（Gate 1/2/2.5/2.6）—— 那四項**確實**檢查活的工作樹。

但 `batch.md` 與 `pre-merge-check.sh` 都沒有把這件事寫明，未來讀者可能把
「pre-merge-check passed for E83」誤讀成「E83 的程式碼通過 typecheck」。值得補一行註解。

### ADVISORY 2 — worktree 有自己的 audit log（既有行為，非本 diff 引入）

`gate-ledger.sh` 會 `cd` 到 `git rev-parse --show-toplevel` 並讀**相對路徑**的 `.claude/audit.jsonl`。
每個 worktree 帶著自己那份小得多的 log（實測 **131 行 vs 主 repo 6850 行**），
所以**在 worktree 內跑 AC #4 的驗證指令會得到假的「無紀錄」**。必須用 `AUDIT_LOG_PATH` 指向主 repo。

這正是本專案反覆吃虧的「在錯的地方變綠」那一類。`AUDIT_LOG_PATH` 的處理本身未被本 diff 改動。

### ADVISORY 3 — 三個新行為都沒有自動化測試（真實缺口）

- `gate-ledger.sh` 的 wave/perEpic 拆分與區塊標題
- perEpic 為空時的 `⚠` 警告
- `pre-merge-check.sh` 的 `PMC_EPIC`/`PMC_PHASE` 覆寫優先序

`test-gate-ledger-accept-persistence.sh` 仍通過（它剛好用了 `--epic` 標籤，順帶走到 perEpic 路徑），
但**對拆分本身不做任何斷言**。明確列為缺口，而不是拿「make hook-test 全綠」當通過。

### QA 同意 implement 的一項判斷

閘門失敗時「跳過該 epic、不中止整個 wave」是對的：每個 epic 在抵達 Step 4 前都已通過自己的 QA
與 wave 的 Step 4a-integrate；此時才浮現的失敗屬於該 epic 分支自身（repo hygiene／狀態漂移），
與已證明能安全組合的其他 epic 正交。為單一 epic 的閘門失敗中止整批，降低吞吐卻換不到對等的安全性。

### 執行本 epic 的 QA 時踩到的坑（記錄以免重蹈）

QA 驗證 `gate-ledger.sh` 時**沒有設 `GATE_LEDGER_PATH`**，測試資料（含一個 `## Phase 999` fixture）
直接寫進了 repo 內真實的 `docs/context/gate-ledger.md`，把 Phase 83/84/85/87 的區塊與 Phase 86 的
人工接受 skip 紀錄全部沖掉。已用 `git checkout` 復原。

**腳本本身沒問題** —— `GATE_LEDGER_PATH`（第 113、131 行）就是為此而存在，是呼叫端沒用。
對應 Tier 0 教訓：對「唯讀」目標目錄做前後快照，抓出忘記的 `>`。
