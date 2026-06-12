# E29 — CLAUDE.md + TECHSTACK.md 模板化

> **Size**: S (~0.5 session) | **Depends on**: E22 (domain structure)
> **Status**: spec

---

## 問題陳述

`CLAUDE.md` 和 `TECHSTACK.md` 是 Claude Code 每次 session 自動載入的核心文件，但目前包含大量 domain-specific 硬編碼內容：

| 檔案 | 硬編碼內容 | 影響 |
|------|-----------|------|
| `CLAUDE.md` L10 | `"Full-stack investment tracker"` | 新專案描述不正確 |
| `TECHSTACK.md` L65-68 | Cache tier 範例：`Holdings, watchlists, Prices, live data` | 暗示特定業務邏輯 |
| `TECHSTACK.md` L72-76 | Core Tables 包含 `social_accounts` 等固定表 | 混淆核心 vs 範例 |
| `TECHSTACK.md` L90-95 | Track Roadmap：`Place Intelligence, Investment Portfolio` | 專案特定路線圖 |
| `docs/techstack/architecture.md` L26 | `PostgreSQL 15 + PostGIS (Track 2)` | 假設使用 PostGIS |
| `docs/techstack/agents-memory.md` L62-64 | Track 2/3 domain-specific 描述 | 專案特定路線圖 |
| `docs/techstack/ai-dev-pipeline.md` L35,43 | `portfolio holdings` 範例指令 | 假設 portfolio domain |

使用者透過 E21 CLI 建立新專案後，這些檔案仍然殘留舊 domain 的語境，造成 AI session 被錯誤的上下文污染。

## 解決方案

1. 在 `CLAUDE.md` 和 `TECHSTACK.md` 中插入 `{{VARIABLE}}` 佔位符（沿用 E21/E23 慣例）
2. 將 domain-specific 內容替換為通用描述或佔位符
3. 在 E21 scaffold.ts 的 `TEMPLATE_FILES` 和 `buildReplacements()` 中新增對應處理
4. 提供 `.tmpl` 參考版本作為「乾淨起點」文件

---

## 範圍界定

### 在範圍內

- `CLAUDE.md` — 插入 `{{PROJECT_DESCRIPTION}}` 佔位符
- `TECHSTACK.md` — 移除 domain-specific 範例，改為通用佔位符
- `docs/techstack/*.md` — 移除 domain-specific 硬編碼（PostGIS、Track 2/3、portfolio 範例）
- `scripts/new-site/scaffold.ts` — 擴展 `TEMPLATE_FILES` 列表 + `buildReplacements()`
- `docs/templates/scaffold/` — 新增 `.tmpl` 參考檔案

### 不在範圍內

- Epic specs (`docs/epics/e*.md`) — 這些是歷史紀錄，不需模板化
- `docs/context/` — agent 產出，每個專案獨立
- Domain 模板 (`docs/templates/domain/`) — 已在 E23 處理

---

## 變更清單

### 1. CLAUDE.md — 模板變數插入

**現行內容 (L10)**:
```
Full-stack investment tracker. FastAPI server + React client + PostgreSQL.
```

**改為**:
```
{{PROJECT_DESCRIPTION}}
```

E21 CLI 已有 `{{PROJECT_DESCRIPTION}}` 替換邏輯，且 `CLAUDE.md` 已在 `TEMPLATE_FILES` 列表中（scaffold.ts L42）。只需將硬編碼文字改為佔位符。

### 2. TECHSTACK.md — 移除 domain-specific 內容

#### 2a. Cache Tiers 表格（L63-68）

**現行**:
```
| STATIC | 1 hr | User profile, places, settings |
| SEMI_DYNAMIC | 15 min | Holdings, watchlists |
| SECURITY | 5 min | Sessions, auth state |
| REALTIME | 1 min | Prices, live data |
```

**改為**:
```
| STATIC | 1 hr | User profile, settings |
| SEMI_DYNAMIC | 15 min | Domain list data |
| SECURITY | 5 min | Sessions, auth state |
| REALTIME | 1 min | Live updates |
```

#### 2b. Core Tables（L72-76）

保留 `users` 和 `sessions`（核心 auth），移除業務表：

**改為**:
```
users          UUID PK, email, password_hash (nullable for social), is_verified
sessions       UUID PK, user_id FK, refresh_token_hash, expires_at
social_accounts UUID PK, user_id FK, provider, provider_user_id
# Domain tables are auto-discovered from server/app/domains/
```

#### 2c. Track Roadmap（L89-96）

**現行**:
```
### Track Roadmap
| Track 1 | Auth & Identity Core | In Progress |
| Track 2 | Place Intelligence + PostGIS | Planned |
| Track 3 | Investment Portfolio | Planned |
```

**改為**:
```
### Domain Architecture
| Layer | Content | Status |
| Auth & Identity | users, sessions, JWT, OAuth | Built-in |
| Domain Modules | Auto-discovered from server/app/domains/ | Customizable |
```

#### 2d. 新增 `TEMPLATE_FILES` 登錄

在 scaffold.ts `TEMPLATE_FILES` 中新增 `TECHSTACK.md`：

```typescript
const TEMPLATE_FILES = [
  "package.json",
  "pyproject.toml",
  "docker-compose.yml",
  "CLAUDE.md",
  "TECHSTACK.md",  // NEW
];
```

### 3. docs/techstack/ 子檔案 — 通用化

#### 3a. `architecture.md` L26

**現行**: `PostgreSQL 15 + PostGIS (Track 2)`
**改為**: `PostgreSQL 15 + extensions as needed`

#### 3b. `agents-memory.md` L60-66

**現行**: Track 1/2/3 domain-specific 描述
**改為**:
```
| Layer | Content | Status |
| Auth & Identity | users, sessions, JWT, OAuth | Built-in |
| Domain Modules | Auto-discovered from server/app/domains/ | Customizable |
```

#### 3c. `ai-dev-pipeline.md` L35, L43

**現行**: `/athena:spec "add portfolio holdings"`, `/athena:implement portfolio-holdings`
**改為**: `/athena:spec "add task comments"`, `/athena:implement task-comments`

### 4. buildReplacements() 擴展

目前 `buildReplacements()` 已包含：
- `{{PROJECT_SLUG}}`
- `{{PROJECT_DISPLAY}}`
- `{{PROJECT_DESCRIPTION}}`
- `{{DB_NAME}}`
- `{{AUTHOR}}`
- `{{DEFAULT_THEME}}`

不需要新增變數 — `{{PROJECT_DESCRIPTION}}` 已涵蓋 CLAUDE.md 的需求。TECHSTACK.md 的修改是移除硬編碼內容（非變數替換）。

### 5. .tmpl 參考檔案

新增 `docs/templates/scaffold/` 目錄，放置乾淨起點版本：

```
docs/templates/scaffold/
  CLAUDE.md.tmpl          # 使用 {{PROJECT_DESCRIPTION}} 的乾淨版本
  TECHSTACK.md.tmpl       # Domain-neutral 版本
```

這些 `.tmpl` 檔案**不是**自動套用的模板，而是參考文件。用途：
- 新使用者可以參考「乾淨起點」的結構
- E31（Template Distribution）可以直接使用這些檔案
- 文件化模板化的期望格式

---

## CLAUDE.md.tmpl 內容

```markdown
# {{PROJECT_DISPLAY}} — Claude Code Session Identity

> **Auto-loaded every session.** Keep under 100 lines.
> Full architecture → `TECHSTACK.md` | Last state → `docs/context/session-summary.md`

---

## What This Project Is

{{PROJECT_DESCRIPTION}}
Epic-driven development — see `docs/epics/EPIC_INDEX.md` for all progress.

## File Layout

\```
server/              FastAPI + PostgreSQL (Python 3.12)
client/              React 18 + TypeScript + Vite
docs/
  openapi.yaml       API contract — SINGLE SOURCE OF TRUTH for all types
  epics/             EPIC_INDEX.md — single source of dev progress
  specs/             Feature specs (@spec-writer output) — see specs/CLAUDE.md
  context/           Agent write-back memory — see context/CLAUDE.md
scripts/hooks/       Lifecycle hooks — see hooks/CLAUDE.md
.claude/agents/      Agent definitions (YAML frontmatter + instructions)
.claude/commands/athena/  Slash commands (athena namespace)
.claude/skills/          Auto-loaded context injectors
\```

## Architecture Rules — NEVER DEVIATE

- `openapi.yaml` edited **FIRST** — never write server/client code before the spec
- `server/`: stateless JWT auth — no custom auth code
- `client/`: access token in `tokenCache.ts` (in-memory) — never localStorage
- React Query: tiers from `cacheConfig.ts` — never hardcode staleTime inline
- Folder names: `server/` and `client/` — never `backend/` or `frontend/`

## Testing Rules

- `asyncio_mode = auto` in `pyproject.toml` — no `@pytest.mark.asyncio` needed
- Client tests: `userEvent` not `fireEvent`, MSW handlers in `src/tests/handlers/`
- Coverage gate: **>=80%** both suites — blocks deploy if below

## Deployment

- Platform: Zeabur — server + client as separate services, each with `zbpack.json`
- Migrations on startup: `alembic upgrade head && uvicorn ...`
- `VITE_API_URL` baked at **build time** — set in Zeabur before client build

## Active Epic

See `docs/epics/EPIC_INDEX.md` for current phase and next action.
Run `/athena:loop` to advance, or `/athena:loop status` to check state.

## Agent Team

\```
@spec-writer      — /athena:spec: new feature or endpoint design
@qa               — /athena:qa: security review + test suite + 80% gate
@best-practice    — architecture questions, trade-off decisions
@debugger         — errors, failing tests (auto-delegated)
@deployer         — /athena:deploy: deploy protocol, Zeabur
@memory-curator   — /athena:promote: extract wisdom to Tier 0
\```

## Memory System

\```
Tier 0 (global):  ~/.claude/template-memory/   cross-project wisdom
Tier 1 (project): docs/context/                this project's state

"Update your document" → agent writes to its designated doc
/athena:save           → all agents checkpoint simultaneously
/athena:promote        → @memory-curator extracts lessons → Tier 0
\```
```

---

## E21 CLI 整合

### 現行流程（不變）

E21 scaffold.ts 已經：
1. 讀取 `TEMPLATE_FILES` 中列出的每個檔案
2. 呼叫 `applyReplacements()` 替換 `{{VARIABLE}}` 佔位符
3. 寫回檔案

### 本次變更

| 項目 | 動作 |
|------|------|
| `CLAUDE.md` L10 | 硬編碼 → `{{PROJECT_DESCRIPTION}}` |
| `TEMPLATE_FILES` | 新增 `"TECHSTACK.md"` |
| `buildReplacements()` | 無需新增變數（已有 `PROJECT_DESCRIPTION`） |
| TECHSTACK.md 內容 | 直接修改為 domain-neutral（非變數替換） |

### E26 `--tutorial` / `--checklist` — 無影響

E26 的 tutorial 和 checklist 功能不依賴 CLAUDE.md/TECHSTACK.md 的具體內容，無需額外修改。

---

## 實作步驟

### Step 1 — 修改 CLAUDE.md（主檔案）

1. 將 L10 `Full-stack investment tracker. FastAPI server + React client + PostgreSQL.` 改為 `{{PROJECT_DESCRIPTION}}`
2. 移除 L1 標題中的 `AI-Coding-Template`，改為 `{{PROJECT_DISPLAY}}`

### Step 2 — 修改 TECHSTACK.md（主檔案）

1. Cache Tiers 表格：移除 domain-specific 範例
2. Track Roadmap：改為 Domain Architecture 通用表格
3. Core Tables：加註 domain tables 自動發現

### Step 3 — 修改 docs/techstack/ 子檔案

1. `architecture.md`：移除 PostGIS 引用
2. `agents-memory.md`：移除 Track 2/3 domain-specific 描述
3. `ai-dev-pipeline.md`：替換 portfolio 範例為通用範例

### Step 4 — 擴展 scaffold.ts

1. 在 `TEMPLATE_FILES` 加入 `"TECHSTACK.md"`
2. 驗證 `applyReplacements()` 正確處理新檔案

### Step 5 — 建立 .tmpl 參考檔案

1. 建立 `docs/templates/scaffold/` 目錄
2. 寫入 `CLAUDE.md.tmpl`（如上方內容）
3. 寫入 `TECHSTACK.md.tmpl`（domain-neutral 版本）

---

## 驗收標準

### 模板變數

- [ ] `CLAUDE.md` 不再包含 `"Full-stack investment tracker"` 硬編碼文字
- [ ] `CLAUDE.md` 包含 `{{PROJECT_DESCRIPTION}}` 佔位符
- [ ] `CLAUDE.md` 標題包含 `{{PROJECT_DISPLAY}}` 佔位符
- [ ] E21 CLI `applyReplacements()` 正確替換 CLAUDE.md 中的所有佔位符

### Domain-Neutral 內容

- [ ] `TECHSTACK.md` 不再包含 `Holdings`, `watchlists`, `Prices`, `live data` 等 domain-specific 範例
- [ ] `TECHSTACK.md` 不再包含 `Place Intelligence`, `Investment Portfolio` 等 Track 描述
- [ ] `docs/techstack/architecture.md` 不再包含 `PostGIS` 引用
- [ ] `docs/techstack/agents-memory.md` 不再包含 domain-specific Track 描述
- [ ] `docs/techstack/ai-dev-pipeline.md` 不再包含 `portfolio` 範例

### Scaffold 整合

- [ ] `scripts/new-site/scaffold.ts` 的 `TEMPLATE_FILES` 包含 `"TECHSTACK.md"`
- [ ] 執行 E21 CLI 後，CLAUDE.md 和 TECHSTACK.md 中無殘留 `{{` 佔位符

### .tmpl 參考檔案

- [ ] `docs/templates/scaffold/CLAUDE.md.tmpl` 存在且為完整的乾淨起點
- [ ] `docs/templates/scaffold/TECHSTACK.md.tmpl` 存在且為 domain-neutral 版本
- [ ] `.tmpl` 檔案中所有佔位符都有對應的 `buildReplacements()` entry

### 向後相容

- [ ] 現有測試全部通過（`pnpm test`, `pytest`）
- [ ] E21 scaffold.test.ts 測試 TECHSTACK.md 替換
- [ ] CLAUDE.md 仍在 100 行以內

---

## 風險與緩解

| 風險 | 緩解方案 |
|------|---------|
| CLAUDE.md 佔位符導致 raw template 被 AI 誤讀 | E21 CLI 在 scaffold 時立即替換，使用者永遠看到替換後的版本 |
| TECHSTACK.md 移除 domain 範例後資訊不足 | 保留結構說明，用「Domain list data」等通用詞替代 |
| `.tmpl` 與主檔案不同步 | 在 QA 步驟中加入 diff 檢查 |

---

## 大小估算

| 項目 | 時間 |
|------|------|
| CLAUDE.md 佔位符替換 | 10 min |
| TECHSTACK.md domain-neutral 化 | 20 min |
| techstack/ 子檔案清理 | 15 min |
| scaffold.ts 擴展 | 10 min |
| .tmpl 參考檔案 | 20 min |
| scaffold.test.ts 測試 | 15 min |
| 驗證 + QA | 15 min |
| **合計** | **~1.5h (S)** |
