---
title: "繁中 30 分鐘 Fork Onboarding"
audience: "Track B 模組包學員 + 想快速上手 ai-coding-nexjs-template 的工程師"
language: "繁體中文"
estimated_time: "30 分鐘"
last_updated: "2026-06-16"
---

# 繁中 30 分鐘 Fork Onboarding

> 從 fork 到 dashboard 跑起來，30 分鐘。**不需要先讀完 README**——跟著這份照做即可。
>
> 這是一套 **Next.js 16 SaaS 起手式**（App Router + React 19 + TypeScript + Tailwind v4 + shadcn/ui + Drizzle/Postgres + Auth.js v5 JWT + 3 階 RBAC）。fork 它 → 改成你自己的 SaaS。整個 app 都在 `next-app/`，**不需要 Python / FastAPI / Vite**。

## Pre-flight（5 分鐘）

確認本機環境：

- [ ] **Node.js 22+**（用 `node --version` 確認）
- [ ] **pnpm 9+**（沒裝跑 `npm install -g pnpm`）
- [ ] **Docker Desktop**（macOS / Windows）or Docker Engine + Compose v2（Linux）—— 本機 Postgres + Mailpit 用 Docker 跑
- [ ] **Make**（macOS / Linux 內建；Windows 需 WSL2 + make）
- [ ] **GitHub CLI**（建議，`brew install gh` or `winget install GitHub.cli`）

> 不需要 Python / uv / FastAPI——這套 stack 是純 Next.js full-stack（Server Components + Server Actions），DB 走 Drizzle ORM + postgres-js。

如有缺，去裝。15-30 分鐘準備時間。

## Step 1 — Fork（2 分鐘）

```bash
# 用 GitHub CLI（推薦）
gh repo fork cloud-f1/ai-coding-nexjs-template my-project

# 或在 GitHub web UI 按 Fork
# 然後 git clone 你 fork 的 repo
git clone https://github.com/<你的GitHub名>/my-project.git
cd my-project
```

## Step 2 — 一鍵本機初始化（5 分鐘）

第一次跑用 `make local-setup`——它會裝好依賴、用 Docker 起 Postgres + Mailpit、跑 migrations、seed demo 帳號：

```bash
make local-setup
```

`make local-setup` 會：

- 產生 `next-app/.env.local`（若不存在）
- 安裝 dependencies（`pnpm install`）
- 用 Docker 啟動 PostgreSQL + Mailpit container（會等 DB health）
- 跑 Drizzle migrations
- seed 3 個 demo 帳號（admin / editor / viewer）

如失敗常見原因：

- Docker daemon 沒開 → 開 Docker Desktop
- Port 5432 被佔（macOS Postgres.app 預設裝在 5432）→ `docker ps` 看誰佔，停掉，或改 `next-app/.env.local` 的連線埠
- pnpm 版本不對 → `npm install -g pnpm@9`

老實講第一次跑常常會卡其中一個——這是正常的，代表你正常人。慢慢來比較快。

> **更快的一鍵法**：如果你只想看它跑起來，也可以直接 `docker compose up --build -d`——一次把 Postgres + 遷移 + seed + web（含 Mailpit）全包，開 http://localhost:3000 即可。`make local-setup` + `make local` 的差別是：本機跑 Next.js dev server（hot reload 快），只有 DB / Mailpit 在 Docker。

## Step 3 — 啟動開發伺服器（1 分鐘）

```bash
make local
```

開：

- **App（Next.js）**：http://localhost:3000
- **Mailpit 信箱**（攔截寄出的驗證 / 重設密碼信）：http://localhost:8025

打開 http://localhost:3000 看到首頁，用 demo 帳號登入 = 成功：

| 角色 | 帳號 | 密碼 |
|------|------|------|
| admin | `admin@example.com` | `Admin123!` |
| editor | `editor@example.com` | `Editor123!` |
| viewer | `viewer@example.com` | `Viewer123!` |

> demo 登入按鈕由 `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` 控制（`next-app/.env.example` 預設 `false`）。本機要顯示一鍵 demo 登入就在 `.env.local` 設 `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true`。

## Step 4 — 客製 CLAUDE.md + 換品牌（5 分鐘）

打開根目錄的 `CLAUDE.md`，它有一段 **「Fork 後客製化提示」** 列出該改什麼。最少改這三塊：

### 4.1 What This Project Is

替換成你的專案描述（1-2 段）——否則 Claude session 會 follow 原作者的 project description。

### 4.2 Architecture Rules — NEVER DEVIATE

寫 3-7 條**你 codebase** 不能違反的 invariants。例：

```markdown
## Architecture Rules — NEVER DEVIATE

1. All DB writes go through Drizzle repository layer, never raw SQL in route handlers
2. Multi-tenant: every query MUST filter by tenant_id
3. Audit log: any write to {users, billing, contracts} must emit an event
```

> 預設的規則寫的是本 template 的慣例（Server Components 優先、`@/*` path alias、CRUD 走 modal、列表用 `<DataTable>`）。如果你的慣例不同，覆寫它。

### 4.3 環境變數 + File Layout

- 從 `next-app/.env.example` 複製需要的環境變數設定（`DATABASE_URL`、`AUTH_SECRET`、OAuth、demo 開關等）。
- 如果你之後改了目錄結構或 stack，順手更新 CLAUDE.md 的 File Layout 區塊。

Commit:

```bash
git add CLAUDE.md
git commit -m "feat(claude): customize CLAUDE.md for <your-project>"
```

## Step 5 — 跑第一個 epic（10 分鐘）

這套 template 的開發循環是 **epic-driven**：先用 `/athena:plan` 規劃，再用 `/athena:loop` 一步步推進（spec → implement → qa → commit）。在 repo root 啟動 Claude Code：

```bash
claude
```

然後在 Claude Code 內：

```
/athena:plan          # @strategist 分析 + 提 epic 提案（有 human 核准閘）
/athena:loop          # orchestrator：一次推進一個 step → 更新進度 → exit
```

`/athena:loop` 會自動把 step 派給對的 agent（`@spec-writer` 寫 spec、`@qa` / `@reviewer` 跑品質閘等）。想看狀態跑 `/athena:loop status`；想 cron 式自動駕駛跑 `/athena:batch auto`。

> 品質把關走 `/athena:qa`（`@reviewer` review + `@qa` 測試 + `@evaluator` 驗收），**沒有 `/athena:review` 這個命令**。

第一次跑 sub-agent 可能對你 codebase 不熟（system prompt 是 template 預設版）。沒關係，**這是 iteration 的事，不用想太多**——回去微調 `.claude/agents/best-practice.md`（或對應 agent）的 system prompt 第一段成你 stack。完整教學見 [`docs/guides/zh-TW/first-epic-walkthrough.md`](../guides/zh-TW/first-epic-walkthrough.md)。

## Step 6 — Track B 模組包學員下一步（依興趣）

如果你來自 Track B 模組包：

- **B2 Project Bootstrap module** → 你正在這 repo 上實作 P3 原理（CLAUDE.md as .gitignore）
- **B1 PR Review Pipeline module** → 這 repo `.claude/agents/reviewer.md` + `evaluator.md` + `qa.md` 對應 P5 三階驗證（編排命令是 `/athena:qa`）
- **B3 SaaS Ship Loop module** → 加 ship 相關命令時用 Cole Medin PRP pattern，對照 `/athena:spec` + `/athena:implement` + `/athena:ship`
- **B4 Team AI Adoption module** → 把這 repo 改成 team-shared monorepo 時參考 12 agents 結構

詳細模組對應見 [`track-b-integration.md`](track-b-integration.md)。

## Troubleshooting

### Q：`make local-setup` 卡在 "Installing dependencies..." 很久

A：通常是 pnpm registry 連線問題。試 `pnpm install --registry=https://registry.npmjs.org/`（在 `next-app/` 內）。或檢查 `.npmrc`。

### Q：Postgres container 啟動但 migration 失敗

A：`docker compose logs db`（或 `make docker-logs`）看 PostgreSQL log。常見：port 5432 已被另一個 PG instance 佔（macOS Postgres.app 預設裝在 5432），停掉系統 PG 或改 `next-app/.env.local` 的連線埠後重跑 `make local-db`。

### Q：登入後一直被踢回登入頁

A：這套用 Auth.js v5 Credentials，**必須用 JWT session 策略**（不是 DrizzleAdapter 預設的 DB session），且 RBAC guard 會**從 DB 重讀角色**。細節見 `nextjs-saas-patterns` skill。多半是 `AUTH_SECRET` 沒設或 session 策略被改掉。

### Q：在 Claude Code 跑 athena 命令沒反應

A：確認 Claude Code 已 install 且在 repo root 跑 `claude`。檢查 `.claude/commands/athena/` 下對應命令存在（例如 `loop.md`、`qa.md`、`plan.md`）。如沒有，你 fork 過程少帶到 `.claude/`，手動 `git checkout HEAD -- .claude/`。注意：**沒有 `/athena:review` 命令**，review / 品質閘走 `/athena:qa`。

### Q：跑起來後改 CLAUDE.md，Claude session 沒生效

A：CLAUDE.md 是 session 啟動時 load。重啟 `claude` CLI（exit + 再開）。

### Q：我不熟 Next.js，這 template 適合嗎？

A：適合。重點是 `.claude/` 的 agent + command + skill 結構 + epic-driven workflow——**P3 原理（CLAUDE.md as .gitignore）的具體展現**。Next.js 部分是現成可商用的 SaaS 底座，你照著 CLAUDE.md 的 Architecture Rules 寫，agent 會幫你守住慣例。

### Q：這 repo 跟 Cole Medin context-engineering-intro 差別？

A：兩個都是 Claude Code starter，互補關係：

- **Cole Medin** 教 PRP loop（Track B B3 用）— 偏 indie / SaaS feature ship
- **本 repo** 提供 mature Next.js SaaS stack + 12 agents + ~24 commands ecosystem — 偏 starter SaaS 起手式
- **建議**：本 repo 起步 → 加 Cole Medin PRP pattern 進你的 `.claude/commands/`

## 深入指南（維護中、與 code 同步）

這份 onboarding 帶你跑起來；更深的主題看 `docs/guides/`（en + 繁中雙語，跟著 code 一起維護）：

- [快速開始 quickstart](../guides/zh-TW/quickstart.md) — 最短上手路徑
- [第一個 epic 完整 walkthrough](../guides/zh-TW/first-epic-walkthrough.md) — `/athena:plan` → `/athena:loop` 全流程
- [AI Agent 團隊指南](../guides/zh-TW/ai-agent-team-guide.md) — 12 agents 怎麼分工
- [客製 agent](../guides/zh-TW/custom-agents.md) — 把 persona 改成你的 stack
- [部署指南](../guides/zh-TW/deploy-guide.md) — Zeabur（主）+ GCP Cloud Run（Road 2）
- 線上版 VitePress 文件：<https://ai-coding-nexjs-template-docs.pages.dev/>

## 下一步

- 看 [README.md 主要特色](../../README.md) 全套功能介紹
- 看 [docs/epics/EPIC_INDEX.md](../epics/EPIC_INDEX.md) 看本 repo 演化
- 加入 [Skool 工程師圈](https://www.skool.com/ai-brain-alex/about?ref=5dde9b20e8e7432aa9a01df6e89685f4)（Track B 學員 lifetime member 入場）

## 變更紀錄

| 版本 | 日期 | 變更內容 |
|---|---|---|
| 2.0 | 2026-06-16 | 改寫為 Next.js fork 流程（`make local-setup` / `make local`；移除 FastAPI/Vite/Python；review 路徑改 `/athena:qa`；交叉連結 `docs/guides/`） |
| 1.0 | 2026-04-28 | 初版（Track B Bundle 2 釋出） |
