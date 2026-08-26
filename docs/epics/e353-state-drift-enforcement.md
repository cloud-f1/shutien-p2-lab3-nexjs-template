# E353 — 狀態漂移防護：把既有的 check-drift 接上閘門

> Phase 86 · Size S · 來源：本 session 的實際事故（PR #136 帶著漂移合併）
> Status: 🟢 **APPROVED — approved by the user on 2026-08-27**

## Problem

**架構已經是對的，缺的是執行。** E196 早已建立正確的單一真相來源鏈：

```
docs/context/epic-progress.md   ← SSOT（scripts/epic-graph.sh 唯一讀取的檔案）
        │  scripts/state/render-index.sh（衍生，保留 prose 的 merge）
        ▼
docs/epics/EPIC_INDEX.md        ← 衍生檔（人類閱讀用，含歷史敘述）
```

`scripts/state/check-drift.sh` 也已存在且行為正確。**但它沒有接到任何地方** ——
`pre-merge-check.sh`、`stop-verifier.sh`、`Makefile` 全都不呼叫它，所以實務上永遠沒人跑。

實際後果（2026-08-24，本 session）：收 Phase 85 時直接編輯了**衍生檔** `EPIC_INDEX.md`
而沒動 SSOT，PR #136 就這樣合併。漂移只是因為我在核對一則記憶檔時偶然發現才補上（PR #137）。

**已實證 check-drift 當時擋得住**（以 PR #136 當下的 epic-progress.md 重跑）：

```
check-drift.sh: 13 mismatch(es) found
Detail: Phase 85 🟢 AP→✅; E350 Impl:⬜→✅; E350 QA:⬜→✅; … E352 Merge:⬜→✅
Run: scripts/state/render-index.sh to reconcile.
exit code = 1
```

所以本 epic **不新建任何狀態系統** —— 那會是重造已存在的東西。只補上執行力。

## Solution

1. `scripts/pre-merge-check.sh` 加一段 `▶ State drift` —— 呼叫 `check-drift.sh`，
   非零即擋，訊息直接指出 `render-index.sh` 的修復方式。
2. `make verify` 因為已含 `pre-merge-check.sh`，自動涵蓋，無需另外改。
3. 文件化正確順序：**先改 `epic-progress.md`（SSOT）→ 跑 `render-index.sh` → 兩者一起 commit**，
   絕不直接編輯 `EPIC_INDEX.md` 的 sentinel 區塊。寫進 `docs/epics/CLAUDE.md`。

## Key Files

- `scripts/pre-merge-check.sh` — 新增 drift 檢查段落
- `docs/epics/CLAUDE.md` — 寫入 SSOT-first 順序
- `scripts/checks/` 或 hooks tests — 新增紅綠回歸測試

## Acceptance Criteria

1. 人為製造漂移（只改 `EPIC_INDEX.md` 的 matrix 格）→ `pre-merge-check.sh` **失敗**並指出修法。
2. 跑 `render-index.sh` 後 → `pre-merge-check.sh` **通過**。
3. 目前 `main` 的狀態下 `pre-merge-check.sh` 通過（不引入既有紅燈）。
4. 文件明確寫出「先 SSOT 再 render」的順序與「不要手改衍生檔」。

## Out of Scope

- **不**新建 JSON/YAML 狀態格式或重寫 epic-graph.sh —— SSOT 鏈已存在且可用。
- **不**改 render-index.sh 的 merge 語意（保留 prose 的行為是刻意設計）。
