---
title: "Track B 5 模組對應導讀 — 本 repo 是 Track B 的 reference codebase"
audience: "Track B 模組包學員 (founding 50 / standard / lifetime members)"
language: "繁體中文"
last_updated: "2026-04-28"
---

# Track B 5 模組對應導讀

> 本 repo 是 Track B Claude Agentic Coding 模組包的核心 reference codebase。對應 5 模組的具體 walkthrough。

## Overview

Track B 5 個模組（B1-B5）+ 6 個 cross-cutting principles（P1-P6）的具體 implementation 都在本 repo。讀 module 課程內容 + 看 repo 對應位置 = 你會看到「原理 + 落地」雙視角。

## B1 — PR Review Pipeline (P5 Plan-Code-Verify 三階驗證)

### 對應這 repo 的部分

```
.claude/agents/
├── best-practice.md          # P5 第一階 Plan reviewer（角色：senior best practice keeper）
├── evaluator.md              # P5 第二階 Code reviewer（角色：implementation 對齊 plan 評估者）
└── qa.md                     # P5 第三階 Verify reviewer（角色：跑 test + smoke check）

.claude/commands/athena/
└── review.md                 # /athena:review 命令 — 編排上述三個 sub-agent
```

### 怎麼學 B1

1. 讀 Track B B1 module（場景 → 原理 → 系統 → 交付物）
2. 看 `.claude/agents/best-practice.md` system prompt — 對照 P5 第一階「Plan stage」原理
3. 看 `.claude/commands/athena/review.md` — 對照 P5 三階 orchestration 邏輯
4. fork 後客製 sub-agent persona 成你 stack（fork 後完全你自己擁有，可商用）

### Walkthrough：本 repo 真實使用

本 repo Phase 40-42 的 PR 都用 `/athena:review` 跑過。看 `docs/epics/EPIC_INDEX.md` 找最近一個 PR，回看 `.claude/audit.jsonl` 中該 PR 的 review session 紀錄——你會看到三階 sub-agent 真實 review output。

## B2 — Project Bootstrap (P3 CLAUDE.md as .gitignore)

### 對應這 repo 的部分

整個 repo 結構就是 P3 原理的具體展現：

```
ai-coding-template/
├── CLAUDE.md                       # P3 第一層 — project-level instructions（131 lines）
├── TECHSTACK.md                    # CLAUDE.md 的 detail 補充
├── .claude/
│   ├── agents/                     # 11 個 agent — collective intelligence
│   ├── commands/athena/            # 21+ slash commands
│   ├── skills/                     # 8+ skills (auto-loaded context injectors)
│   ├── settings.json               # team-shared config
│   └── audit.jsonl                 # 跨 session audit trail
├── Makefile                        # `make init` / `make go` workflow standardization
├── docs/
│   ├── openapi.yaml                # SINGLE SOURCE OF TRUTH for types
│   ├── epics/                      # epic-driven development
│   ├── specs/                      # @spec-writer agent output
│   ├── context/                    # agent write-back memory
│   └── superpowers/specs/          # design specs
└── scripts/
    ├── hooks/                      # lifecycle hooks
    └── epic-graph.sh               # dependency graph parser
```

### 怎麼學 B2

1. 讀 Track B B2 module（場景：每次新專案重設 Claude）
2. 看本 repo 整個 folder 結構，理解每塊責任分配
3. fork 一份，客製 CLAUDE.md（保留結構 + 改 stack-specific invariants）
4. 跑 [`getting-started.md`](getting-started.md) 30 分鐘 onboarding

### Key insight

CLAUDE.md 的 ≤ 30KB 上限 + 三層分層（Global → User → Project）讓 context 持久化進 git，跨 session 不丟失。這就是 P3 原理。

## B3 — SaaS Ship Loop (P5 + Cole Medin Context Engineering / PRP loop)

### 對應這 repo 的部分

```
.claude/commands/athena/
├── plan.md                   # PRP-style planning command
├── execute.md                # /execute 對應 Cole Medin /execute-prp
└── ship.md                   # ship loop orchestration

docs/
├── specs/                    # @spec-writer 輸出（PRP 的本 repo 版本）
└── epics/                    # epic-driven development（PRP 升級到 epic 級別）
```

### 怎麼學 B3

1. 讀 Track B B3 module（場景：副業 SaaS 卡 6 個月）
2. 看本 repo `docs/specs/` 中任一 spec — 對照 Cole Medin PRP 結構（Context / Requirements / Verify）
3. 看 `.claude/commands/athena/plan.md` 和 `execute.md` 命令 anatomy
4. 套到你 own SaaS feature

### Cole Medin PRP fork

外部 reference：[Cole Medin context-engineering-intro](https://github.com/coleam00/context-engineering-intro)（原始 PRP 模式）。本 repo 的 spec / epic 系統是 PRP 的工程化升級版（更適合 production-grade development）。

## B4 — Team AI Adoption (P6 Skills + Plugins + Sub-agents 三位一體)

### 對應這 repo 的部分

```
.claude/agents/                # 11 agents — sub-agent 角色 collective intelligence
.claude/commands/athena/       # 21+ commands — 部門化 + reusable workflow（Skills 雛形）
.claude/skills/                # 8+ skills — auto-loaded context injectors
.claude/settings.json          # team-shared baseline
.claude/audit.jsonl            # observability + 量化基礎
scripts/hooks/                 # event-triggered automation
```

### 怎麼學 B4

1. 讀 Track B B4 module（場景：team 想用 AI 但沒人帶）
2. 看本 repo 11 個 agent 的角色分工（best-practice / dba / debugger / deployer / designer / domain-expert / evaluator / memory-curator / orchestrator / qa）
3. 看 21+ commands 的 namespace 設計（athena 命名空間）
4. 看 settings.json + audit.jsonl 怎麼支撐 team-level governance

### Key insight

P6 三件事（Skills + Plugins + Sub-agents）一起設計才形成 team collective intelligence stack。本 repo 是 mature 範例（Phase 40+ 演化）—— 學員看完知道 team-level config 長什麼樣。

## B5 — Content Factory (P3 + P4 Karpathy LLM Wiki)

### 不在這 repo

本 repo 是**SaaS codebase**，不是 content / knowledge factory。

B5 的 reference codebase 是 Alex 的 **content-asset-system** repo（不在 GitHub public），含 8 agents + 93 commands + 4 skills 跑 content pipeline。

### 為什麼分開

- **本 repo（ai-coding-template）** — SaaS feature build，B1-B4 reference
- **content-asset-system** — content / knowledge factory，B5 reference

兩個 repo 設計哲學不同：

- ai-coding-template：epic-driven development，feature ship 為主
- content-asset-system：consolidate-driven content management，atomic + MOC 為主

### 怎麼學 B5

1. 讀 Track B B5 module（場景：1000 筆記都忘了寫過什麼）
2. content-asset-system 結構在 B5 03-系統 lesson 完整拆解（給 Track B 模組包學員看）
3. 套到你 own content base（YouTube scripts / blog drafts / customer success knowledge）

## Cross-cutting Principles (P1-P6) 對應

6 個 principles 在本 repo 各自的具體展現：

| Principle | 在本 repo 哪裡看 |
|---|---|
| **P1** Project state ＞ one-shot prompt | CLAUDE.md + `.claude/skills/` auto-loading |
| **P2** Tier 分類 ＞ 摘要 | 不在這 repo（Track A A1 主場景）|
| **P3** CLAUDE.md as .gitignore | CLAUDE.md + `.claude/` folder structure（B2 主場景）|
| **P4** Atomic + Index + AI Lint | 不在這 repo（content-asset-system / B5 主場景）|
| **P5** Plan-Code-Verify 三階驗證 | `.claude/agents/{best-practice, evaluator, qa}.md`（B1 主場景）|
| **P6** Skills + Plugins + Sub-agents 三位一體 | 整個 `.claude/` 結構（B4 主場景）|

P2 + P4 不在本 repo（content / knowledge 主題），對應 Track A A1 / B5 module。

## 不在這 repo 的東西

Track B 模組包還包含這些**不在 ai-coding-template repo** 但在 Track B 課程內容中的東西：

- **Track A 一般人 mini course 內容**（A1 / A2 / A3）— 給非工程師的 Claude 教學
- **陪跑制 deliverables**（NT$50-80K/月）— 1-on-1 hands-on，不是 self-serve repo
- **Skool 工程師圈** — 月度 office hours + lifetime member channel + 月度新 Skill drop
- **Track B 模組包 sales page** — 在 ai-brain-alex.com 上線後可見
- **B5 reference repo (content-asset-system)** — 私有 repo，B5 module 內截圖對應 walkthrough

如要完整 Track B 體驗，連結 [Skool 工程師圈](https://www.skool.com/ai-brain-alex/about?ref=5dde9b20e8e7432aa9a01df6e89685f4)。

## 變更紀錄

| 版本 | 日期 | 變更內容 |
|---|---|---|
| 1.0 | 2026-04-28 | 初版（Track B Bundle 2 釋出，本 repo 鎖定為 lead magnet）|
