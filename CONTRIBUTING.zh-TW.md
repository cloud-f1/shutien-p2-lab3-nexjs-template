# 貢獻指南

[English version](CONTRIBUTING.md)

感謝你對 AI Coding Template 的關注！我們歡迎任何形式的貢獻——無論是回報 Bug、提出功能建議、改善文件，或提交程式碼。

---

## 行為準則

參與本專案即代表你同意以下原則：

- **尊重**：以友善、專業的態度與他人互動
- **包容**：歡迎不同背景與經驗程度的參與者
- **建設性**：提供有建設性的回饋，聚焦於改善而非批評

---

## 開發環境設定

請參考 [快速上手指南](docs/guides/zh-TW/quickstart.md) 完成開發環境設定。

**基本需求**：

- Node.js >= 22
- pnpm >= 8
- Python >= 3.12
- uv (Python 套件管理)
- PostgreSQL >= 15
- Git

---

## 分支策略

| 分支 | 用途 |
|------|------|
| `main` | 穩定分支，所有 PR 合併的目標 |
| `feat/E{n}-{slug}` | Epic 功能分支（例：`feat/E7-places-crud`） |
| `feat/{description}` | 非 Epic 功能分支（例：`feat/add-dark-mode`） |
| `fix/{description}` | Bug 修復分支 |

**流程**：

1. 從 `main` 開新分支
2. 開發並提交 commit
3. 建立 PR 回 `main`

---

## Commit 慣例

本專案使用 **Conventional Commits** 格式，`git-cliff` 依賴此格式自動產生 Changelog。

### 格式

```
<type>(<scope>): <description>

[optional body]
```

### 常用 Type

| Type | 說明 | 範例 |
|------|------|------|
| `feat` | 新功能 | `feat(E7): Places CRUD endpoints` |
| `fix` | Bug 修復 | `fix: resolve token refresh race condition` |
| `docs` | 文件變更 | `docs: update quickstart guide` |
| `refactor` | 重構（不改變功能） | `refactor: extract auth middleware` |
| `test` | 測試相關 | `test: add portfolio service tests` |
| `chore` | 建置、工具、設定 | `chore: update dependencies` |

### 規則

- Scope 建議使用 Epic 編號：`feat(E7): ...`
- Description 使用英文，以小寫字母開頭
- 每個 commit 應代表一個有意義的變更

---

## PR 流程

### 使用 Agent 建立 PR（推薦）

```bash
/athena:pr         # 完整流程：合併 main → 建置 → 測試 → 建立 PR
/athena:ship       # 快速流程：審查 → 修復 → commit → PR
```

### 手動建立 PR

1. 確保分支已推送至 remote
2. 建立 PR，標題遵循 Conventional Commits 格式：
   ```
   feat(E{n}): Short description (#issue)
   ```
3. 等待 CI 通過：
   - Backend tests（pytest, >= 80% coverage）
   - Frontend tests（Vitest, >= 80% coverage）
   - Lint checks
4. 至少一位 reviewer approve 後合併

---

## Agent 團隊使用

本專案內建 9 個 AI Agent，透過 Athena 指令系統調度：

| 指令 | 用途 |
|------|------|
| `/athena:spec <feature>` | 設計新功能規格（OpenAPI-first） |
| `/athena:implement` | TDD 循環：規格 → 程式碼 → QA |
| `/athena:qa` | 程式碼審查 + 測試套件 |
| `/athena:pr [--draft]` | 合併 main → 建置 → 測試 → 建立 PR |
| `/athena:deploy [env]` | 6 道閘門部署至 Zeabur |
| `/athena:load` | 載入所有上下文文件 |
| `/athena:save` | 所有 Agent 同步存檔 |
| `/athena:promote` | 萃取通用經驗至 Tier 0 |

**建議工作流程**：

1. 先用 `/athena:spec` 設計功能規格
2. 用 `/athena:implement` 進行 TDD 開發
3. 用 `/athena:qa` 執行品質檢查
4. 用 `/athena:pr` 或 `/athena:ship` 建立 PR

---

## Epic Pipeline

所有功能開發必須經過 **Epic Pipeline**：

```
spec → implement → qa → commit → merge
```

| 步驟 | 說明 |
|------|------|
| **spec** | 設計功能規格，撰寫 OpenAPI spec |
| **implement** | TDD 循環（RED → GREEN → REFACTOR） |
| **qa** | 程式碼審查 + 測試覆蓋率檢查 |
| **commit** | 提交程式碼，遵循 Conventional Commits |
| **merge** | 建立 PR，通過 CI，合併至 main |

使用 `/athena:loop` 可逐步推進 Epic Pipeline。

進度追蹤：[`docs/epics/EPIC_INDEX.md`](docs/epics/EPIC_INDEX.md)

---

## 程式碼風格

### Server（Python）

- 遵循 Python conventions（見 CLAUDE.md 架構規則）
- 使用 `uv` 管理套件（不使用 pip）
- 非同步 endpoint 使用 `async def`
- 型別提示完整

### Client（React + TypeScript）

- 遵循 React conventions（見 CLAUDE.md 架構規則）
- 使用 `userEvent`（不使用 `fireEvent`）測試互動
- MSW handlers 放在 `src/tests/handlers/`
- React Query cache tier 使用 `cacheConfig.ts`

### API 設計

- **Spec-Driven Development (SDD)**：先編輯 `docs/openapi.yaml`，再寫程式碼
- OpenAPI spec 是所有型別的唯一真實來源

---

## 測試要求

| 項目 | 要求 |
|------|------|
| 覆蓋率門檻 | >= 80%（Server + Client） |
| Server 測試框架 | pytest + asyncio（`asyncio_mode = auto`） |
| Client 測試框架 | Vitest + @testing-library/react + MSW |
| 互動測試 | 使用 `userEvent`，不使用 `fireEvent` |

```bash
# 執行 Server 測試
cd server && uv run pytest --cov

# 執行 Client 測試
cd client && pnpm test --coverage
```

CI 執行哪些檢查以及如何修復常見失敗，請參閱 [CI 流水線說明](docs/guides/zh-TW/ci-explained.md)。

---

## 回報問題

請使用 [Issue Templates](https://github.com/cloud-f1/ai-coding-template/issues/new/choose) 回報問題：

- **Bug Report**：回報錯誤，包含重現步驟與環境資訊
- **Feature Request**：提出新功能建議，說明動機與方案

---

## 授權

本專案採用 [MIT 授權](LICENSE)。提交貢獻即表示你同意以相同授權釋出你的程式碼。
