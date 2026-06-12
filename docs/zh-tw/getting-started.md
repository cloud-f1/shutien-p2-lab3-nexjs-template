---
title: "繁中 30 分鐘 Fork Onboarding"
audience: "Track B 模組包學員 + 想快速上手 ai-coding-template 的工程師"
language: "繁體中文"
estimated_time: "30 分鐘"
last_updated: "2026-04-28"
---

# 繁中 30 分鐘 Fork Onboarding

> 從 fork 到 dashboard 跑起來，30 分鐘。**不需要先讀完 README**——跟著這份照做即可。

## Pre-flight（5 分鐘）

確認本機環境：

- [ ] **Node.js 22+**（用 `node --version` 確認）
- [ ] **Python 3.12+**（`python3 --version`）
- [ ] **Docker Desktop**（macOS / Windows）or Docker Engine + Compose v2（Linux）
- [ ] **pnpm 9+**（沒裝跑 `npm install -g pnpm`）
- [ ] **Make**（macOS / Linux 內建；Windows 需 WSL2 + make）
- [ ] **GitHub CLI**（建議，`brew install gh` or `winget install GitHub.cli`）

如有缺，去裝。15-30 分鐘準備時間。

## Step 1 — Fork（2 分鐘）

```bash
# 用 GitHub CLI（推薦）
gh repo fork cloud-f1/ai-coding-template my-saas-project

# 或在 GitHub web UI 按 Fork
# 然後 git clone 你 fork 的 repo
git clone https://github.com/<你的GitHub名>/my-saas-project.git
cd my-saas-project
```

## Step 2 — 一鍵初始化（5 分鐘）

```bash
make init
```

`make init` 互動式問你：

- 專案命名（替換 `ai-coding-template` 預設）
- DB 命名
- 主題選擇（5 個 preset 可選）
- Confirm 安裝

跑完會：

- 重置 template 預設值
- 安裝 dependencies (`pnpm install` + `uv sync`)
- 啟動 PostgreSQL container
- 跑 migrations
- 設定 `.build-manifest.yaml`

如失敗常見原因：

- Docker daemon 沒開 → 開 Docker Desktop
- Port 5432 被佔（macOS Postgres.app 預設裝在 5432）→ `docker ps` 看誰佔，停掉
- pnpm 版本不對 → `npm install -g pnpm@9`

老實講第一次跑常常會卡其中一個——這是正常的，代表你正常人。慢慢來比較快。

## Step 3 — 啟動開發伺服器（1 分鐘）

```bash
make go
```

開：

- 後端（FastAPI）：http://localhost:8000/docs
- 前端（React）：http://localhost:5173

打開 http://localhost:5173/getting-started 看到歡迎頁 = 成功。

## Step 4 — 客製 CLAUDE.md（5 分鐘）

打開 `CLAUDE.md`，改：

### 4.1 Project Overview

替換成你的專案描述（1-2 段）。

### 4.2 Architecture Rules — NEVER DEVIATE

寫 3-7 條你 codebase 不能違反的 invariants。例：

```markdown
## Architecture Rules — NEVER DEVIATE

1. All DB writes go through repository layer, never direct ORM access
2. Multi-tenant: every query MUST filter by tenant_id
3. Audit log: any write to {users, billing, contracts} must emit event
```

### 4.3 File Layout

如果你不用 React + FastAPI，改 stack 區塊。

Commit:

```bash
git add CLAUDE.md
git commit -m "feat(claude): customize CLAUDE.md for <your-project>"
```

## Step 5 — 跑第一次 `/athena:review`（10 分鐘）

開個小 PR 測 sub-agent pipeline：

```bash
git checkout -b feature/first-touch
# 改一個小東西，例如 README typo
git commit -am "fix typo"
git push -u origin feature/first-touch
gh pr create --fill
```

PR 開出來後，在 Claude Code 跑：

```
/athena:review $(gh pr view --json url -q .url)
```

`/athena:review` 會 spawn 多個 sub-agent 各自看 plan / code / verify 三階。

第一次跑 sub-agent 可能對你 codebase 不熟（system prompt 是 generic 版）。沒關係，**這是 iteration 的事，不用想太多**——回去微調 `.claude/agents/best-practice.md` 的 system prompt 第一段成你 stack。

## Step 6 — Track B 模組包學員下一步（依興趣）

如果你來自 Track B 模組包：

- **B2 Project Bootstrap module** → 你正在這 repo 上實作 P3 原理（CLAUDE.md as .gitignore）
- **B1 PR Review Pipeline module** → 這 repo `.claude/agents/best-practice.md` + `evaluator.md` + `qa.md` 對應 P5 三階驗證
- **B3 SaaS Ship Loop module** → 加 ship 相關命令時用 Cole Medin PRP pattern
- **B4 Team AI Adoption module** → 把這 repo 改成 team-shared monorepo 時參考 11 agents 結構

詳細模組對應見 [`track-b-integration.md`](track-b-integration.md)。

## Troubleshooting

### Q：`make init` 卡在 "Installing dependencies..." 30 分鐘以上

A：通常是 pnpm registry 連線問題。試 `pnpm install --registry=https://registry.npmjs.org/`。或檢查 `.npmrc`。

### Q：Postgres container 啟動但 migration 失敗

A：`docker compose logs db` 看 PostgreSQL log。常見：port 5432 已被另一個 PG instance 佔（macOS Postgres.app 預設裝在 5432），改 `.env.local` 的 `DB_PORT` 或停掉系統 PG。

### Q：`/athena:review` 在 Claude Code 沒反應

A：確認 Claude Code 已 install 且在 repo root 跑 `claude` 命令。檢查 `.claude/commands/athena/` 對應 review 命令存在。如沒有，你 fork 過程少帶到 `.claude/`，手動 `git checkout HEAD -- .claude/`。

### Q：跑起來後改 CLAUDE.md，Claude session 沒生效

A：CLAUDE.md 是 session 啟動時 load。重啟 `claude` CLI（exit + 再開）。

### Q：我不是 React / FastAPI 工程師，這 template 適合嗎？

A：適合。Stack 部分（React + FastAPI）是可替換的——你可以拿 `.claude/` 結構 + Makefile pattern 改成 Vue / Django / Rails / 其他。**重點不是 stack，是 P3 原理（CLAUDE.md as .gitignore）的具體展現**。

### Q：這 repo 跟 Cole Medin context-engineering-intro 差別？

A：兩個都是 Claude Code starter，互補關係：

- **Cole Medin** 教 PRP loop（Track B B3 用）— 偏 indie / SaaS feature ship
- **本 repo** 提供 mature SaaS stack + 11 agents + 21+ commands ecosystem — 偏 starter SaaS 起手式
- **建議**：本 repo 起步 → 加 Cole Medin PRP pattern 進你的 `.claude/commands/`

## 下一步

- 看 [README.md 主要特色](../../README.md) 全套功能介紹
- 看 [TECHSTACK.md](../../TECHSTACK.md) 架構詳解
- 看 [docs/epics/EPIC_INDEX.md](../epics/EPIC_INDEX.md) 看本 repo 演化（會看到 Phase 40-42 是怎麼做的）
- 加入 [Skool 工程師圈](https://www.skool.com/ai-brain-alex/about?ref=5dde9b20e8e7432aa9a01df6e89685f4)（Track B 學員 lifetime member 入場）

## 變更紀錄

| 版本 | 日期 | 變更內容 |
|---|---|---|
| 1.0 | 2026-04-28 | 初版（Track B Bundle 2 釋出） |
