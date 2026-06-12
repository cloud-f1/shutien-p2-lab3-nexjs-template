# E39 — 1M Context 適配：Session・Memory・Agent 升級

> **Priority**: P1
> **Estimate**: 13 points
> **Dependencies**: None
> **Phase**: 14 — Infrastructure Evolution
> **Source**: Adapted from ai-clock-work E84. Opus 4.6 defaults to 1M context (5x from 200K)

---

## Problem Statement

整個 AI 開發基礎設施（hooks、memory、agent prompts、CLAUDE.md）都是在 200K context window 限制下設計的。Opus 4.6 預設 1M context 後，多項節省空間的 workaround 反而成為效能瓶頸：

| # | Issue | Severity |
|---|-------|----------|
| 1 | SessionStart hook 只載入 ~15 行 Quick Reference，agent 每次都要花 2-3 個 tool call 重新讀取基本狀態 | HIGH — 每個 session 浪費 ~30 秒 |
| 2 | session-summary.md 曾有 `<!-- last activity -->` timestamp 堆積問題（E33 已部分解決），需確保不會復發 | MEDIUM — 已有 /athena:learn 清理機制 |
| 3 | MEMORY.md 200 行截斷限制，底部 entry 被靜默丟失 | MEDIUM — 記憶遺失風險 |
| 4 | Agent subagents 各自獨立讀取 context，重複 reads 且狀態不一致 | MEDIUM — 效率與一致性 |
| 5 | /athena:implement 保守載入相關檔案，大型 epic 仍需 multi-session | LOW — 1M 後可單 session 完成 |

---

## Stories

### S01 — SessionStart Hook 擴展載入 (3 pts)

**Goal**: 利用 1M context 空間，session 啟動時自動載入完整專案狀態

**AC**:
- [ ] `scripts/hooks/session-start.sh` 載入完整 session-summary.md（~60 行）
- [ ] 載入完整 `docs/context/epic-progress.md` pipeline 狀態
- [ ] 載入 TECHSTACK.md quick reference 區段
- [ ] 總載入量控制在 ~400 行以內（仍 < 0.05% of 1M context）
- [ ] 驗證：新 session 啟動後，不需額外 Read 即可回答「目前到哪個 epic？用什麼技術？」

### S02 — MEMORY.md 容量升級 (2 pts)

**Goal**: 提升 memory index 容量限制，減少記憶遺失風險

**AC**:
- [ ] MEMORY.md truncation 提示從 200 行提升到 500 行
- [ ] 更新 auto memory 系統指引中的 line limit 數字
- [ ] 審查現有 memory entries — 合併重複、移除過時
- [ ] 驗證：MEMORY.md 底部新增的 entry 不會被截斷

### S03 — Agent Context 預載策略 (3 pts)

**Goal**: 更新 agent prompts，利用 1M 空間預載更多相關 context

**AC**:
- [ ] `@qa` agent — prompt 更新：review 時一次載入 OpenAPI spec + all changed files + test files
- [ ] `@spec-writer` agent — prompt 更新：設計時載入相關現有 specs + qa-patterns.md
- [ ] `@strategist` agent — prompt 更新：分析時載入完整 epic-progress + strategy-log
- [ ] `/athena:implement` command — 更新為更積極地前置載入相關模組檔案
- [ ] `/athena:loop` command — subagent prompts 包含更多 context（epic details inline instead of "look it up"）

### S04 — CLAUDE.md & Context 文件更新 (2 pts)

**Goal**: 移除過時的 context 節省提示，更新為 1M 策略

**AC**:
- [ ] 更新 CLAUDE.md — 移除「< 100 lines」限制提示（1M 下不再必要）
- [ ] 更新 `docs/context/CLAUDE.md` — 記錄新的 context budget
- [ ] 更新 `scripts/hooks/CLAUDE.md` — 記錄新的 hook 行為
- [ ] Context control memory file — 更新限制數字

### S05 — 驗證與測量 (3 pts)

**Goal**: 驗證所有變更的端到端效果

**AC**:
- [ ] 執行一次完整 session lifecycle 測試：SessionStart → implement → qa → save
- [ ] 測量：session start context 載入量（行數）vs 舊版比較
- [ ] 測量：典型 epic 實作中的 context 壓縮觸發點（應比舊版延後 5x）
- [ ] smoke-test.sh 仍然通過

---

## Technical Design

### S01 — SessionStart Hook 改造

#### 現行行為（Before）

`scripts/hooks/session-start.sh`（16 行）：
- 印出 branch + uncommitted count（2 行）
- 用 `sed` 抽取 session-summary.md 的 `## Quick Reference` 區段（~10 行）
- 總輸出：~15 行

#### 新行為（After）

擴展為 4 個區塊，總輸出 ~200–400 行：

```bash
#!/bin/bash
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" || exit 0

BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

echo "=== AI-Coding-Template — Session Context ==="
echo "Branch: $BRANCH | Uncommitted: $UNCOMMITTED files"
echo ""

# Block 1: Full session-summary.md (~60 lines)
if [ -f "docs/context/session-summary.md" ]; then
  echo "--- Session Summary ---"
  cat docs/context/session-summary.md
  echo ""
fi

# Block 2: Epic pipeline state (~30 lines)
if [ -f "docs/context/epic-progress.md" ]; then
  echo "--- Epic Pipeline State ---"
  cat docs/context/epic-progress.md
  echo ""
fi

# Block 3: Recent git activity (~20 lines)
echo "--- Recent Git Activity ---"
git log --oneline -10 2>/dev/null || echo "(no commits)"
echo ""

# Block 4: Active branch diff summary (~10 lines)
if [ "$BRANCH" != "main" ] && [ "$BRANCH" != "unknown" ]; then
  echo "--- Branch Diff vs Main ---"
  git diff --stat main...HEAD 2>/dev/null | tail -15
  echo ""
fi

echo "Tip: /athena:load for full context | /athena:save to checkpoint"
```

**設計決策**：
- 使用 `cat` 全文輸出取代 `sed` 區段抽取 — 簡單、無 parse 風險
- 不載入 TECHSTACK.md 全文（太長，~200 行），session-summary 的 Quick Reference 已含技術棧摘要
- 新增 `git log --oneline -10` — 讓 agent 立即知道最近做了什麼，不用額外 tool call
- 新增 branch diff stat — 讓 agent 知道目前分支的變更範圍
- 所有區塊用 `--- 標題 ---` 分隔，方便視覺辨識
- Hook timeout 10s，4 個 `cat` + 1 個 `git log` + 1 個 `git diff --stat` 遠低於限制

#### 檔案變更

| 檔案 | 動作 | 說明 |
|------|------|------|
| `scripts/hooks/session-start.sh` | **修改** | 替換 sed 抽取為 4 區塊全文輸出 |

---

### S02 — MEMORY.md 容量升級

#### 現行限制

- `context-control.md` 記錄 `MEMORY.md: under 200 lines`
- 實際行數：145 行（尚有空間，但持續成長中）
- Claude Code 的 auto-memory 系統在超過上限時會靜默截斷底部內容

#### 變更計畫

1. **更新 context-control.md** — 將 `MEMORY.md: under 200 lines` 改為 `under 500 lines`
2. **審查 MEMORY.md 內容** — 現有 145 行，檢查是否有過時 entry：
   - `Auth page tests across multiple test files (count varies as epics add coverage)` — 已在 E20 後穩定，可更新具體數字
   - `session-summary.md` 中的 `<!-- last activity -->` 堆積（14 行 timestamps）— 應由 `/athena:learn` 清理
   - 確認所有 epic 引用反映最新狀態
3. **更新 CLAUDE.md** 第 2 行 — 移除 `Keep under 100 lines` 或改為 `Keep concise`
4. **不需要修改 Claude Code 系統設定** — line limit 是慣例指引，非系統強制

#### 檔案變更

| 檔案 | 動作 | 說明 |
|------|------|------|
| `~/.claude/projects/.../memory/context-control.md` | **修改** | 200→500 行限制 |
| `~/.claude/projects/.../memory/MEMORY.md` | **修改** | 清理過時 entries、合併重複 |

---

### S03 — Agent Context 預載策略

#### 設計原則

1M context 下，agent 啟動時花 2-3 個 Read tool call 載入基本狀態是不必要的浪費。策略：在 agent prompt 和 command definition 中明確列出「啟動時必讀」清單，讓 agent 在第一個動作就批次載入所有需要的檔案。

#### Agent 變更明細

**`@qa` agent（`.claude/agents/qa.md`）**

現行：`Always read both before starting.`（指 review-log + test-status）

新增指引段落：
```markdown
## Context Preloading (1M context)
With 1M context available, load ALL relevant files in your first tool call batch:
- `docs/context/review-log.md` + `docs/context/test-status.md` (designated docs)
- `docs/context/qa-patterns.md` (recurring patterns to check)
- `docs/openapi.yaml` (API contract — check for spec drift)
- All changed files: `git diff --name-only main...HEAD` → Read each
- Corresponding test files for each changed source file
Do NOT read files one-by-one across multiple rounds — batch in parallel.
```

**`@spec-writer` agent（`.claude/agents/spec-writer.md`）**

現行 Workflow step 1.5：`Read docs/context/qa-patterns.md`

新增 preloading 指引：
```markdown
## Context Preloading (1M context)
Batch-read on startup:
- `docs/context/spec-log.md` + `docs/context/qa-patterns.md` (designated + patterns)
- All existing specs in `docs/specs/` relevant to the new feature
- `docs/epics/EPIC_INDEX.md` (dependencies and context)
- Current OpenAPI spec `docs/openapi.yaml`
```

**`@strategist` agent（`.claude/agents/strategist.md`）**

現行 Required Context 列出 5 個檔案但未指示批次載入。

新增指引：
```markdown
## Context Preloading (1M context)
Read ALL 5 required context files in a single parallel batch — do not read sequentially.
Additionally read: `docs/context/qa-patterns.md` (recurring issues inform proposals).
```

**`/athena:implement` command（`.claude/commands/athena/implement.md`）**

現行：3 行，非常精簡。

擴展為：
```markdown
---
description: Implement a feature from its spec. Strict TDD red-green-refactor.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---
# Context Preloading
Before starting TDD, batch-read in parallel:
1. `docs/specs/$ARGUMENTS.md` — the feature spec
2. `docs/context/qa-patterns.md` — patterns to follow proactively
3. All source files listed in the spec's "Implementation Order" section
4. Corresponding test files (if they exist)

# TDD Cycle
RED: write failing tests → GREEN: minimum code → REFACTOR: clean
Then auto-invoke @qa (review + test)
```

**`/athena:loop` command（`.claude/commands/athena/loop.md`）**

現行 Subagent Prompt Template：
```
Read CLAUDE.md for project rules.
Read docs/epics/EPIC_INDEX.md for epic E{n} details.
```

更新為 inline epic details：
```
Epic: E{n} — {name}
Step: {step}
Size: {size}
Description: {inline the epic description from EPIC_INDEX.md}
Dependencies: {list or "none"}

Read CLAUDE.md for project rules.
Read the epic spec at docs/epics/e{n}-{slug}.md for full details.
```

這避免 subagent 需要先讀取 EPIC_INDEX.md（~280 行）再找到自己的 epic。

#### 檔案變更

| 檔案 | 動作 | 說明 |
|------|------|------|
| `.claude/agents/qa.md` | **修改** | 新增 Context Preloading 段落 |
| `.claude/agents/spec-writer.md` | **修改** | 新增 Context Preloading 段落 |
| `.claude/agents/strategist.md` | **修改** | 新增 Context Preloading 段落 |
| `.claude/commands/athena/implement.md` | **修改** | 擴展 preloading 指引 |
| `.claude/commands/athena/loop.md` | **修改** | Subagent prompt template inline epic details |

---

### S04 — 文件限制更新

#### 變更清單

**`CLAUDE.md`（root）**

| 行 | Before | After |
|---|---|---|
| 2 | `> **Auto-loaded every session.** Keep under 100 lines.` | `> **Auto-loaded every session.** Keep concise — essential rules only.` |

**`docs/context/CLAUDE.md`**

新增段落：
```markdown
## Context Budget (1M context era)

With Opus 4.6 defaulting to 1M context, the previous aggressive truncation
strategy is no longer necessary. SessionStart hook now loads ~200-400 lines
of project state automatically. Agents batch-read their required context
files in parallel on startup.

Budget guideline: session-start injection < 500 lines (< 0.05% of 1M).
```

**`scripts/hooks/CLAUDE.md`**

更新 SessionStart 行：

| Before | After |
|---|---|
| `Inject branch, summary, primer` | `Inject branch, full session-summary, epic-progress, recent git activity (~200-400 lines)` |

**`context-control.md`（memory file）**

| Before | After |
|---|---|
| `CLAUDE.md: under 100 lines` | `CLAUDE.md: keep concise (no hard line limit)` |
| `MEMORY.md: under 200 lines` | `MEMORY.md: under 500 lines` |

#### 檔案變更

| 檔案 | 動作 | 說明 |
|------|------|------|
| `CLAUDE.md` | **修改** | 移除 100 行硬限制 |
| `docs/context/CLAUDE.md` | **修改** | 新增 Context Budget 段落 |
| `scripts/hooks/CLAUDE.md` | **修改** | 更新 SessionStart 描述 |
| `~/.claude/projects/.../memory/context-control.md` | **修改** | 更新限制數字 |

---

### S05 — 驗證方案

#### 測試 1: Hook 輸出驗證

```bash
# 模擬 SessionStart hook 輸出，計算行數
cd /path/to/project
bash scripts/hooks/session-start.sh | wc -l
# 預期：150–400 行（取決於 session-summary + epic-progress 長度）
# 通過條件：> 50 行（舊版 ~15 行）且 < 500 行
```

#### 測試 2: Hook 執行時間

```bash
time bash scripts/hooks/session-start.sh > /dev/null
# 通過條件：< 3 秒（well within 10s timeout）
```

#### 測試 3: MEMORY.md 容量

```bash
wc -l ~/.claude/projects/.../memory/MEMORY.md
# 通過條件：< 500 行且底部內容完整（手動檢查最後 10 行）
```

#### 測試 4: Agent Prompt 語法

```bash
# 確認所有 agent files 仍有有效 YAML frontmatter
for f in .claude/agents/*.md; do
  head -1 "$f" | grep -q '^---$' || echo "FAIL: $f missing frontmatter"
done
```

#### 測試 5: 既有 smoke test

```bash
bash scripts/smoke-test.sh
# 通過條件：exit 0
```

#### 測試 6: Session Lifecycle（手動）

1. 開啟新 Claude Code session
2. 確認 SessionStart 輸出包含 session-summary 全文 + epic-progress
3. 詢問「目前到哪個 epic？」— 不需要額外 Read 即可回答
4. 執行 `/athena:save` — 確認 session-summary.md 更新正常
5. 確認 session-summary.md 無新增 timestamp 堆積

---

## Differences from ai-clock-work E84

| ai-clock-work E84 | This Project (E39) |
|---|---|
| S01 Activity Timestamp 分離 | 已在 E33 解決（/athena:learn Step 3.7 清理 timestamps） |
| S04 TECHSTACK.md 合併 6 子檔案 | 不適用 — 本專案無 TECHSTACK 子檔案拆分 |
| 15 pts, 6 stories | 13 pts, 5 stories（去除已解決 + 不適用項目） |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SessionStart 載入太多導致 hook timeout | Low | Medium | 控制在 400 行，hook timeout 已設 10s；新增執行時間驗證 |
| MEMORY.md 500 行後仍不夠 | Low | Low | Topic files 機制已存在，可進一步拆分 |
| Agent prompt 變更導致 frontmatter parse 錯誤 | Low | High | S05 Test 4 驗證 YAML frontmatter 完整性 |
| session-summary.md timestamp 堆積復發 | Medium | Low | 已有 /athena:learn Step 3.7 清理；S05 Test 6 手動驗證 |

## Key Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | 不載入 TECHSTACK.md 全文 | session-summary Quick Reference 已含技術棧摘要，避免重複 |
| 2 | 新增 git log + diff stat 到 SessionStart | 減少 agent 初期的 git 探索 tool calls |
| 3 | Agent preloading 用文字指引而非 hook 自動注入 | Agent prompts 是 markdown，無法執行 shell；指引讓 agent 自行批次 Read |
| 4 | Loop subagent prompt inline epic details | 避免 subagent 載入 280 行 EPIC_INDEX 只為找 3 行 epic 描述 |
| 5 | 移除 CLAUDE.md 硬行數限制 | 1M context 下 100 行限制無意義，但仍保持精簡原則 |
| 6 | MEMORY.md 200→500 | 2.5x 增幅平衡了容量需求與避免 bloat；topic files 仍是主要拆分機制 |

## Implementation Notes

- 所有 stories 都是 infra/docs 變更，零產品程式碼修改
- 無 OpenAPI 變更、無 migration、無新 dependencies
- S01 先做（最高 ROI），S02-S04 可平行，S05 最後（驗證）

```
S01 (hook expand) → S05 (驗證)
S02 (memory limit) →
S03 (agent context) →
S04 (docs update) →
```

## Complete File Change Matrix

| 檔案 | Story | 動作 |
|------|-------|------|
| `scripts/hooks/session-start.sh` | S01 | 重寫：4 區塊全文輸出 |
| `~/.claude/.../memory/context-control.md` | S02, S04 | 更新行數限制 |
| `~/.claude/.../memory/MEMORY.md` | S02 | 清理過時 entries |
| `.claude/agents/qa.md` | S03 | 新增 preloading 段落 |
| `.claude/agents/spec-writer.md` | S03 | 新增 preloading 段落 |
| `.claude/agents/strategist.md` | S03 | 新增 preloading 段落 |
| `.claude/commands/athena/implement.md` | S03 | 擴展 preloading 指引 |
| `.claude/commands/athena/loop.md` | S03 | 更新 subagent prompt template |
| `CLAUDE.md` | S04 | 移除 100 行硬限制 |
| `docs/context/CLAUDE.md` | S04 | 新增 Context Budget 段落 |
| `scripts/hooks/CLAUDE.md` | S04 | 更新 SessionStart 描述 |

## QA Checklist

- [ ] `session-start.sh` 輸出行數在 150–400 行範圍內
- [ ] `session-start.sh` 執行時間 < 3 秒
- [ ] Hook 輸出包含完整 session-summary（非僅 Quick Reference 區段）
- [ ] Hook 輸出包含 epic-progress 狀態
- [ ] Hook 輸出包含 `git log --oneline -10`
- [ ] 所有 agent `.md` 檔案保持有效 YAML frontmatter（`---` 開頭與結尾）
- [ ] Agent preloading 段落不與現有 Rules/Workflow 段落衝突
- [ ] `context-control.md` 中 MEMORY.md 限制更新為 500
- [ ] `CLAUDE.md` 不再包含「under 100 lines」硬限制
- [ ] `docs/context/CLAUDE.md` 包含 Context Budget 段落
- [ ] `scripts/hooks/CLAUDE.md` SessionStart 描述反映新行為
- [ ] `/athena:loop` subagent prompt template 包含 inline epic details
- [ ] `/athena:implement` 包含 preloading 指引
- [ ] `scripts/smoke-test.sh` 通過（exit 0）
- [ ] 新 session 啟動後可直接回答「目前到哪個 epic？」（無需額外 Read）
- [ ] session-summary.md 無新增 `<!-- last activity -->` timestamp 堆積
