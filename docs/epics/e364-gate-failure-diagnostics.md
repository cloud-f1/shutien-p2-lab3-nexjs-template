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
