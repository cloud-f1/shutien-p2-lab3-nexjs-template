# 自動駕駛模式 (Autopilot, E164)

> 先決定 AI 能做什麼，剩下的再由人類補齊。
> — Drafted pattern, 2026-04-24

## 為什麼需要這個

Pipeline 上每一個閘門（`/athena:plan`、`/athena:promote`、`/athena:deploy`、
PR 審核）單獨看都有價值，但**累積起來就會造成停滯**：即使所有信號都明確
是綠燈，系統也無法在沒有人類介入的情況下推進。

Autopilot 顛倒這個預設：與其「每個閘門都問人」，改問「這一步的信心是否高
到人類審核根本不會改變結論？」當答案是 yes，就直接前進，不再詢問；當答案
是 no，就暫停並寫下解釋。

## 運作流程

```
/athena:autopilot E{n}
        │
        ▼
依序對 spec → implement → qa → commit → merge → deploy 每一步：
        │
        ▼
  scripts/confidence/<step>.sh  →  浮點數於 [0.00, 1.00]
        │
        ▼
  score >= AUTOPILOT_THRESHOLD (預設 0.85)？
        │
   yes  │  no
   │    └──▶ 暫停並寫入 docs/context/autopilot-pause-<epic>-<step>.md
   ▼
  發出 autopilot_advance 事件並執行該步驟
```

## 信心信號

每一步都有確定性、可解釋的計分器（目前不使用 ML）。

| 步驟 | 輸入 | 硬性失敗條件 |
|------|------|--------------|
| `spec` | 規格檔的模糊詞（TBD/TODO/???）；E156 `qa_contract` 事件是否存在 | 規格檔不存在 |
| `implement` | 測試綠燈、覆蓋率 delta ≥ 0、沒有新增 Stop verifier 違規 | （無，純加分制） |
| `qa` | E162 `review_loop` 事件：rounds、high_findings、test_quality_score | `high_findings > 0` → 0.0 |
| `commit` | Conventional Commits 格式、diff 中無秘密 | 偵測到秘密 → 0.0 |
| `merge` | n/a | `AUTOPILOT_ALLOW_MERGE != 1` → 暫停（政策閘） |
| `deploy` | n/a | prod 環境且未設 `AUTOPILOT_ALLOW_PROD_DEPLOY=1` → 暫停 |

特別說明 QA 公式：

```
if high_findings > 0:        score = 0.0
round_factor = 1.0 if rounds <= 2 else 0.7 if rounds == 3 else 0.4
score = round_factor * test_quality_score
```

任一個 HIGH 等級 finding 直接 hard fail；2 round 內收斂保留完整 TQS；
收斂越慢分數衰減越多。

## 安全性：可逆性預算

Autopilot 安全的前提是**每一步都可以便宜地回滾**。

| 步驟 | 如何回滾 | 出錯成本 |
|------|----------|----------|
| `spec` | `git checkout -- docs/epics/...` | 僅文件編輯 |
| `implement` | 限定在 feat branch，從不動 main | 可刪除的 feat branch |
| `qa` | 唯讀 | 零 |
| `commit` | feat branch 上 `git reset --soft HEAD~1` | 本地 commit |
| `merge` | **預設不會自動推進** | 需要在 main 上 `git revert` |
| `deploy` (staging) | 重新部署上一個 tag | 數分鐘 |
| `deploy` (prod) | **預設不會自動推進** | E159 rollback CLI 10 分鐘內可回滾 |

兩個政策閘（`merge` 與 prod `deploy`）**預設關閉**，需要明確設定環境變數
才會啟用：

- `AUTOPILOT_ALLOW_MERGE=1`
- `AUTOPILOT_ALLOW_PROD_DEPLOY=1`

換句話說，**預設情況下** autopilot 最多只能把你帶到一個綠色、已 commit
的 feat branch，並留下一個 paused-merge 的 artifact 等待人類 PR 審核。
任何東西進入 main 都還是要人類點頭。

## 調整閾值

`AUTOPILOT_THRESHOLD` 預設為 `0.85`。這是**校準參數**，不是固定答案。

- **較低（0.70）** → 暫停變少、自動前進變多，但風險變高
- **較高（0.95）** → 暫停變多，問題影響範圍變小，但等於把 autopilot 想消除
  的「人類介入成本」又加回來

請在 `docs/context/autopilot-log.md` 與 `.claude/audit.jsonl` 追蹤每個 epic
的 advance / pause 次數。Spec 的驗收標準是「在 10 個 epic 上記錄不同閾值
產生的人類介入率」——先從 0.85 開始，收集數據後再調整。

## 何時用 autopilot？何時用 `/athena:loop`？

| 使用情境 | 指令 |
|----------|------|
| 單一 epic，想要無人值守推進 | `/athena:autopilot E{n}` |
| 單一 epic，想一步一步並由人類控制節奏 | `/athena:loop` |
| 同一 phase 多個 epic 並行 | `/athena:batch --phase N` |
| 多個 epic、完全無人值守 | `/athena:batch auto`（搭配 cron） |

Autopilot 是**單一 epic** 的工具。多 epic 並行的 autopilot wave 明確被列為
E164 的 out-of-scope，那是未來的 `/athena:autopilot:batch` 之類的工作。

## 相關 epic

- E156 contract tests → spec 信心輸入
- E157 migration 簽核 → 相鄰閘門（Stop verifier rule #19）
- E159 SLI middleware + rollback → deploy 可逆性
- E162 reviewer convergence loop → QA 信心輸入（**硬相依**）

## 相關檔案

- `.claude/commands/athena/autopilot.md` — 指令規格
- `scripts/autopilot.sh` — harness
- `scripts/confidence/{spec,implement,qa,commit}.sh` — 計分器
- `docs/context/autopilot-log.md` — 決策日誌
- `.claude/audit.jsonl` — `autopilot_advance` / `autopilot_pause` 事件
