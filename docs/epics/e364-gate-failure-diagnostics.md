# E364 — Gate 失敗時把診斷內容印出來，不要只指向 log 檔

> Phase 88 · Size S · 3 SP · **P2**
> Status: 🟢 **APPROVED — approved by the user on 2026-08-27**

## Problem

`scripts/pre-merge-check.sh` 的 typecheck / lint / unit / e2e 四個 gate 都是同一個形狀：

```bash
if (cd "$APP" && pnpm -s typecheck >/tmp/pmc-tsc.log 2>&1); then ok "..."; else bad "typecheck failed (see /tmp/pmc-tsc.log)"; fi
```

輸出全部導向 `/tmp/pmc-*.log`，終端機上只留一行「去看 log」。

這在 E357 之後變成實質損失：E357 刻意把 e2e 的目標身分驗證失敗做成一則**大聲、多行、可行動**的
中止訊息（`next-app/e2e/global-setup.ts` 第 98–148 行），裡面逐步寫明三個修法與
`DATABASE_URL` 的必要性。在**最多人跑的那道閘門**下，這則訊息被降級成一行「see /tmp/pmc-e2e.log」。

刻意設計的可行動訊息，在傳遞鏈的最後一段被吞掉。

## Solution

gate 失敗時，把該 gate 的 log **尾端 N 行**（或以 `ABORTED`／`FAILED`／`Error:` 關鍵字擷取的區塊）
直接印到終端機，log 檔路徑仍然保留供完整查閱。

實作要點：
- N 可設（環境變數，預設 30 行左右）。
- 對 e2e 特別處理：若 log 中含 E357 的 abort 標記，優先印出那個完整區塊而非單純 tail
  —— 那則訊息本來就是為了被人讀而寫的。
- 不要因為印得多而讓成功路徑變吵：**只在失敗時**印。

## Key Files

- `scripts/pre-merge-check.sh`（四個 `bad "..."` 分支）

  **⚠ 更正（implement 階段）**：本 spec 引用的行號 115／119／123／134 **已經過時**。
  該檔案在 E345（`emit_gate`）與 E362（`${PMC_EPIC:-}` fallback）之後行號位移，
  實際為 **138／142／146／157**。派工時已提醒 agent「行號可能已位移，先完整讀檔再動手」，
  它照做並回報確認 —— 若照行號硬找會改錯地方。

  **教訓**：spec 裡的行號在多個 epic 連續改同一檔案時必然腐化。引用**函式名或語法特徵**
  （如「四個 `bad "..."` 分支」）比行號耐久。
- `next-app/e2e/global-setup.ts`（第 98–148 行，abort 訊息的來源，**不改**）

## Acceptance Criteria

1. 四個 gate 各自失敗時，終端機輸出包含該 gate 的實際錯誤內容，不只是 log 路徑。
2. e2e 因 E357 身分驗證失敗時，那則多行 abort 訊息**完整出現在終端機**。
   以實際觸發（指向錯誤的 instance）驗證，不是靠讀碼推論。
3. 全部 gate 通過時，輸出與現況相同 —— 不新增雜訊。
4. 紅綠兩態都驗過。

## Out of Scope

- 不改動 gate 的判定邏輯或新增 gate（E362 處理呼叫端）。

---

## QA 結果（2026-08-28）— PASS，含一項 ADVISORY

四條 AC 全由 QA **自行重跑**。

### AC #2：QA 做了比 implement 更強的驗證

implement 的觸發路徑是「`:3000` 的伺服器沒有 `appInstanceId`」（一個無關的 pre-E357 外來 app），
它誠實揭露了這點。**QA 改用 spec 字面要求的觸發**：在 `:3601` 啟動**本 checkout 自己的** dev server
（真實 `appInstanceId=51842c7756e7c248`），再以 `E2E_EXPECTED_APP_INSTANCE_ID=deadbeefdeadbeef`
強制不符，得到貨真價實的 `actual !== expected` 中止：

> "The server on that URL is a DIFFERENT checkout of this app."

那則完整 banner 逐字印出 —— 兩條 box-drawing 分隔線、Base URL／Expected／Observed、四個編號修法，
一行不缺。也順帶證明分隔線掃描（`grep -n '^──\{10,\}$'` 取首尾）能正確跨越真實 banner 中的**三處**
分隔線（開頭、標題中、結尾）。

### 邊界情況（implement 未測，QA 補測）

| 情況 | 行為 |
|---|---|
| log 不存在 | 靜默、回 0、無輸出 ✓ |
| log 是空檔 | **仍印出 `── last N lines ──` 標頭然後沒有內容** —— 無害的化妝瑕疵 |
| 含 `e2e ABORTED` 但只有一條分隔線 | 正確 fallback 到 tail ✓ |
| `PMC_LOG_TAIL_LINES=0` | `tail -n 0`，標頭 + 空 |
| `PMC_LOG_TAIL_LINES=-3` | BSD／GNU tail 皆視為「最後 3 行」，非地雷 ✓ |
| `PMC_LOG_TAIL_LINES=abc` | `tail` 報錯到終端，但**腳本不崩、退出碼不受影響**（`set -uo pipefail` 無 `-e`，且呼叫端不檢查它的退出碼）✓ |

### E345／E362 回歸：已證明，非假設

`emit_gate` 仍在四個 gate 正確發出 `pass`／`fail`；E362 的分支名自動偵測（`feat/E364-…` → `E364`
→ 交叉查 `epic-progress.md` → phase `88`）未受干擾。新增的 `print_gate_failure` 呼叫**嚴格排在
`emit_gate` 之後**，且從不影響 `$FAIL` 或任何 gate 的退出碼。

### ⚠ ADVISORY — `print_gate_failure` 沒有自動化測試

這是一個小而高槓桿的函式（解析 log，決定**每一次閘門失敗時人／agent 看到什麼**），目前零自動化涵蓋。
上表那些邊界都是 QA 手動測的。建議比照 E363 的 `test-check-promotion-staleness.sh`
（`mktemp -d` + `trap EXIT`）補一支 `test-print-gate-failure.sh`。**非阻斷，但值得快速跟進。**

### 📌 orchestrator 追記：E363 的 ADVISORY 2 在此再度應驗

QA 回報它「在**真實** `.claude/audit.jsonl` 留下 3 筆 `pass` 事件」。**實測不然** ——
主 repo 的 log（7009 行）裡沒有那些事件，它們全進了 **worktree 自己的 log**（126 行，共 9 筆）。

這正是 E363 的 QA 標記的 ADVISORY 2：**worktree 帶著自己那份 `.claude/audit.jsonl`，
`pre-merge-check.sh` 讀的是相對路徑**。後果有二：

1. QA 對自己副作用的自述是錯的（本例中反而是好消息 —— 它沒污染正式資料）
2. **worktree 一移除，那些事件就消失** —— per-epic 閘門紀錄會靜默遺失

因此 publish 時必須明確 `AUDIT_LOG_PATH=<主 repo>/.claude/audit.jsonl`（E362／E363 的 publish
都這麼做，所以它們的事件留了下來）。

**同一個陷阱在兩個不同 epic、兩個不同 agent 身上各咬一次** —— 已足夠構成 Phase 89 的候選。
