---
title: "AI-Coding-Template × Claude Code — 架構文字版（context 用）"
origin: "distilled from .claude/agents/ + .claude/commands/athena/ + scripts/hooks/ + docs/epics/EPIC_INDEX.md"
purpose: "純文字 context — 給 LLM / Claude Code session / 想 copy-paste 的讀者"
audience: "模板使用者 · 要 fork 成新專案的工程師 · 想了解 Athena orchestration 的讀者"
maintained: "若 agents / commands / hooks 改動，此檔要同步（與 agent-team-mindmap.html 雙檔維護）"
updated: "2026-04-24（CLAUDE.md 10-agent 版 + Phase 40/41/42 epic 規劃同步）"
---

# AI-Coding-Template × Claude Code — 架構文字版

> 👋 本檔是 [`agent-team-mindmap.html`](./agent-team-mindmap.html) 的**純文字版 context**。HTML 用來互動瀏覽 / 簡報、本檔用來給 LLM 吃 context、或想 copy-paste 到筆記的讀者。兩者是**同一份概念的兩種渲染**。

---

## TL;DR

這個模板做 **3 件事**，各自有獨立 pipeline、agent 組、記憶層：

| System | 目的 | 主要 command | 主要 agent | 儲存 |
|--------|------|--------------|-----------|------|
| **Dev** 🛠 | 把 feature 從 spec 做到 prod | spec · implement · qa · ship · deploy · loop · batch · domain · dba · dashboard | @spec-writer · @reviewer · @qa · @evaluator · @debugger · @deployer · @orchestrator · @best-practice *(advisor)* | feature branch + PR + Zeabur |
| **Learning** 📚 | 從「已做的事」長出「下一件事」 | plan · cycle · learn · audit · metrics · qa-report | @strategist · @best-practice | `docs/context/strategy-log.md` · `review-findings.md` · `.claude/audit.jsonl` |
| **Memory** 🧠 | 跨 session / 跨 project 保留 wisdom | save · load · promote | @memory-curator | Tier 0 (`~/.claude/template-memory/`) · Tier 1 (`docs/context/`) · Tier 2 (session) |

**核心訊息**：不是「AI 寫 code 給你」— 是**有紀律的 AI 開發**。Dev 產成果、Learning 決定下一步、Memory 保證下次更聰明。三個 system 相互餵養：Dev 失敗 → Memory 記下 `[GENERALIZABLE]` → Learning 在下一輪 plan 中採納。

### 機制視角（5-layer × Hook）

上面三個 system 都由同一組機制實作：

| 層 | 是什麼 | 數量 |
|----|--------|------|
| L1 · Command | `/athena:*` 慢捷 prompt | **20 個** runnable + 1 個 pattern doc |
| L2 · Agent | 專職分工的 LLM 職位 | **10 個** |
| L3 · Skill | Auto-inject 的領域知識 | `.claude/skills/` + Tier 0 cross-project |
| L4 · Pipeline | Command 打包 agent 接力 | **6 條**：Epic · QA · Loop · Batch · Deploy · Design *(計畫)* |
| L5 · 人審 | 永遠留給人的最後一哩 | 3 gate：plan approval · PR merge · promote apply |
| 橫切 · Hook | Claude Code 執行前後的攔截點 | **18 個 Stop 規則** + 19 個 hook script 總共 |

「3-system 視角」看 **目的**（你要 dev / learning / memory 哪個？）；「5-layer 視角」看 **機制**（要改哪支 command / agent / hook？）。兩個視角都要會用。

---

## Part 0 · 三大 System 詳解（先看這個）

### 🛠 Dev System — 把 feature 做出來

```
/athena:plan           ─► @strategist 提案 epic (→ Learning)
       ↓ 人類批准
/athena:spec E<N>      ─► @spec-writer openapi-first 契約
       ↓
/athena:implement      ─► TDD red/green（@debugger auto on fail）
       ↓
/athena:qa             ─► @reviewer → @qa → @evaluator
       ↓
/athena:ship|pr        ─► commit + merge PR
       ↓
/athena:deploy [env]   ─► @deployer 7-gate Zeabur
```

**觸發路徑**：
- **順跑**：`/athena:loop` 一步一步推進、人類在每 step 之間 checkpoint
- **批次**：`/athena:batch auto` 多 epic 平行 wave（@orchestrator 協調）
- **快捷**：`/athena:ship` 直接跑 review→fix→commit→PR、`/athena:pr` 完整 merge-main→build→test→lint→PR

**關鍵 agent**（依序）：
`@spec-writer` → `@reviewer` + `@qa` + `@evaluator`（parallel QA）→ `@debugger` (auto) → `@deployer` → `@orchestrator`（batch driver）· `@best-practice` 任何時候可諮詢

**輸出到**：feature branch → PR → Zeabur / Cloud Run

---

### 📚 Learning System — 從「已做」長出「下一件事」

```
Observe：收集信號
  ├─ /athena:audit    →  OpenAPI ↔ server ↔ client 三源一致性
  ├─ /athena:metrics  →  agent 可靠度 (.claude/audit.jsonl)
  ├─ /athena:qa-report→  bugfix-log.md → bug 模式
  └─ /athena:learn    →  MEMORY.md 是否 drift

       ↓ (收集的洞察)

Plan：提案下一件事
  └─ /athena:plan → @strategist → Phase PRD + epic 草稿
       ↓ 人類批准
       ↓

Execute：走 Dev System（上面）
       ↓

Reflect：回到 /athena:plan
  └─ /athena:cycle → plan → approve → execute → reflect 全循環
```

**關鍵 agent**：`@strategist`（產 Phase PRD + epic 提案）· `@best-practice`（trade-off 決策）

**輸入信號**：
- `docs/context/debug-log.md`（bug 模式）
- `docs/context/review-findings.md`（review 系統性問題）
- `.claude/audit.jsonl`（agent 可靠度）
- `docs/context/bugfix-log.md`（E148 — commit 觸發 append）
- 產業信號（人類帶入，如 Phase 41 來自 RDT / Claude Design / Drafted）

**輸出到**：`docs/epics/phase-N-prd.md` + `docs/epics/e<N>-*.md` + `docs/epics/EPIC_INDEX.md` 更新

**人類 gate**：`/athena:plan` 提案必須人類批准才進 EPIC_INDEX。LLM 不能 self-prescribe 新 epic。

#### Lessons Library — `~/.claude/template-memory/` (Tier 0 · 15 檔)

`@strategist` 和 `@best-practice` 做判斷前會先讀這個全球庫。每次 fork 新 project 都繼承。目前 13 個 lesson pattern + 1 archive + 1 README：

| 檔 | 內容 |
|----|------|
| `NEW_PROJECT_PRIMER.md` | Fork 後第一小時要先看的綜覽 |
| `anti-patterns.md` | 反模式清單（別這樣做） |
| `architecture-lessons.md` | 架構判斷累積的教訓 |
| `architecture-patterns.md` | 可複製的架構模式 |
| `design-handoff-pattern.md` | 設計 → 程式碼交接慣例（餵 E163 @designer） |
| `dx-patterns.md` | Developer Experience 模式（make go / doctor / tutorial） |
| `failure-patterns.md` | 已撞過的失敗模式（餵 @debugger） |
| `integration-gotchas.md` | 跨層整合踩雷（route / MSW / zod / CSS 等） |
| `mockup-contract.md` | Mockup → spec 的契約守則 |
| `performance-insights.md` | 效能觀察 + 優化優先順序 |
| `security-learnings.md` | 安全相關教訓（OWASP + SaaS） |
| `testing-patterns.md` | 測試金字塔 + TDD 10 原則 |
| `workflow-patterns.md` | 工作流程節奏（ship / pr / cycle / batch） |
| `architecture-lessons-archive-2026.md` | 年度封存，避免 lessons 無限增長 |
| `README.md` | 本目錄說明 |

路徑：`/Users/MH/.claude/template-memory/`（所有 forked project 共用）。

**往 Tier 0 加新檔的唯一方式**：`/athena:promote --apply <proposal>` → @memory-curator 寫入。不能用 Edit/Write 直接改 — 會被 memory-curator 以「沒經過提案」拒絕。

---

### 🧠 Memory System — 保證下次更聰明

```
Tier 2 (Session)
  └─ 當前對話 buffer — session 結束消失

Tier 1 (Project)                           docs/context/*.md  — 16 個
  │
  ├─ 14 個 agent-owned（每個 agent 寫自己那一份）
  │  ├─ spec-log.md           @spec-writer
  │  ├─ review-findings.md    @reviewer
  │  ├─ review-log.md         @qa (legacy — kept for archive compat)
  │  ├─ test-status.md        @qa
  │  ├─ evaluation-log.md     @evaluator（E147）
  │  ├─ decisions.md          @best-practice
  │  ├─ debug-log.md          @debugger ← [GENERALIZABLE] tag 來源
  │  ├─ deploy-log.md         @deployer
  │  ├─ orchestration-log.md  @orchestrator（/athena:batch）
  │  ├─ strategy-log.md       @strategist（/athena:plan）
  │  ├─ qa-patterns.md        @qa + @spec-writer
  │  ├─ epic-progress.md      /athena:loop（machine-readable state）
  │  ├─ session-summary.md    /athena:save（全員 checkpoint）
  │  └─ health-log.md         reserved for future @devops-monitor
  ├─ 1 個 hook-managed
  │  └─ bugfix-log.md         PostToolUse hook on `fix:` commits（E148）
  └─ 1 個 convention
     └─ CLAUDE.md             agent ownership 對照表

       ↑
       │ Session 結束 `/athena:save`   →  全員 checkpoint Tier 1
       │ Session 啟動 SessionStart hook →  注入 active phase context
       │          `/athena:load`        →  讀完所有 Tier 1
       ↓

Tier 0 (Global)                             ~/.claude/template-memory/*.md — 15 個
  │  跨所有 forked project 共享 · 唯一寫入路徑：/athena:promote --apply
  │
  ├─ 13 個 lesson patterns
  │  ├─ NEW_PROJECT_PRIMER.md          Fork 後必讀
  │  ├─ anti-patterns.md               反模式清單
  │  ├─ architecture-lessons.md        架構教訓（active）
  │  ├─ architecture-patterns.md       可複製的架構模式
  │  ├─ design-handoff-pattern.md      設計→程式碼交接（餵 @designer）
  │  ├─ dx-patterns.md                 DX 模式（make go / doctor）
  │  ├─ failure-patterns.md            失敗模式（餵 @debugger）
  │  ├─ integration-gotchas.md         跨層整合踩雷
  │  ├─ mockup-contract.md             Mockup → spec 契約
  │  ├─ performance-insights.md        效能觀察
  │  ├─ security-learnings.md          安全教訓
  │  ├─ testing-patterns.md            測試金字塔 + TDD
  │  └─ workflow-patterns.md           Ship/PR/Cycle/Batch 節奏
  ├─ 1 個年度 archive
  │  └─ architecture-lessons-archive-2026.md
  └─ 1 個說明檔
     └─ README.md
```

> **完整 Tier 1 寫入對照表**：見 `docs/context/CLAUDE.md`。
> **完整 Tier 0 lessons 清單 + 用途**：見上面 Learning System 區塊。

**Tier 1 → Tier 0 promotion flow**：

```
@debugger 寫 debug-log.md 帶 [GENERALIZABLE]
       ↓
E158 hook（計畫）偵測 ≥3 新 tag → 產 promotion-proposals/<ts>.md
       ↓
人類 review proposal
       ↓
/athena:promote --apply <file>
       ↓
@memory-curator 升級到 Tier 0 ~/.claude/template-memory/
       ↓
所有未來 fork 繼承這份 wisdom
```

**關鍵 agent**：`@memory-curator`（只一個，專職 Tier 0 curation）

**關鍵 command**：`save`（checkpoint 所有 Tier 1）· `load`（啟動時讀 context）· `promote`（Tier 1 → Tier 0）

**關鍵 hook**：
- `SessionStart`（注入 active phase context ~30 行）
- `SubagentStop`（write-back 加 timestamp）
- `PostToolUse → auto-promote-check.sh`（E158 計畫）

---

### 三 System 相互餵養（為何有紀律的 AI 開發會「自我加速」）

```
   Dev System ──(失敗 / bug 模式 / review 發現)──► Learning System
        ▲                                                │
        │                                                │ (新 epic 提案)
        │                                                ▼
        └───────────────(批准後執行)──────────────────────┘

   Dev / Learning ─────(記下 [GENERALIZABLE])─────► Memory System
                                                        │
                                                        │ (下次 session)
                                                        ▼
                                            Tier 0 + Tier 1 回饋
                                            給 Dev / Learning agent
```

**典型例子**（Phase 40）：

1. **Dev**：E155 landing 時發現 batch/loop 有時會跳過 QA
2. **Memory**：@debugger 記 `debug-log.md` 標 `[GENERALIZABLE]`：「orchestrator 語意守門不夠」
3. **Learning**：@strategist 讀近期 debug-log + bugfix-log → 提出 Phase 40 E158（auto-promote）+ E155 升級為 Stop verifier Rule #18
4. **批准 + 執行 → 回到 Dev**：Rule #18 landed → 未來所有 batch/loop 強制有 QA 證據

---

## Part 1 · 中心 · Claude Code × Athena

這個 repo 的核心是 `/athena:` 這個命名空間，對應一個名為 **Athena** 的 agent 編排系統。從 epic spec 到 prod 部署、從 code review 到 test quality audit，全部由 10 個 agent 分工接力、19 個 slash command 驅動、Stop verifier 收尾守門。

**五層疊加（由下往上）**：L1 Command → L2 Agent → L3 Skill → L4 Pipeline → L5 人審。
**Hook 橫切**：Stop verifier + PreToolUse guard + PostToolUse 格式化 + SessionStart context 注入，獨立於 5 層之外，任何流程都可能撞到。

---

## Part 2 · Hub 1 · Command（Layer 1）

使用者打 `/athena:xxx` 觸發的快捷 prompt。固化「每次都這樣問」的常用對話，並強制走 epic pipeline。

- **命名慣例**：全部放在 `.claude/commands/athena/` 下。`athena` 是這個模板的 orchestration namespace — fork 後可改名為自己的 namespace（例：`/shutien:spec`）。
- **為何只 command 走 namespace**：命令靠打字觸發、有 autocomplete 可發現性，namespace 有價值。Agent / Skill 靠 `@mention` / auto-inject，flat 反而更乾淨。

### Leaves（20 個 runnable + 1 個 pattern doc）

| 指令 | 作用 |
|------|------|
| `/athena:spec <feature>` | OpenAPI-first 規格設計。spawn `@spec-writer`。|
| `/athena:implement` | TDD 紅綠重構。從 spec → code → `@qa`。|
| `/athena:qa` | Quality gate — `@reviewer` + `@qa` + `@evaluator` 三相。支援 `--review-only` / `--test-only` / `--eval-only`。|
| `/athena:loop [status]` | Epic loop — 每次呼叫推進「一步」（spec / impl / qa / commit / merge 擇一）。|
| `/athena:batch [auto\|epics]` | 平行執行 — 根據 dependency 圖分 wave，spawn 多 agent 並行。|
| `/athena:ship [--draft]` | 快速發布 — review → fix → commit → PR。|
| `/athena:pr [--draft]` | 完整 pipeline — merge main → build → test → lint → PR。|
| `/athena:deploy [env]` | 7-gate 部署 Zeabur。|
| `/athena:load` | Session 啟動時讀 context / 總結狀態。|
| `/athena:save` | 所有 agent 同時存 checkpoint（session resume）。|
| `/athena:plan [mode]` | 策略規劃 — `@strategist` 提 epic 提案，人類批准。|
| `/athena:cycle` | 完整 DevOps 循環（plan → approve → execute → reflect）。|
| `/athena:learn` | MEMORY.md accuracy refresh + drift detect。|
| `/athena:promote` | 從 `docs/context/` 抽 `[GENERALIZABLE]` lesson → Tier 0。|
| `/athena:domain <name>` | Scaffold 新 domain module（server + client + tests）。|
| `/athena:dba [cmd]` | 資料庫管理 — inspect, lint, diagnose migrations。|
| `/athena:dashboard` | Pipeline 進度看板（read-only）。|
| `/athena:audit` | 三源一致性稽核（OpenAPI ↔ server ↔ client）。|
| `/athena:metrics` | Agent 可靠度統計（從 `.claude/audit.jsonl`）。|
| `/athena:qa-report` | Bug-to-Epic pipeline — `bugfix-log.md` → epic 提案。|
| `/athena:qa-enforcement-pattern` | *（lesson doc，非 runnable）* Batch/loop QA gate 強制化模式。|

---

## Part 2 · Hub 2 · Agent（Layer 2）

專職 AI 分工。每個 `.claude/agents/*.md` 是一份「職位說明書」— 定義角色、模型、允許工具、輸入、輸出契約、write-back 檔案。

**紀律**：每個 agent **只做自己擅長的事**。單一 LLM 身兼數職會 confirmation bias（自己提方案自己審），分工解這個。

### 10 個 agent（按 epic pipeline 流程順序）

| Agent | 職責 | 模型 | Write-back |
|------|------|------|-----------|
| `@spec-writer` | Feature 規格設計，OpenAPI-first | opus | `docs/context/spec-log.md` |
| `@best-practice` | 架構決策、trade-off 諮詢 | opus | `docs/context/decisions.md` + `TECHSTACK.md §12` |
| `@reviewer` | Code review + 安全稽核（read-only） | opus | `docs/context/review-findings.md` |
| `@qa` | 測試執行、80% 覆蓋率守門、Test Quality Audit | sonnet | `docs/context/test-status.md` + `docs/context/qa-patterns.md` |
| `@evaluator` | 獨立驗收評估（E147 新增，Phase 4） | sonnet | `docs/context/evaluation-log.md` |
| `@debugger` | Auto-retry 錯誤分析、failure pattern matching | sonnet | `docs/context/debug-log.md`（可標 `[GENERALIZABLE]`） |
| `@deployer` | 7-gate 部署協議（Zeabur） | sonnet | `docs/context/deploy-log.md` |
| `@memory-curator` | 抽取 wisdom 升級到 Tier 0 | opus | `~/.claude/template-memory/` |
| `@strategist` | Audit, research, 提 epic 提案 | opus | `docs/context/strategy-log.md` |
| `@orchestrator` | 平行 epic 協調、dependency wave 排程 | opus | `docs/context/orchestration-log.md` |

**模型策略**：opus 用於策略 / 審閱 / 評估類工作（需要判斷），sonnet 用於執行類（跑測試、跑 debug loop、跑部署）。

### Subagent timeout rule（**從血淚換來的紀律**）
- 所有 subagent 必須 **narrow scope**（單一任務、明確輸出契約）
- **絕不** 讓 agent 無限跑 — 用 `MAX_ITERATIONS` / `BUDGET` / `stuck detection`
- 超時或卡住 → 升級到人類，寫入 `debug-log.md`

---

## Part 2 · Hub 3 · Skill（Layer 3）

**Auto-inject** 的領域知識。Agent 工作時自動載入，不用手動 `@mention`。

### 來源分層

- **專案 skill**（`.claude/skills/`）— 此模板特有的領域包
- **Tier 0 global**（`~/.claude/template-memory/`）— 跨專案 wisdom，由 `/athena:promote` 抽取而來，所有模板用戶共享
- **Tier 1 project**（`docs/context/*.md`）— 本專案狀態，session 結束 checkpoint

**觸發機制**：Skill 的 `description` YAML 欄位告訴 Claude「什麼場景該引用我」。當 agent context 包含相關關鍵字，skill 內容被 inject。

### 代表性 skill

- **claude-api** — Anthropic SDK 整合（prompt caching, thinking, tool use, batch, citations）
- **ecpay / stripe-best-practices** — 金流整合
- **n8n-* suite** — n8n workflow / Code node / expression / validation
- **gitbook / athena:** — 文件工作流
- **superpowers:*** — 開發紀律套組（brainstorming / TDD / debugging / code review）

Skill 不靠使用者主動呼叫、namespace 對 auto-inject 無幫助，flat 反而更簡潔。

---

## Part 2 · Hub 4 · Pipeline（Layer 4）

把 agent 接力打包成**單一 command**，輸出「人審報告 + 決策問句」。不自動 commit / 不自動 merge（除非 autopilot `AUTOPILOT_ALLOW_MERGE=1`）。

目前共 **6 條 pipeline**（5 個已上線 + 1 個 Phase 41 計畫中）。

### Pipeline A · Epic Pipeline（主力流程）

```
/athena:plan       ─► @strategist 提案 epic（人類批准）
       ↓
/athena:spec       ─► @spec-writer 寫 OpenAPI spec + epic .md
       ↓
/athena:implement  ─► TDD red/green/refactor（@debugger auto on fail）
       ↓
/athena:qa         ─► @reviewer → @qa → @evaluator（3-phase）
       ↓
commit + merge     ─► （人類 PR 批准）
```

**強制接力**：Stop verifier Rule #18（E155）監控 `epic-progress.md`，若 `impl=✅ ∧ qa=⬜` 會拒絕 Stop — 防止「跳過 QA」這條 shortcut。

### Pipeline B · QA Pipeline（品質守門）

```
/athena:qa
  ├─ Phase 1 · Static checks (ruff, mypy, eslint)           →  自動
  ├─ Phase 2 · Tests (pytest + vitest) + coverage gate ≥80% →  @qa
  ├─ Phase 2.5 · Contract Conformance (計畫 E156)           →  @qa
  ├─ Phase 2.6 · Migration Safety (計畫 E157)               →  @qa → @dba (on red flag)
  ├─ Phase 3  · Test Quality Audit                          →  @qa
  └─ Phase 4  · @evaluator 獨立驗收 (E147)                   →  @evaluator
```

測試失敗 → **自動 delegate `@debugger`**（不用人喊）。E162 Phase 41 計畫把 `@reviewer` 改成 iterative convergence loop — 跑 ≤4 輪直到收斂或偵測卡住。

### Pipeline C · Loop Pipeline（單步推進）

```
/athena:loop            讀 epic-progress.md → 找下一個 ⬜ step → 推進 ONE
  │
  ├─ step=spec      → spawn @spec-writer
  ├─ step=implement → TDD harness (auto @debugger on fail)
  ├─ step=qa        → Pipeline B (QA)
  ├─ step=commit    → git commit（Stop verifier 全檢）
  └─ step=merge     → git push + PR 建立

/athena:loop status     只讀、不推進 — 顯示 state
```

**為何一步就好**：人類在一步與下一步之間有 checkpoint。失敗時不會連帶污染後續步驟。亦是 E164 autopilot 的基礎單位 —autopilot 加上 confidence score 決定該不該自動 `/athena:loop`。

### Pipeline D · Batch Pipeline（平行波次）

```
/athena:batch auto
  ├─ @orchestrator 讀 epic-progress.md + dependency graph
  ├─ 分 wave（wave = 無 dependency 鎖的 epic 群）
  ├─ Spawn N worker agent 併發（max 4 concurrent，每個獨立 worktree）
  └─ 每 wave 完成 → 整合測試 gate（E91）→ 下一 wave
```

每 worker 在自己的 `git worktree`（由 `scripts/hooks/worktree-setup.sh` 準備），互不污染。Phase 40（6 epic 全 parallel）= 1 個 wave；Phase 41（E162+E163 並行 → E164）= 2 waves。

### Pipeline E · Deploy Pipeline（7-gate Zeabur）

```
/athena:deploy [env]
  ├─ Gate 1 · CI 綠（tests + coverage + lint + e2e）
  ├─ Gate 2 · No uncommitted changes
  ├─ Gate 3 · On main branch（或 preview flag）
  ├─ Gate 4 · Migration dry-run OK
  ├─ Gate 5 · Pre-deploy guard pass（scripts/hooks/pre-deploy-guard.sh）
  ├─ Gate 6 · Env vars present（VITE_API_URL build-time baked）
  └─ Gate 7 · Rollback plan recorded（deploy-log.md）
  → @deployer 執行，任一 gate 失敗即 abort
```

Phase 40 E159 會加第 8 gate（`GET /admin/sli` baseline check）+ Gate 7（E156 contract conformance 重跑，defense-in-depth）。部署目標 Zeabur 為主、Cloud Run 次（E121–E124 雙向 deploy guide）。

### Pipeline F · Design Pipeline（計畫中 · Phase 41 E163）

```
/athena:design <slug> "<description>" [--blueprint <html>] [--ref-image <png>]
  ├─ @designer 讀 design-system.css 47 tokens + common/*.css primitives
  ├─ Produces: Page.tsx + Page.css + Page.test.tsx + App.tsx route + ROUTE_MAP entry
  ├─ Auto-run Stop verifier Rules #13 (orphan route) / #14 (CSS co-location) / #17 (CSS var drift)
  └─ Writes docs/context/design-review/<slug>.md (a11y + token inventory + responsive breakpoints)
```

新增第 11 個 agent `@designer`（Phase 41 landed 後，team grows 10 → 11）。E163 與 E165（theme palette）在 Phase 42 共同把 design→code→theme 鏈路打通。

### Pipeline 觸發矩陣

| Pipeline | 觸發 command | Driver agent | Supporting agents |
|---|---|---|---|
| Epic | `/athena:loop` / `/athena:ship` / `/athena:pr` | — (sequencer) | @spec-writer → @reviewer → @qa → @evaluator → @debugger (on fail) |
| QA | `/athena:qa` [`--review-only`\|`--test-only`\|`--eval-only`] | @qa (test phase) | @reviewer + @evaluator + @debugger (auto) + @dba (計畫) |
| Loop | `/athena:loop` | — (state machine) | 依 step 選 agent |
| Batch | `/athena:batch` [`auto`\|`--phase N`\|epics...] | @orchestrator | N × (任一 epic pipeline agent) |
| Deploy | `/athena:deploy` [env] | @deployer | — |
| Design (計畫) | `/athena:design <slug>` | @designer | — |

### Agent Cowork Matrix

縱軸 = agent，橫軸 = pipeline。✅ = 主要角色、◻ = support（auto-delegated 或 read-only）。

| Agent | Epic | QA | Loop | Batch | Deploy | Design | Plan | Promote |
|------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| @spec-writer | ✅ | | ◻ | ◻ | | | | |
| @reviewer | ✅ | ✅ | ◻ | ◻ | | | | |
| @qa | ✅ | ✅ | ◻ | ◻ | | | | |
| @evaluator | ✅ | ✅ | ◻ | ◻ | | | | |
| @debugger | ◻ | ◻ | ◻ | ◻ | | | | |
| @best-practice | ◻ | | | | | ◻ | ◻ | |
| @strategist | | | | | | | ✅ | |
| @deployer | | | | | ✅ | | | |
| @orchestrator | | | | ✅ | | | | |
| @memory-curator | | | | | | | | ✅ |
| @designer *(計畫)* | | | | | | ✅ | | |

### 附註 · `/athena:plan` + `/athena:promote` 是 2 個 mini-pipeline

兩者都只涉及 1 個 agent + 1 個人類 gate，因此沒獨立計入 6 大 pipeline：

- **Plan flow**：`/athena:plan` → @strategist 產 Phase PRD + epic 草稿 → **人類批准** → 寫入 EPIC_INDEX
- **Promote flow**：@debugger 標 `[GENERALIZABLE]` → E158 hook 偵測 ≥3 tag → 產 proposal → **人類跑 `/athena:promote --apply`** → @memory-curator 升級 Tier 0

---

## Part 2 · Hub 5 · Hook（Layer 橫切）

Claude Code 執行 tool **前/後** 或 session **開始/結束** 時的攔截點。獨立於 5 層疊加之外、橫切所有流程。

### Stop Verifier（18 規則，Rule #18 = E155 QA gate enforcement）

完成前守門 — 違規直接拒絕結束 session：

1. localStorage ban · 2. fireEvent ban · 3. staleTime hardcoding · 4. MSW handler 位置
5. 資料夾命名 · 6. OpenAPI drift · 7. console.log 殘留 · 8. 檔案過大警告
9. Internal mock assertion · 10. Parametrize nudge · 11. Mock depth limit · 12. Test file size
13. Orphan route · 14. CSS co-location · 15. MSW factory · 16. Zod schema bridge
17. CSS var drift · **18. QA gate enforcement**

*（Phase 40 計畫加 Rule #19 migration signoff + Rule #20 openapi.yaml contract evidence）*

### 其他 hook 類型

- **PreToolUse guard** — 危險指令攔截（DROP TABLE, rm -rf, dirty deploy 等）
- **PostToolUse** — 自動格式化（ruff / prettier）、bugfix-log 追加、auto-promote check
- **SessionStart** — 注入 active epic context（~30 行）
- **SubagentStop** — 為 write-back 加 timestamp
- **Webhook** — 任務完成 ping `$AI_CODING_WEBHOOK_URL`（Slack/Discord/n8n）
- **JSONL audit log** — 所有 agent 事件寫 `.claude/audit.jsonl`，`jq` 可查詢

設定全在 `.claude/settings.json` + 各 agent frontmatter。

---

## Part 2 · Hub 6 · 人審（Layer 5）

**AI 做研究跟草稿，人做判斷跟承擔** — 這是 Athena 編排的核心哲學。不管 pipeline 多自動、confidence 分數多高，以下三個 gate 永遠留給人：

1. **`/athena:plan` 批准** — `@strategist` 提的 epic 提案、人類點頭才進入 batch / loop
2. **PR merge** — CI 綠、coverage 過、Stop verifier 清，仍要人類按合併
3. **`/athena:promote --apply`** — 從 `[GENERALIZABLE]` 提案升級到 Tier 0 全球記憶，人類選哪些值得帶走

E164 autopilot（Phase 41，計畫中）降低 human touch 到每 epic **2 次**（plan + merge），其他步驟在 confidence ≥ 0.85 時自動推進。預設 `AUTOPILOT_ALLOW_MERGE` 和 `AUTOPILOT_ALLOW_PROD_DEPLOY` 保持關閉。

---

## Part 3 · 跨層連線（mindmap 的 dashed links）

這些不是 hierarchy 連線、是**使用關係**連線：

| 關係 | 說明 |
|------|------|
| `/athena:qa` uses `@reviewer` / `@qa` / `@evaluator` | QA pipeline 呼叫三個 quality agent |
| `/athena:batch` uses `@orchestrator` + N x worker agents | 平行波次靠 orchestrator 調度 |
| `/athena:plan` uses `@strategist` | 策略性提案走 strategist |
| `/athena:promote` uses `@memory-curator` | Tier 0 升級靠 curator |
| `@debugger` writes `[GENERALIZABLE]` → auto-promote hook | Tag-driven feedback loop（Phase 40 E158 會全自動化） |
| `@qa` fails → auto-delegate to `@debugger` | `@debugger` 不是 human 呼叫，是 `@qa` 錯誤時自動接手 |
| Stop verifier reads `epic-progress.md` | Rule #18 = QA gate 防跳步 |

交互原則：
- **Agent 不知道 pipeline 存在** — agent 只看輸入 prompt
- **Pipeline 選擇要用哪個 agent** — pipeline 把 context 推給 agent
- **Skill 是 agent 的內部 SOP** — pipeline 不直接引 skill，靠 agent context 觸發 auto-inject

---

## Part 4 · 三個 Memory Tier（跨 session 延續）

這個模板的記憶系統是 Athena 的第二層骨幹 — 沒有 Tier 記憶，agent 每個 session 都從零開始。

| Tier | 位置 | 內容 | 生命週期 |
|------|------|------|---------|
| Tier 0 Global | `~/.claude/template-memory/` | 跨專案 wisdom（**15 個** .md 檔：13 lesson + 1 archive + 1 README） | 永久；`/athena:promote` 升級 |
| Tier 1 Project | `docs/context/` | 本專案狀態（**16 個** .md 檔：14 agent-owned + 1 hook-managed `bugfix-log.md` + 1 `CLAUDE.md`） | 專案生命週期；`/athena:save` checkpoint |
| Tier 2 Session | conversation buffer | 當前 session 對話 | Session 結束消失 |

**Tier 1 → Tier 0 的升級路徑**：
1. Agent 在 Tier 1 檔案寫 `[GENERALIZABLE]` tag
2. E158 auto-promote hook 偵測到 ≥3 個新 tag → 產生 `promotion-proposals/<ts>.md`（Phase 40 計畫）
3. 人類跑 `/athena:promote --apply <file>` → 升級到 Tier 0

**典型 Tier 0 內容**：`subagent-rules.md` / `tdd-workflow.md` / `debugging-playbook.md` / `stop-verifier-patterns.md`。

---

## Part 5 · 三個分號 Phase 的 roadmap（Phase 40 / 41 / 42，計畫中）

到 2026-04-24 為止共 156 個 epic 已落地（E0–E155），還有 11 個 epic 在 Phase 40–42 規劃中：

### Phase 40 · Self-Review Improvements（6 epics，28 SP）

關閉自我審查中找到的 6 個 silent failure：contract drift（E156）· migration safety（E157）· generalizable feedback loop（E158）· SRE observability（E159）· context log auto-archive（E160）· auth adapter 清算（E161）。

### Phase 41 · AI-First Integration（3 epics，18 SP）

接住 2026-04-24 的產業信號：iterative reviewer convergence（E162 · RDT 啟發）· design-to-code pipeline（E163 · /athena:design + @designer agent）· autopilot confidence gates（E164 · Drafted 啟發）。

### Phase 42 · Visual Enrichment（2 epics，S+S）

收 Claude Design spike 尾巴：theme palette expansion（E165 · rose + forest）· talk-deck SVG diagrams（E166）。

完整 [Phase 40 PRD](../../docs/epics/phase-40-prd.md) · [Phase 41 PRD](../../docs/epics/phase-41-prd.md)。

---

## Part 6 · 完整清單（Flat Catalogue）

當想「到底有多少東西」時翻這裡。實際數字來自 `ls` — 若修改 agent / command / hook，請同步這份清單 + `scripts/visuals-mindmap-verify.sh --fix`。

### 10 個 Agent（全部 `.claude/agents/*.md`）

| # | Agent | 模型 | Write-back |
|---|---|---|---|
| 1 | `@best-practice` | opus | `decisions.md` + `TECHSTACK.md §12` |
| 2 | `@debugger` | sonnet | `debug-log.md` |
| 3 | `@deployer` | sonnet | `deploy-log.md` |
| 4 | `@evaluator` | sonnet | `evaluation-log.md` |
| 5 | `@memory-curator` | opus | `~/.claude/template-memory/` (Tier 0) |
| 6 | `@orchestrator` | opus | `orchestration-log.md` |
| 7 | `@qa` | sonnet | `test-status.md` + `qa-patterns.md` |
| 8 | `@reviewer` | opus | `review-findings.md` |
| 9 | `@spec-writer` | opus | `spec-log.md` |
| 10 | `@strategist` | opus | `strategy-log.md` |

**Opus:Sonnet = 6:4**（策略/審閱類用 opus、執行類用 sonnet）。
**Template-only**：`.claude/agents/domain-expert.md.tmpl` 不算 live agent（由 `/athena:domain` scaffold 出 domain 專家時使用）。

### 20 個 runnable command + 1 個 pattern doc（全部 `.claude/commands/athena/*.md`）

#### Epic lifecycle（7）
| # | Command | 簡述 |
|---|---|---|
| 1 | `/athena:spec` | OpenAPI-first 規格設計 |
| 2 | `/athena:implement` | TDD 紅綠重構 |
| 3 | `/athena:qa` | QA pipeline（3-phase + 可選 eval） |
| 4 | `/athena:loop` | Epic 單步推進 |
| 5 | `/athena:ship` | Review → fix → commit → PR |
| 6 | `/athena:pr` | 完整管線 + merge main |
| 7 | `/athena:batch` | 平行 wave 執行 |

#### Planning & Strategy（3）
| # | Command | 簡述 |
|---|---|---|
| 8 | `/athena:plan` | @strategist epic 提案（人類 gate） |
| 9 | `/athena:cycle` | Plan → approve → execute → reflect 完整循環 |
| 10 | `/athena:learn` | MEMORY.md accuracy refresh |

#### Memory & Context（3）
| # | Command | 簡述 |
|---|---|---|
| 11 | `/athena:load` | Session 啟動讀 context |
| 12 | `/athena:save` | 所有 agent checkpoint |
| 13 | `/athena:promote` | 升級 Tier 0 全球記憶 |

#### Operations（4）
| # | Command | 簡述 |
|---|---|---|
| 14 | `/athena:deploy` | 7-gate Zeabur 部署 |
| 15 | `/athena:dba` | 資料庫 admin（inspect / lint / diagnose migrations） |
| 16 | `/athena:domain` | Scaffold 新 domain module |
| 17 | `/athena:dashboard` | Pipeline 進度看板（read-only） |

#### Inspection & Audit（3）
| # | Command | 簡述 |
|---|---|---|
| 18 | `/athena:audit` | OpenAPI ↔ server ↔ client 三源一致性 |
| 19 | `/athena:metrics` | Agent 可靠度統計（從 audit.jsonl） |
| 20 | `/athena:qa-report` | Bug-to-Epic pipeline（從 bugfix-log.md） |

#### Pattern doc（not runnable）
| # | File | 用途 |
|---|---|---|
| — | `/athena:qa-enforcement-pattern` | Batch/loop QA gate 強制化 cross-project lesson |

### 19 個 Hook Script（全部 `scripts/hooks/*.sh`）

分四類觸發時機：

- **PreToolUse**（工具執行前攔截）：`pre-deploy-guard.sh` · `pre-openapi-drift-guard.sh`
- **PostToolUse**（工具執行後）：`post-test-coverage-gate.sh` · `post-bash-failure-inject.sh` · `bugfix-log-append.sh` · `auto-format.sh`（格式化）
- **Stop**（session 結束前把關）：`stop-verifier.sh`（18 rules，完整清單見 Hub 5）· `stop-notify.sh`
- **SessionStart / SubagentStop**：`session-start.sh`（context injection）· `subagent-stop-timestamp.sh`
- **其他 on-demand**：`worktree-setup.sh`（batch pipeline 準備）· `context-health-monitor.sh`（E145）· 等

完整 19 個：請 `ls scripts/hooks/*.sh`。

### Skill 分層

- **專案 skill**：`.claude/skills/`（本模板特有）
- **Plugin skill**：`athena:* / superpowers:* / devops:* / n8n-* / stripe / ecpay` 等（透過 plugin 安裝）
- **Tier 0 memory**：`~/.claude/template-memory/*.md`（**15 個** .md — `NEW_PROJECT_PRIMER` + 12 pattern files（anti-/architecture-/design-handoff/dx/failure/integration-gotchas/mockup-contract/performance/security/testing/workflow）+ 1 archive + 1 README）

### 數字驗證

跑 `scripts/visuals-mindmap-verify.sh` 檢查：

```bash
$ ./scripts/visuals-mindmap-verify.sh
agents:    10       commands:  20 (runnable: 20)       hooks:     19       stop-rules: 18
✅ All stats in sync.
```

若顯示 drift，跑 `--fix` 自動 patch HTML 中的 stats。

---

## 維護注意

- **本檔是 `agent-team-mindmap.html` 的文字鏡像**：改動一方時另一方要同步
- **若 agent / command 數量變動**（例：E163 加入 @designer 將 agent 數升到 11）：同步更新 TL;DR 表格 + Hub 2 表格 + CLAUDE.md + MEMORY.md
- **Stop verifier 規則數量**：Phase 40 landed 後 18 → 20，此檔 Hub 5 + HTML 的 Hook 節點都要更新
- **HTML 是渲染、md 是 context、`.claude/` 配置是程式**：md 用來讓 LLM 快速消化架構，不是人類閱讀首選（人類看 HTML 互動版較佳）
- **版本**：v1.0（2026-04-24 從 `.claude/agents/` + `.claude/commands/athena/` + `scripts/hooks/` + `docs/epics/EPIC_INDEX.md` distill 而成）
