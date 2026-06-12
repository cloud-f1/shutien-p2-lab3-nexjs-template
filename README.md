# AI Coding Template

[![CI](https://github.com/cloud-f1/ai-coding-template/actions/workflows/ci.yml/badge.svg)](https://github.com/cloud-f1/ai-coding-template/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![Claude Code Optional](https://img.shields.io/badge/Claude_Code-Optional-blue?style=flat-square)
[![Track B 模組包](https://img.shields.io/badge/Track_B-模組包-orange?style=flat-square)](https://www.skool.com/ai-brain-alex/about?ref=5dde9b20e8e7432aa9a01df6e89685f4)
[![Star this repo](https://img.shields.io/github/stars/cloud-f1/ai-coding-template?style=social)](https://github.com/cloud-f1/ai-coding-template/stargazers)

一套即開即用的全端 SaaS 起手式。內建認證、主題系統、測試框架、CI/CD — 搭配 Claude Code 可解鎖 AI Agent 團隊自動開發（含並行管線），不用也能當獨立 SaaS 模板使用。

A production-ready full-stack SaaS starter. Built-in auth, theming, tests, CI/CD — optionally unlock an AI agent team with parallel pipeline for automated development with Claude Code.

繁體中文 | [English](#english)

<p align="center">
  <img src="docs/assets/dashboard-preview.svg" alt="Dashboard Preview" width="720" />
</p>

---

## 快速開始

```bash
git clone https://github.com/cloud-f1/ai-coding-template.git && cd ai-coding-template
make init      # 一鍵初始化：重置模板 → 自訂專案 → 安裝依賴 → 啟動 DB → 遷移（僅需執行一次）
make go        # 啟動開發伺服器
open http://localhost:5173/getting-started
```

> 首次使用？`make init` 會引導你完成專案命名、資料庫命名、主題選擇、依賴安裝，並自動啟動 PostgreSQL、執行遷移。設定會儲存在 `.build-manifest.yaml`。完成後用 `make go` 啟動開發。遇到問題？執行 `make doctor` 檢查環境健康狀態。

---

## 功能總覽

<details>
<summary><b>認證系統</b> — JWT + OAuth + Refresh Token Rotation</summary>

- fastapi-users 驅動，支援 Google / GitHub OAuth
- JWT access + refresh token，自動輪換
- 電子郵件驗證、忘記密碼完整流程

</details>

<details>
<summary><b>前端</b> — React 18 + TypeScript + Vite</summary>

- 4 主題系統（dark / indigo / navy / sage）+ WCAG 2.1 AA
- React Query 4 層快取策略（STATIC / SEMI / SECURITY / REALTIME）
- `createService()` 工廠模式 + Zod 型別校驗

</details>

<details>
<summary><b>後端</b> — FastAPI + SQLAlchemy 2.x async + PostgreSQL</summary>

- Domain Registry 模組化架構 — 刪除目錄即移除功能
- Spec-Driven Development：OpenAPI spec 為唯一真實來源
- Alembic 自動遷移 + 完整 CRUD 樣板

</details>

<details>
<summary><b>開發工具鏈</b> — 測試、CI、部署一站式</summary>

- 80% 測試覆蓋率門檻（client Vitest / server pytest）
- GitHub Actions CI + Zeabur 一鍵部署
- Interactive Site Builder CLI：`pnpm new-site`
- Domain Generator：`/athena:domain <name>`

</details>

---

## 有沒有 Claude Code 都能用

| | 不使用 Claude Code | 搭配 Claude Code |
|---|---|---|
| **SaaS 模板** | 完整的全端起手式、認證、主題、CI/CD | 相同 |
| **開發方式** | 手動寫 code、手動跑測試 | AI Agent 團隊自動化開發 |
| **指令系統** | 不適用 | 17 個 Athena 指令（含並行批次） |
| **品質把關** | 手動 review + 測試 | @qa Agent 自動審查 + 8 條 stop verifier 規則 |
| **觀測性** | 不適用 | Webhook 通知 + JSONL 審計日誌 |

---

## 給 Track B 模組包學員

如果你從 Alex 的 [Claude Agentic Coding 模組包](https://www.skool.com/ai-brain-alex/about?ref=5dde9b20e8e7432aa9a01df6e89685f4) 來——歡迎。本 repo 是 **Track B B2 (Project Bootstrap)** 模組的核心 reference codebase。

### 你會在這 repo 看到什麼

對應 Track B 5 模組的 reference materials：

| Track B 模組 | 對應這 repo 的內容 |
|---|---|
| **B1** PR Review Pipeline (P5 三階驗證) | `.claude/agents/best-practice.md` + `evaluator.md` + `qa.md` + `.claude/commands/athena/` review 命令 |
| **B2** Project Bootstrap (P3 CLAUDE.md as .gitignore) | 整個 repo 結構就是 P3 原理的具體展現 |
| **B3** SaaS Ship Loop (P5 + Cole Medin PRP) | `.claude/commands/athena/` ship-related 命令 + epic-driven dev workflow |
| **B4** Team AI Adoption (P6 三位一體) | 11 agents + 21+ commands + 8+ skills 的部門化結構 |
| **B5** Content Factory (P3 + P4 Karpathy LLM Wiki) | 不在這 repo（content-asset-system 自身為 B5 教材） |

### Fork 後 30 分鐘上手

詳細步驟見 [`docs/zh-tw/getting-started.md`](docs/zh-tw/getting-started.md)。摘要：

1. `gh repo fork cloud-f1/ai-coding-template my-project`
2. 客製 `CLAUDE.md`（你的 stack + Architecture Invariants）
3. 客製 `.claude/agents/` 5 個關鍵 agent persona
4. 跑 `make init && make go`
5. 開第一個 PR → 跑 `/athena:review` 驗證 sub-agent pipeline

詳細 Track B 5 模組對應導讀：[`docs/zh-tw/track-b-integration.md`](docs/zh-tw/track-b-integration.md)。

### 進階學習路徑

- **完整 Track B 模組包**（NT$6,800 founding member, 限 50 名 / NT$9,800 standard）→ [Skool 工程師圈](https://www.skool.com/ai-brain-alex/about?ref=5dde9b20e8e7432aa9a01df6e89685f4)
- **1-on-1 陪跑制**（NT$50-80K/月, 限量 2 位/月, founding 優先）→ Track B sales page 詢問表單
- **Track A 一般人 mini courses**（NT$999/支 × 3 / NT$2,400 套裝）→ 非工程師同事可看

### 不是 Track B 學員也歡迎用

本 repo 完整功能 free + MIT 授權 + 可商用。Track B 學員只是有額外的學習路徑（課程 + 陪跑），不影響本 repo 自身價值。

---

## AI Agent 團隊（搭配 Claude Code）

### 序列模式 — 一次一個 Epic

```bash
/athena:loop              # 推進一步
/loop 2m /athena:loop     # 每 2 分鐘自動推進
```

### 並行模式 — 多個 Epic 同時執行

```bash
/athena:batch auto                   # 自動偵測 Phase，每次跑一波次
/loop 2m /athena:batch auto          # 並行自動駕駛（推薦）
/athena:batch --phase 25             # 手動指定 Phase（跑所有波次）
```

**並行原理**：解析依賴圖 → 拓撲排序 → 分波次派遣 worktree agent → 波次間合併

### 觀測性

```bash
# Webhook 通知 — 依 URL host 自動判斷格式（Slack / Telegram / Discord / 通用）
export AI_CODING_WEBHOOK_URL="https://hooks.slack.com/services/..."           # Slack
# export AI_CODING_WEBHOOK_URL="https://api.telegram.org/bot<TOKEN>/sendMessage"  # Telegram（需另設 TELEGRAM_CHAT_ID）
# export NOTIFY_LEVEL="boundaries"  # silent | boundaries（預設）| verbose

# 審計日誌查詢
jq 'select(.exit != 0)' .claude/audit.jsonl     # 失敗命令
jq 'select(.epic == "E84")' .claude/audit.jsonl  # 特定 Epic

# 依賴圖工具
./scripts/epic-graph.sh --phase 25 --classify    # 波次 + 層級
```

> 完整指南：[AI Agent 團隊使用指南](docs/guides/zh-TW/ai-agent-team-guide.md) ｜ [AI Agent Team Guide](docs/guides/en/ai-agent-team-guide.md)

---

## 部署

| 環境 | 前端 | API | GCR |
|------|------|-----|-----|
| Dev | `dev-coding-template.zeabur.app` | `dev-coding-template-api.zeabur.app` | `dev-app/ai-coding-template-*:dev` |
| Prd | `coding-template.zeabur.app` | `coding-template-api.zeabur.app` | `prd-app/ai-coding-template-*:prd` |

- **GCR Registry**: `asia-east1-docker.pkg.dev/common-411213`
- **Zeabur Template**: [N8Y5Q5](https://zeabur.com/templates/N8Y5Q5)
- **CI**: GitHub Actions — push to `main`/`prd` → path-filtered Docker build → GCR

→ [部署完整教學](docs/guides/zh-TW/deploy-walkthrough.md) ｜ [Deploy Walkthrough](docs/guides/en/deploy-walkthrough.md) ｜ [Deploy README](deploy/README.md)

---

## 文件導覽

| 文件 | 說明 |
|------|------|
| [PRD 產品需求文件](docs/PRD.md) | 完整功能清單、架構、路線圖 |
| [快速上手指南](docs/guides/zh-TW/quickstart.md) | 從零開始的完整設定步驟 |
| [第一個 Epic 教學](docs/guides/zh-TW/first-epic-walkthrough.md) | 手把手帶你完成第一個 Epic |
| [TECHSTACK.md](TECHSTACK.md) | 完整技術架構文件 |
| [AI Agent 團隊指南](docs/guides/zh-TW/ai-agent-team-guide.md) | 序列/並行模式、指令速查、觀測性 |
| [腦力激盪優先工作流程](docs/guides/zh-TW/brainstorm-first.md) | 使用 `/athena:plan brainstorm` 在撰寫程式碼前精煉功能想法 |
| [學習路徑](docs/guides/zh-TW/learning-path.md) | 所有指南的推薦閱讀順序（入門 → 中級 → 進階） |
| [Agent 代理](docs/reference/agents.md) | 9 個 AI Agent 詳細說明 |
| [Athena 指令](docs/reference/commands.md) | 17 個指令完整參考 |
| [並行管線策略](docs/reference/parallel-pipeline-strategy.md) | 並行 Epic 執行策略與架構 |
| [技能模組](docs/reference/skills.md) | 8 個自動載入的上下文注入器 |
| [Epic 進度](docs/epics/EPIC_INDEX.md) | 所有 Epic 的開發進度追蹤 |

---

## 貢獻

歡迎貢獻！請參閱 [CONTRIBUTING.md](CONTRIBUTING.md) 了解分支策略、Commit 慣例與 PR 流程。

## 授權

[MIT License](LICENSE) - Copyright (c) 2026 cloud-f1

---

## English

A production-ready full-stack SaaS starter kit. Built-in authentication, theming, test framework, and CI/CD pipeline. Optionally pair with Claude Code to unlock an AI agent team with parallel pipeline for automated spec-driven development.

### Quick Start

```bash
git clone https://github.com/cloud-f1/ai-coding-template.git && cd ai-coding-template
make init      # One-time setup: reset template → customize project → install deps → start DB → migrate
make go        # Start dev servers
open http://localhost:5173/getting-started
```

> First time? `make init` walks you through project naming, database naming, theme selection, and dependency installation. It automatically starts PostgreSQL and runs migrations. Config is saved to `.build-manifest.yaml`. Then use `make go` to start developing. Having trouble? Run `make doctor` to check your environment.

### What's Included

<details>
<summary><b>Authentication</b> — JWT + OAuth + Refresh Token Rotation</summary>

- Powered by fastapi-users with Google / GitHub OAuth
- JWT access + refresh tokens with automatic rotation
- Email verification and password reset flows

</details>

<details>
<summary><b>Frontend</b> — React 18 + TypeScript + Vite</summary>

- 4 themes (dark / indigo / navy / sage) + WCAG 2.1 AA accessibility
- React Query 4-tier cache strategy (STATIC / SEMI / SECURITY / REALTIME)
- `createService()` factory pattern + Zod schema validation

</details>

<details>
<summary><b>Backend</b> — FastAPI + SQLAlchemy 2.x async + PostgreSQL</summary>

- Domain Registry modular architecture — remove a directory to remove a feature
- Spec-Driven Development: OpenAPI spec as single source of truth
- Alembic auto-migration + full CRUD scaffolding

</details>

<details>
<summary><b>Developer Toolchain</b> — Testing, CI, Deployment</summary>

- 80% coverage gate (client Vitest / server pytest)
- GitHub Actions CI + Zeabur one-click deploy
- Interactive Site Builder CLI: `pnpm new-site`
- Domain Generator: `/athena:domain <name>`

</details>

### With or Without Claude Code

| | Without Claude Code | With Claude Code |
|---|---|---|
| **SaaS Template** | Full-stack starter, auth, themes, CI/CD | Same |
| **Development** | Write code and run tests manually | AI agent team automates the workflow |
| **Commands** | N/A | 17 Athena commands (including parallel batch) |
| **Quality** | Manual review + testing | @qa agent + 8 stop verifier rules |
| **Observability** | N/A | Webhook notifications + JSONL audit log |

### AI Agent Team (with Claude Code)

**Serial mode** — one epic at a time:
```bash
/athena:loop              # advance one step
/loop 2m /athena:loop     # auto-advance every 2 min
```

**Parallel mode** — multiple epics simultaneously:
```bash
/athena:batch auto                   # auto-detect phase, one wave per call
/loop 2m /athena:batch auto          # parallel auto-pilot (recommended)
/athena:batch --phase 25             # manual: run all waves in phase
```

**Observability**:
```bash
# Notifications — auto-detects Slack / Telegram / Discord / generic from URL host
export AI_CODING_WEBHOOK_URL="https://hooks.slack.com/services/..."           # Slack
# export AI_CODING_WEBHOOK_URL="https://api.telegram.org/bot<TOKEN>/sendMessage"  # Telegram (also set TELEGRAM_CHAT_ID)
# export NOTIFY_LEVEL="boundaries"  # silent | boundaries (default) | verbose
jq 'select(.exit != 0)' .claude/audit.jsonl                 # failed commands
./scripts/epic-graph.sh --phase 25 --classify                # dependency waves
```

> **Guides:** [AI Agent Team Guide](docs/guides/en/ai-agent-team-guide.md) ｜ [AI Agent 團隊指南](docs/guides/zh-TW/ai-agent-team-guide.md)
> **Without Claude Code:** [English](docs/guides/en/without-claude-code.md) ｜ [繁體中文](docs/guides/zh-TW/without-claude-code.md)

### Deploy

| Env | Client | API | GCR |
|-----|--------|-----|-----|
| Dev | `dev-coding-template.zeabur.app` | `dev-coding-template-api.zeabur.app` | `dev-app/ai-coding-template-*:dev` |
| Prd | `coding-template.zeabur.app` | `coding-template-api.zeabur.app` | `prd-app/ai-coding-template-*:prd` |

- **GCR Registry**: `asia-east1-docker.pkg.dev/common-411213`
- **Zeabur Template**: [N8Y5Q5](https://zeabur.com/templates/N8Y5Q5)
- **CI**: GitHub Actions — push to `main`/`prd` → path-filtered Docker build → GCR

→ [Deploy Walkthrough](docs/guides/en/deploy-walkthrough.md) | [部署完整教學](docs/guides/zh-TW/deploy-walkthrough.md) | [Deploy README](deploy/README.md)

### Documentation

| Document | Description |
|----------|-------------|
| [PRD](docs/PRD.md) | Full feature list, architecture, roadmap |
| [Quickstart Guide](docs/guides/en/quickstart.md) | Complete setup from scratch |
| [First Epic Walkthrough](docs/guides/en/first-epic-walkthrough.md) | Step-by-step first Epic tutorial |
| [TECHSTACK.md](TECHSTACK.md) | Full technical architecture |
| [AI Agent Team Guide](docs/guides/en/ai-agent-team-guide.md) | Serial/parallel modes, command reference, observability |
| [Brainstorm-First Workflow](docs/guides/en/brainstorm-first.md) | Use `/athena:plan brainstorm` to refine a feature idea before writing code |
| [Learning Path](docs/guides/en/learning-path.md) | Recommended reading order for all guides (beginner to advanced) |
| [Agents](docs/reference/agents.md) | 9 AI agent reference |
| [Commands](docs/reference/commands.md) | 17 Athena command reference |
| [Parallel Pipeline Strategy](docs/reference/parallel-pipeline-strategy.md) | Parallel epic execution architecture |
| [Skills](docs/reference/skills.md) | 8 auto-loaded context injectors |
| [Epic Progress](docs/epics/EPIC_INDEX.md) | Development progress tracking |

### Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for branch strategy, commit conventions, and PR flow.

### License

[MIT License](LICENSE) - Copyright (c) 2026 cloud-f1
