# E31 — GitHub Template Distribution

> **Size**: S (~1 session) | **Depends on**: E24 (quickstart guide), E29 (CLAUDE.md templating)
> **Status**: spec

---

## 問題陳述

專案已完成所有核心功能（E0–E30），具備完整的 AI 驅動開發工作流、Domain Registry、
互動式 CLI、模板化系統。但缺乏作為 **GitHub Template Repository** 公開發佈所需的配套：

| 缺口 | 影響 |
|------|------|
| 無 `template-cleanup.sh` | Clone 後殘留範例 domain、歷史 commit、舊 epic 記錄 |
| README.md 為內部導向 | 外部使用者無法快速理解模板價值與使用方式 |
| 無 `CONTRIBUTING.md` | 貢獻者不知道 PR 流程、commit 慣例、agent 使用方式 |
| 無 Issue Templates | Bug report / Feature request 格式不統一 |
| 無 `LICENSE` 檔案 | 開源授權不明確 |
| GitHub Template 設定未文件化 | 不知如何將 repo 設為 template |

## 解決方案

建立完整的 GitHub Template Distribution 配套，讓使用者可以透過 GitHub 的
"Use this template" 按鈕一鍵建立新專案，並在 clone 後執行 `template-cleanup.sh`
清理範例內容。

---

## 範圍界定

### 在範圍內

- `.github/template-cleanup.sh` — post-clone 清理腳本
- `README.md` — 重寫為公開模板 landing page
- `CONTRIBUTING.md` — 貢獻指南（繁體中文）
- `.github/ISSUE_TEMPLATE/bug_report.md` — Bug report 模板
- `.github/ISSUE_TEMPLATE/feature_request.md` — Feature request 模板
- `.github/ISSUE_TEMPLATE/config.yml` — Issue template chooser 設定
- `LICENSE` — MIT 授權
- `.github/TEMPLATE_SETUP.md` — GitHub template repo 設定指南

### 不在範圍內

- GitHub Actions workflow 修改（已在 CI 中）
- 新的 CLI 工具（E21/E26 已完成）
- 文件內容變更（E24/E29 已完成）
- Zeabur 部署設定（E9 已完成）

---

## 變更清單

### 1. `.github/template-cleanup.sh` — Post-Clone 清理腳本

**用途**：使用者透過 "Use this template" 建立新 repo 後，執行此腳本清理範例內容。

**行為定義**：

```bash
#!/usr/bin/env bash
# Post-clone cleanup for ai-coding-template
# Usage: bash .github/template-cleanup.sh
# Idempotent: safe to run multiple times
```

#### 清理項目

| 類別 | 動作 | 目標 |
|------|------|------|
| 範例 Domain | 刪除 | `server/app/domains/places/`, `server/app/domains/portfolios/` |
| 範例 Domain 相容 shim | 刪除 | `server/app/models/place.py`, `server/app/models/portfolio.py`, `server/app/schemas/place.py`, `server/app/schemas/portfolio.py`, `server/app/api/v1/endpoints/places.py`, `server/app/api/v1/endpoints/portfolios.py` |
| 範例 Domain 測試 | 刪除 | `server/tests/integration/test_places.py`, `server/tests/integration/test_portfolios.py` |
| 範例 Client 頁面 | 刪除 | `client/src/pages/places/`, `client/src/pages/portfolios/` |
| 範例 Client hooks | 刪除 | `client/src/hooks/usePlaces.ts`, `client/src/hooks/usePortfolios.ts` |
| 範例 Client services | 刪除 | `client/src/api/services/places.ts`, `client/src/api/services/portfolios.ts` 及其測試 |
| 範例 Client schemas | 刪除 | `client/src/schemas/place.ts`, `client/src/schemas/portfolio.ts` |
| 範例 MSW handlers | 刪除 | `client/src/tests/handlers/places.ts`, `client/src/tests/handlers/portfolios.ts` |
| OpenAPI domain paths | 刪除 | `docs/openapi/paths/places.yaml`, `docs/openapi/paths/portfolios.yaml` |
| OpenAPI domain schemas | 刪除 | `docs/openapi/schemas/place.yaml`, `docs/openapi/schemas/portfolio.yaml` |
| Epic 歷史 | 重置 | `docs/epics/EPIC_INDEX.md` → 空白模板（保留格式，清空 E0–E31 記錄） |
| Epic specs | 刪除 | `docs/epics/e*.md`（保留 `EPIC_INDEX.md` 和 `CLAUDE.md`） |
| Session context | 重置 | `docs/context/session-summary.md` → 空白模板 |
| 範例 Alembic migrations | 刪除 | `server/alembic/versions/*.py`（保留 `alembic/` 結構） |
| Git 歷史 | 重置 | `rm -rf .git && git init && git add -A && git commit -m "Initial commit from ai-coding-template"` |
| Changelog | 刪除 | `docs/dev-guide/changelog.md` 內容清空（保留檔案） |
| 範例藍圖 | 保留 | `docs/blueprints/` — 作為參考範例 |
| 範例 domain config | 保留 | `docs/templates/domain/examples/` — 作為 `/athena:domain` 參考 |
| 清理腳本自身 | 刪除 | `.github/template-cleanup.sh` 和 `.github/TEMPLATE_SETUP.md` |

#### 設計原則

1. **冪等（Idempotent）**：每個刪除操作前檢查檔案是否存在，重複執行不報錯
2. **安全優先**：不刪除 auth、session、user 等核心模組
3. **保留骨架**：目錄結構保留（空的 `server/app/domains/`），讓使用者知道在哪放新 domain
4. **自我清理**：腳本最後刪除自己
5. **彩色輸出**：使用 ANSI 色碼顯示進度（綠色=成功，黃色=跳過，紅色=錯誤）
6. **確認提示**：執行前顯示將要做的事並要求 `y/N` 確認

#### 腳本結構

```bash
#!/usr/bin/env bash
set -euo pipefail

# Colors
GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; NC='\033[0m'

# Functions
info()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[SKIP]${NC} $1"; }
fail()  { echo -e "${RED}[ERROR]${NC} $1"; }

safe_rm() {
  local target="$1"
  if [ -e "$target" ]; then
    rm -rf "$target"
    info "Removed $target"
  else
    warn "Not found: $target (already clean)"
  fi
}

# 1. Confirmation prompt
# 2. Remove example domains (server + client + openapi + tests)
# 3. Reset EPIC_INDEX.md to blank template
# 4. Remove epic specs (docs/epics/e*.md)
# 5. Reset session context
# 6. Remove alembic migrations
# 7. Clear changelog
# 8. Reset git history
# 9. Self-cleanup (remove this script + TEMPLATE_SETUP.md)
# 10. Done message with next steps
```

### 2. `README.md` — 重寫為公開模板 Landing Page

**現行**：內部開發導向的 README（有效但不適合作為 template landing page）

**改為**：保留現有結構，但增強為 GitHub Template 導向。主要變更：

#### 結構

```markdown
# AI Coding Template

> badges: CI status, license, template

## 這是什麼（What is this）
一段話說明：全端 SaaS 模板，內建 AI Agent 工作流，Claude Code 驅動。

## 特色功能（Features）
- 6 AI Agents + 14 Athena Commands
- Spec-Driven Development (SDD) 工作流
- Domain Registry — 模組化業務邏輯，刪除目錄即移除功能
- Interactive Site Builder CLI (`pnpm new-site`)
- 4 主題系統 + WCAG 2.1 AA 無障礙
- JWT + OAuth (Google/GitHub) 認證
- 80% 測試覆蓋率門檻
- One-command deploy to Zeabur

## 快速開始（Quick Start）
（保留現有的 Claude Code / 手動開發 兩個 details block）
新增：Use this template → clone → bash .github/template-cleanup.sh → pnpm new-site

## 架構總覽（Architecture）
（保留現有的檔案結構，新增 Mermaid 圖連結 → E27 產出）

## Agent 團隊（Agent Team）
（保留現有表格）

## 技能模組（Skills）
（保留現有表格）

## Athena 指令（Commands）
（保留現有程式碼區塊）

## 文件導覽（Documentation）
表格連結到：
- docs/guides/quickstart.md
- docs/guides/first-epic-walkthrough.md
- docs/guides/custom-agents.md
- TECHSTACK.md
- CLAUDE.md
- docs/epics/EPIC_INDEX.md

## 貢獻（Contributing）
連結到 CONTRIBUTING.md

## 授權（License）
MIT — 連結到 LICENSE

## English
（保留現有英文段落，同步更新結構）
```

#### 新增 Badge

```markdown
[![CI](https://github.com/cloud-f1/ai-coding-template/actions/workflows/ci.yml/badge.svg)](https://github.com/cloud-f1/ai-coding-template/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
```

### 3. `CONTRIBUTING.md` — 貢獻指南

**語言**：繁體中文（程式碼區塊內為英文）

#### 段落大綱

1. **歡迎** — 歡迎貢獻，簡述專案理念
2. **行為準則** — 簡短版（尊重、包容、建設性）
3. **開發環境設定**
   - 連結到 `docs/guides/quickstart.md`（不重複內容）
4. **分支策略**
   - `main` 為穩定分支
   - Feature branch: `feat/E{n}-{slug}` 或 `feat/{description}`
   - 從 main 開分支，PR 回 main
5. **Commit 慣例**
   - Conventional Commits 必要
   - 格式：`feat(E{n}): description`、`fix: description`、`docs: description`
   - git-cliff 依賴此格式產生 changelog
6. **PR 流程**
   - 使用 `/athena:pr` 或手動建立
   - PR 標題格式：`feat(E{n}): Short description (#issue)`
   - CI 必須通過（backend + frontend tests, 80% coverage）
   - 至少一位 reviewer approve
7. **Agent 團隊使用**
   - `/athena:spec` — 設計新功能前先寫 spec
   - `/athena:implement` — TDD 循環
   - `/athena:qa` — 提交前執行品質檢查
   - `/athena:ship` — 快速提交 + PR
8. **Epic Pipeline**
   - 所有功能必須經過 epic pipeline：spec → implement → qa → commit → merge
   - 連結到 `docs/epics/EPIC_INDEX.md`
9. **程式碼風格**
   - Server: 見 python-conventions.md
   - Client: 見 react-conventions.md
   - OpenAPI spec 先行（SDD）
10. **測試要求**
    - 覆蓋率 >= 80%
    - Server: pytest + asyncio
    - Client: Vitest + userEvent + MSW
11. **回報問題**
    - 使用 Issue Template
    - Bug report vs Feature request

### 4. `.github/ISSUE_TEMPLATE/bug_report.md`

```yaml
---
name: Bug Report / 錯誤回報
about: 回報一個 Bug 以幫助我們改善專案
title: "[Bug] "
labels: bug
assignees: ""
---
```

#### 欄位

- **描述（Description）** — 簡述 Bug
- **重現步驟（Steps to Reproduce）** — 編號步驟
- **預期行為（Expected Behavior）**
- **實際行為（Actual Behavior）**
- **環境資訊（Environment）**
  - OS:
  - Node version:
  - Python version:
  - pnpm version:
  - Browser:
- **截圖或 Log（Screenshots / Logs）** — 選填
- **附加資訊（Additional Context）** — 選填

### 5. `.github/ISSUE_TEMPLATE/feature_request.md`

```yaml
---
name: Feature Request / 功能建議
about: 提出新功能或改善建議
title: "[Feature] "
labels: enhancement
assignees: ""
---
```

#### 欄位

- **功能描述（Feature Description）** — 你希望加入什麼功能？
- **動機（Motivation）** — 為什麼需要這個功能？解決什麼問題？
- **建議方案（Proposed Solution）** — 你想到的實作方式（選填）
- **替代方案（Alternatives Considered）** — 你考慮過的其他方式（選填）
- **是否願意實作（Willing to Implement）** — 是 / 否 / 需要指導
- **附加資訊（Additional Context）** — 選填

### 6. `.github/ISSUE_TEMPLATE/config.yml`

```yaml
blank_issues_enabled: true
contact_links:
  - name: 文件（Documentation）
    url: https://github.com/cloud-f1/ai-coding-template/tree/main/docs/guides
    about: 查看使用指南與教學文件
```

### 7. `LICENSE` — MIT

標準 MIT License，Copyright holder: `cloud-f1`。

### 8. `.github/TEMPLATE_SETUP.md` — Template Repo 設定指南

手動設定步驟（repo owner 執行一次）：

1. GitHub repo Settings → 勾選 "Template repository"
2. 確認 `.github/template-cleanup.sh` 已 commit
3. 確認 README.md 包含 "Use this template" 引導
4. 設定 Topics: `saas-template`, `claude-code`, `fastapi`, `react`, `ai-agents`
5. 設定 Description: "Full-stack SaaS template with AI Agent workflows for Claude Code"
6. 確認 About 區域有 website link（如有部署的 demo）

---

## EPIC_INDEX.md 空白模板

`template-cleanup.sh` 會將 EPIC_INDEX.md 重置為：

```markdown
# {{PROJECT_DISPLAY}} — Epic Progress Tracker

> **Purpose**: Machine-readable state for the Epic Loop orchestrator
> **Updated by**: Agent after each step completes
> **Read by**: `/athena:loop` or `SessionStart` to determine next action

---

## Phase Status

| Phase | Epics | Status |
|-------|-------|--------|
| Phase 1 | E1 | ⬜ Pending |

## Epic Step Matrix

<!--
Steps: spec → implement → qa → commit → merge
Status: ⬜ pending | 🔄 in-progress | ✅ done | ⏭️ skip | ❌ failed
Size: S (~1 session) | M (1-2 sessions) | L (2-3 sessions)
-->

| Epic | Name | Size | Spec | Impl | QA | Commit | Merge | Notes |
|------|------|------|------|------|-----|--------|-------|-------|
| E1 | (your first epic) | S | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |

---

## Next Action

Start with `/athena:spec` to design your first feature.
```

---

## 實作步驟

### Step 1 — 建立 LICENSE

建立 `LICENSE` 檔案（MIT）。

### Step 2 — 建立 Issue Templates

建立 `.github/ISSUE_TEMPLATE/` 目錄及三個檔案：
- `bug_report.md`
- `feature_request.md`
- `config.yml`

### Step 3 — 建立 CONTRIBUTING.md

根據上方段落大綱撰寫完整的繁體中文貢獻指南。

### Step 4 — 建立 template-cleanup.sh

根據上方行為定義撰寫清理腳本。確保：
- 所有路徑與 `scaffold.ts` 的 `DOMAIN_REMOVAL_MAP` 一致
- 加上 OpenAPI paths/schemas 清理（scaffold.ts 未涵蓋）
- 加上 epic/context/migration 重置
- 冪等安全

### Step 5 — 更新 README.md

保留現有內容結構，增加：
- CI badge + MIT badge
- "Use this template" 引導段落
- 文件導覽表格
- 貢獻連結
- License 段落
- 同步更新英文段落

### Step 6 — 建立 TEMPLATE_SETUP.md

GitHub Template Repo 手動設定指南。

### Step 7 — 驗證

- 在乾淨的 clone 上執行 `template-cleanup.sh`，確認所有項目正確清理
- 確認腳本冪等（再執行一次不報錯）
- 確認 README.md Markdown 格式正確
- 確認所有連結指向存在的檔案

---

## 驗收標準

### template-cleanup.sh

- [ ] 刪除範例 domain 檔案（server + client + openapi + tests）— 與 `DOMAIN_REMOVAL_MAP` 一致
- [ ] 重置 `EPIC_INDEX.md` 為空白模板
- [ ] 刪除 `docs/epics/e*.md` epic spec 檔案
- [ ] 重置 `docs/context/session-summary.md`
- [ ] 刪除 `server/alembic/versions/*.py` migration 檔案
- [ ] 清空 `docs/dev-guide/changelog.md`
- [ ] 重置 git 歷史（`git init` + initial commit）
- [ ] 腳本最後刪除自身 + `TEMPLATE_SETUP.md`
- [ ] 冪等：重複執行不報錯
- [ ] 執行前有確認提示（`y/N`）
- [ ] 彩色終端輸出
- [ ] 保留 auth/session/user 等核心模組不受影響

### README.md

- [ ] 包含 CI status badge
- [ ] 包含 MIT license badge
- [ ] 包含 "Use this template" 使用流程
- [ ] 包含文件導覽表格（連結到 guides/、TECHSTACK.md、CLAUDE.md）
- [ ] 包含貢獻連結（→ CONTRIBUTING.md）
- [ ] 包含 License 段落
- [ ] 繁體中文 + 英文雙語
- [ ] 所有連結有效

### CONTRIBUTING.md

- [ ] 繁體中文撰寫
- [ ] 包含 Conventional Commits 規範
- [ ] 包含 PR 流程說明
- [ ] 包含 Agent 團隊使用指引
- [ ] 包含 Epic Pipeline 說明
- [ ] 引用（非複製）quickstart.md 的開發環境設定
- [ ] 包含測試覆蓋率要求（>= 80%）

### Issue Templates

- [ ] `.github/ISSUE_TEMPLATE/bug_report.md` 包含環境資訊欄位
- [ ] `.github/ISSUE_TEMPLATE/feature_request.md` 包含動機與建議方案欄位
- [ ] `.github/ISSUE_TEMPLATE/config.yml` 啟用 blank issues + documentation link

### LICENSE

- [ ] MIT License 檔案存在於 repo root
- [ ] Copyright holder 正確

### TEMPLATE_SETUP.md

- [ ] 包含 GitHub "Template repository" 設定步驟
- [ ] 包含建議的 repo Topics
- [ ] 包含建議的 repo Description

### 整合驗證

- [ ] 現有測試全部通過（`pnpm test`, `pytest`）— 本 epic 不修改任何程式碼
- [ ] `template-cleanup.sh` 執行後，剩餘檔案可正常啟動（`pnpm install` + `uv sync` 無錯誤）
- [ ] 清理後的 EPIC_INDEX.md 包含 `{{PROJECT_DISPLAY}}` 佔位符，可被 E21 CLI 替換

---

## 風險與緩解

| 風險 | 緩解方案 |
|------|---------|
| cleanup.sh 意外刪除核心檔案 | 明確列出白名單，使用 `safe_rm` 函數逐一處理 |
| OpenAPI spec 刪除 domain paths 後結構損壞 | 只刪除 domain-specific 的 paths/schemas YAML，保留 entry file |
| Git 歷史重置導致使用者困惑 | 在確認提示中明確說明「將重置 git 歷史」 |
| README 改動破壞現有連結 | 保留現有 anchor ID，只新增段落不改名 |

---

## 大小估算

| 項目 | 時間 |
|------|------|
| LICENSE | 5 min |
| Issue Templates (3 files) | 15 min |
| CONTRIBUTING.md | 30 min |
| template-cleanup.sh | 45 min |
| README.md 更新 | 30 min |
| TEMPLATE_SETUP.md | 10 min |
| 驗證 + 冪等測試 | 15 min |
| **合計** | **~2.5h (S)** |
