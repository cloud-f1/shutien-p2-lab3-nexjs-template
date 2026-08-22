# E345 — 關卡帳本：跳過可以，不留紀錄不行

> Phase 83 · feature/orchestration · Cycle 37（graph-engineering 缺口分析，2026-08-22）
> Status: ⬜ pending
> Depends: E344

## Problem

`.claude/commands/athena/batch.md:165` 的整合閘門協定**明文包含 `pnpm test:e2e`**：

```
cd next-app && pnpm typecheck && pnpm lint && pnpm test:coverage && pnpm test:e2e
```

Phase 82 實際執行時，**8 個 epic 沒有任何一個跑成 e2e** —— 每個 agent 都有正當理由
（共用的 `nextapp_postgres` 被別的專案佔用、schema 不符，跑下去會污染他人狀態），
而且都誠實聲明了「未跑 e2e 及原因」。

但那些聲明**只存在於 agent 的回報文字裡**。狀態檔、閘門結果、phase 完成紀錄一律寫著
PASS —— 因為整合閘門實際跑的是 typecheck/lint/unit。協定與實踐分岔了，而**沒有任何
結構化的東西記錄這件事**。

於是 Phase 82 以「整合閘門 PASS」收尾，而一個 e2e 才抓得到的組合缺陷正躺在 `main` 上。

**跳過關卡是合理的工程決定。沒有帳才是問題。**

## Solution

讓「跳過」成為一等公民：可以跳，但必須留下結構化紀錄，而且未結清的跳過會擋住 phase 完成。

### 1. 關卡結果三態化

每個關卡的結果從「跑/沒跑」變成 `pass` / `fail` / `skipped`，且 `skipped` **必須帶
`reason`**。沿用既有的 `.claude/audit.jsonl`（已是結構化，且已有 `audit-emit-*.sh`
家族）新增事件：

```json
{"ts":"…","event":"gate_result","gate":"e2e","status":"skipped",
 "reason":"shared postgres container owned by another project; schema mismatch",
 "epic":"E339","phase":"82","wave":"2"}
```

`scripts/hooks/audit-emit-gate.sh <gate> <status> [--reason "…"] [--epic E339]`
—— 比照 `audit-emit-pipeline.sh` / `audit-emit-coverage-drop.sh` 的既有寫法。

### 2. 呼叫端接線

- **E344 的整合節點**：每個關卡跑完就 emit（這是最主要的來源）
- `pre-merge-check.sh` / `make verify`：各關卡結果 emit
- `/athena:qa`：agent 回報「未跑 X 及原因」時，同步 emit `skipped` + reason
  —— 把散文聲明變成資料

### 3. 帳本視圖

`scripts/gate-ledger.sh [--phase N]` 由 audit log 產出摘要：

```
Phase 82 gate ledger
  typecheck   8 pass
  lint        8 pass
  unit        8 pass
  int         2 pass · 6 skipped
  e2e         0 pass · 8 skipped  ⚠ 未結清
    E336 shared postgres container owned by another project
    E337 no seeded DB / dev server in this environment
    …
```

寫入 `docs/context/gate-ledger.md`（render 產物，不手改）。

### 4. Phase 完成守衛 —— 帳本的牙齒

`docs/context/epic-progress.md` 的 phase 要標記 ✅ Complete 時，檢查該 phase 是否有
**未結清的 skipped 關卡**。有的話：

- 預設**擋下**，列出未結清項目
- 人可以明確承認：`--accept-skips "e2e: DB 隔離修好前不可行（#117 追蹤）"`，
  該承認一併記入帳本並顯示在 phase 列
- 承認是**人的動作**，比照 `/athena:approve` 的硬規則：禁止 cron / batch auto / agent
  自行承認

`/athena:approve` 已經證明這個形狀有效（四狀態面漏一個就靜默失敗）；本 epic 是同一個
道理用在關卡上。

### 5. 誠實原則寫進文件

`verification-discipline` skill 補一節：**宣稱跑過而沒跑，比誠實跳過嚴重得多**。
agent 誠實聲明「未跑 e2e 及原因」是**正確行為**，本 epic 不是要懲罰它 —— 是要讓那個
聲明有地方落地、被彙總、被人看見。

## Key Files
- `scripts/hooks/audit-emit-gate.sh`（新）+ `scripts/hooks/tests/test-audit-emit-gate.sh`（新）
- `scripts/gate-ledger.sh`（新）
- `.claude/commands/athena/integrate.md`（E344 產物，接上 emit）
- `.claude/commands/athena/batch.md` · `qa.md`（接線）
- `scripts/pre-merge-check.sh` · `Makefile`
- `docs/context/gate-ledger.md`（render 產物）
- `.claude/skills/verification-discipline/SKILL.md`

## Acceptance Criteria
- [ ] `audit-emit-gate.sh` 落地，`skipped` **強制要求 reason**（缺 reason 直接非零退出）；有對應 hook 測試並納入 `make hook-test`
- [ ] 整合節點（E344）每個關卡都 emit 結果
- [ ] `/athena:qa` 的「未跑 X」聲明會 emit `skipped` + reason，不再只存在於散文
- [ ] `gate-ledger.sh --phase N` 產出正確摘要；**以 Phase 82 的真實 audit log 為驗證案例**，應顯示 e2e 8 次 skipped 並列出各自理由
- [ ] Phase 標記 ✅ Complete 時，未結清的 skipped 會**擋下**並列出項目
- [ ] `--accept-skips` 可由人明確承認，承認內容記入帳本；文件明訂**禁止 cron / batch auto / agent 自行承認**
- [ ] 回歸驗證：以 Phase 82 的狀態重放，守衛必須擋下（因為 e2e 8 次未結清）—— 附實際輸出
- [ ] `verification-discipline` skill 已補上「誠實跳過 ≫ 謊稱跑過」那一節

## Cross-Epic
- E344 — 主要的 emit 來源，先落地
- E340 `/athena:approve` — 「人類承認」的硬規則寫法直接沿用
- E341 doc↔code 契約測試 — 同屬「把散文變成可執行檢查」的系列

## Out of Scope
- 強制所有關卡都必須跑（跳過是合理的工程決定，本 epic 只要求留帳）
- 改寫既有的 audit event schema（只新增 `gate_result`）
- 把帳本接上外部監控／webhook
