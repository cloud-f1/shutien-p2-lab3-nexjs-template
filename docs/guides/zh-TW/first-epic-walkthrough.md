# 第一個 Epic 實戰（First Epic Walkthrough）

> 手把手建立一個完整的自訂 domain，預估時間約 **30 分鐘**。

## 前言

完成本指南後，你將學會：

- **Epic-Driven Development** 的完整流程
- **SDD（Spec-Driven Development）** 的實踐：OpenAPI 規格先行
- **Domain Registry** 自動發現機制（E22）
- **`/athena:domain`** 產生器的使用方式（E23）
- **Athena 指令** 在開發流程中的運用時機

### 前置條件

- 已完成 [快速入門](quickstart.md)，dev server 可正常啟動
- 已安裝 Claude Code CLI（用於執行 Athena slash commands）

---

## 核心概念速覽

### Epic-Driven Development

本專案所有功能開發都遵循 **Epic Pipeline**：

```
spec → implement → qa → commit → merge
```

每個 Epic 是一個獨立的功能單元，由 [EPIC_INDEX.md](../../epics/EPIC_INDEX.md) 統一追蹤進度。不允許脫離 Epic 的臨時開發。

### SDD — Spec-Driven Development

**核心規則**：永遠先編輯 `docs/openapi/` 再寫程式碼。

流程順序：

1. 定義 OpenAPI 規格（schemas + paths）
2. 產生 TypeScript 類型（`pnpm generate:types`）
3. 實作後端（FastAPI endpoints）
4. 實作前端（React pages + hooks）

### Athena 指令概覽

以下是開發流程中最常用的指令：

| 指令 | 用途 | 何時使用 |
|------|------|----------|
| `/athena:spec <feature>` | 設計功能規格 | 開始新 Epic 時，定義 OpenAPI 規格 |
| `/athena:domain <name>` | 產生完整 domain 骨架 | 建立新的資料 domain（模型+API+頁面） |
| `/athena:implement` | TDD 開發循環 | 從 spec 進入實作階段 |
| `/athena:qa` | 程式碼審查 + 測試 | 實作完成後，執行品質檢查 |
| `/athena:ship` | 快速發佈 | 審查 → 修正 → commit → PR |
| `/athena:loop` | Epic 推進器 | 自動判斷下一步並執行 |
| `/athena:loop status` | 查看當前狀態 | 確認 Epic 進度 |
| `/athena:pr` | 完整 PR 流程 | merge main → build → test → lint → PR |
| `/athena:deploy` | 部署到 Zeabur | 通過 6 道檢查門後部署 |
| `/athena:save` | 全體 Agent 存檔 | 結束工作前，保存所有 Agent 狀態 |
| `/athena:load` | 載入上下文 | 開始新 session，恢復完整狀態 |
| `/athena:plan` | 策略規劃 | 審計現況、提案新 Epic |
| `/athena:learn` | 記憶更新 | 刷新 MEMORY.md，偵測知識漂移 |
| `/athena:promote` | 提取通用經驗 | 將專案經驗推廣至全域記憶 |

> 完整的 Agent 團隊說明請參考 [CLAUDE.md](../../../CLAUDE.md)。

---

## 情境設定

我們將建立一個 **bookmark**（書籤管理）domain 作為示範。

### 為什麼選擇 bookmark？

- 簡單直觀 — 只有 2-3 個欄位
- CRUD 完整 — 建立、讀取、更新、刪除一應俱全
- 不與現有 domain 衝突（專案已有 `places` 和 `portfolios`）

### 預期資料欄位

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `url` | string | 是 | 書籤網址 |
| `title` | string | 是 | 書籤標題 |
| `notes` | text | 否 | 備註 |

> 系統會自動加入 `id`（UUID 主鍵）、`user_id`（外鍵關聯使用者）、
> `created_at` 和 `updated_at`（時間戳記），你不需要手動定義。

---

## Step 1：建立 Epic Entry

在開始任何開發前，先在 [EPIC_INDEX.md](../../epics/EPIC_INDEX.md) 登記新的 Epic。

在 Epic Step Matrix 中新增一行：

```markdown
| E99 | Bookmark Domain | S | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 書籤管理 CRUD |
```

> **命名慣例**：
>
> - Epic 編號：`E{數字}`（遞增，取下一個可用號碼）
> - 分支名稱：`feat/E99-bookmark-domain`
> - Commit 訊息：`feat(E99): Bookmark domain CRUD`

建立 feature 分支：

```bash
git checkout -b feat/E99-bookmark-domain
```

---

## Step 2：用 `/athena:domain` 產生骨架

這是最關鍵的一步。`/athena:domain` 是 E23 建立的 domain 產生器，會依照 SDD 流程，**先產生 OpenAPI 規格，再產生所有程式碼**。

在 Claude Code 中執行：

```
/athena:domain bookmark --fields "url:string,title:string,notes:text"
```

### 產生的檔案清單

執行後，產生器會按照以下 10 個步驟自動建立所有檔案：

**OpenAPI 規格**（Step 2 — 最先產生，SDD 合規）：

```
docs/openapi/schemas/bookmark.yaml     # 資料結構定義
docs/openapi/paths/bookmarks.yaml      # API 路徑定義
docs/openapi/openapi.yaml              # 主檔案（新增 $ref 參照）
```

**TypeScript 類型**（Step 3）：

```
client/src/api/types.ts                # 自動重新產生
```

**後端 Domain 套件**（Step 4）：

```
server/app/domains/bookmarks/__init__.py    # DomainConfig 匯出
server/app/domains/bookmarks/models.py      # SQLAlchemy 模型
server/app/domains/bookmarks/schemas.py     # Pydantic schemas
server/app/domains/bookmarks/endpoints.py   # FastAPI router
server/app/models/bookmark.py               # 向後相容 shim
server/app/schemas/bookmark.py              # 向後相容 shim
```

**後端測試**（Step 6）：

```
server/tests/integration/test_bookmarks.py  # 整合測試
```

**前端 Schemas + Service + Hooks**（Step 7）：

```
client/src/schemas/bookmark.ts              # Zod schema
client/src/api/services/bookmarks.ts        # CRUD service
client/src/hooks/useBookmarks.ts            # React Query hooks
```

**前端頁面 + 測試**（Step 8）：

```
client/src/pages/bookmarks/BookmarksPage.tsx       # 頁面元件
client/src/pages/bookmarks/BookmarksPage.test.tsx  # 頁面測試
client/src/pages/bookmarks/Bookmarks.css           # 頁面樣式
```

**前端 MSW Handlers**（Step 9）：

```
client/src/tests/handlers/bookmarks.ts      # 測試用 Mock 處理器
```

> **預期輸出**：Claude Code 會逐步執行並報告每個檔案的建立結果。
> 整個過程約 2-3 分鐘。

---

## Step 3：檢視 Domain Registry

E22 建立的 **Domain Registry** 採用自動發現機制 — 你不需要在 `main.py` 中手動註冊路由。

### 目錄結構

產生完成後，`server/app/domains/` 目錄會長這樣：

```
server/app/domains/
  __init__.py          # DomainConfig + discover_domains()
  places/              # 既有 domain
    __init__.py
    models.py
    schemas.py
    endpoints.py
  portfolios/          # 既有 domain
    __init__.py
    models.py
    schemas.py
    endpoints.py
  bookmarks/           # 你剛建立的 domain
    __init__.py
    models.py
    schemas.py
    endpoints.py
```

### 自動發現機制

`server/app/domains/__init__.py` 中的 `discover_domains()` 函式會：

1. 掃描 `app/domains/` 下所有子目錄
2. 嘗試匯入每個子套件
3. 尋找模組層級的 `domain_config` 屬性（`DomainConfig` 型別）
4. 自動將 router 註冊到 FastAPI app

你的 `bookmarks/__init__.py` 會匯出類似這樣的設定：

```python
from app.domains import DomainConfig
from app.domains.bookmarks.endpoints import router
from app.domains.bookmarks.models import Bookmark

domain_config = DomainConfig(
    router=router,
    prefix="/bookmarks",
    tags=["bookmarks"],
    models=[Bookmark],
)
```

> **重點**：只要 `domain_config` 正確匯出，整個 domain 就會被自動載入。
> 刪除 domain 目錄 = 零破損匯入，不需要修改任何其他檔案。

---

## Step 4：執行 Migration

產生器在 Step 5 已執行 `alembic revision --autogenerate`，但你需要確認遷移正確：

```bash
# 產生遷移檔案（如果產生器尚未執行）
cd server
uv run alembic revision --autogenerate -m "add bookmarks table"
```

檢查遷移檔案內容（位於 `server/alembic/versions/` 最新的 `.py` 檔案），確認包含：

- `bookmarks` 資料表建立
- `id` 欄位（UUID 主鍵）
- `user_id` 外鍵（關聯 `users` 表）
- `url`、`title`、`notes` 欄位
- `created_at`、`updated_at` 時間戳記

確認無誤後，執行遷移：

```bash
uv run alembic upgrade head
```

> **預期輸出**：
>
> ```
> INFO  [alembic.runtime.migration] Running upgrade xxx -> yyy, add bookmarks table
> ```

回到專案根目錄：

```bash
cd ..
```

---

## Step 5：跑測試（RED → GREEN）

TDD 精神：測試先行。產生器已建立測試檔案，現在來確認它們通過。

### 後端整合測試

```bash
cd server
uv run pytest tests/integration/test_bookmarks.py -v
```

> **預期輸出**：所有 CRUD 測試（建立、讀取、更新、刪除、分頁列表）應為 PASSED。
>
> ```
> tests/integration/test_bookmarks.py::test_create_bookmark PASSED
> tests/integration/test_bookmarks.py::test_get_bookmark PASSED
> tests/integration/test_bookmarks.py::test_list_bookmarks PASSED
> tests/integration/test_bookmarks.py::test_update_bookmark PASSED
> tests/integration/test_bookmarks.py::test_delete_bookmark PASSED
> ```

回到專案根目錄：

```bash
cd ..
```

### 前端元件測試

```bash
cd client
pnpm test -- --run src/pages/bookmarks/
```

> **預期輸出**：頁面元件渲染、資料載入、互動操作等測試應全部通過。

回到專案根目錄：

```bash
cd ..
```

> **如果測試失敗**：別慌，這正是 TDD 的 RED 階段。
> 檢查錯誤訊息、修正程式碼、再次執行測試。
> 也可以使用 `/athena:qa --test-only` 讓 QA Agent 幫你分析。

---

## Step 6：客製化（選讀）

產生器提供了完整的 CRUD 骨架，你可以根據需求進一步客製化。

### 新增欄位

例如，想加入 `is_favorite`（布林值）欄位：

1. **OpenAPI 規格** — 在 `docs/openapi/schemas/bookmark.yaml` 新增欄位定義
2. **重新產生類型** — `cd client && pnpm generate:types`
3. **模型** — 在 `server/app/domains/bookmarks/models.py` 新增 `mapped_column`
4. **Pydantic Schema** — 在 `server/app/domains/bookmarks/schemas.py` 新增欄位
5. **Zod Schema** — 在 `client/src/schemas/bookmark.ts` 新增欄位
6. **Migration** — `cd server && uv run alembic revision --autogenerate -m "add is_favorite to bookmarks"`
7. **測試** — 更新測試案例，確認新欄位正確運作

> 記住 SDD 順序：**OpenAPI → Server → Client**。

### 新增路由到 App.tsx

產生器會提醒你手動加入前端路由。在 `client/src/App.tsx` 中新增：

```tsx
import BookmarksPage from './pages/bookmarks/BookmarksPage';

// 在 <Routes> 內新增
<Route path="/bookmarks" element={<ProtectedRoute><BookmarksPage /></ProtectedRoute>} />
```

### 新增側邊欄連結

在 `client/src/components/DashboardLayout.tsx` 的側邊欄導航中加入書籤的連結。

### 調整頁面樣式

編輯 `client/src/pages/bookmarks/Bookmarks.css`。本專案使用 CSS 自訂屬性（design tokens），
所有可用的色彩和間距變數定義在主題系統中（詳見 [TECHSTACK.md](../../../TECHSTACK.md)）。

---

## Step 7：用 `/athena:ship` 提交

功能開發完成、測試通過後，使用 Athena 指令提交並建立 PR：

### 方式 A：使用 `/athena:ship`

在 Claude Code 中執行：

```
/athena:ship
```

`/athena:ship` 會自動執行：

1. **Review** — 程式碼審查
2. **Fix** — 自動修正發現的問題
3. **Commit** — 建立 conventional commit
4. **PR** — 建立 Pull Request

### 方式 B：手動 git 流程

如果你偏好手動操作：

```bash
# 確認變更
git status
git diff

# Stage 所有變更
git add -A

# 建立 conventional commit
git commit -m "feat(E99): Bookmark domain CRUD

- OpenAPI spec for bookmarks endpoints
- Server domain: model, schemas, endpoints
- Client: page, hooks, service, MSW handlers
- Integration + component tests"

# 推送並建立 PR
git push -u origin feat/E99-bookmark-domain
```

### 更新 EPIC_INDEX

提交後，將 Epic 狀態更新為完成：

```markdown
| E99 | Bookmark Domain | S | ✅ | ✅ | ✅ | ✅ | ⬜ | 書籤管理 CRUD |
```

`merge` 欄位在 PR 合併後才標記為 ✅。

---

## 完成回顧

恭喜！你已經完整走過一次 Epic Pipeline。讓我們回顧學到的內容：

### 你學到了什麼

| 概念 | 實踐 |
|------|------|
| **SDD 流程** | OpenAPI 規格先行 → TypeScript 類型 → 後端 → 前端 |
| **Domain Registry** | `discover_domains()` 自動發現，零手動註冊 |
| **Domain 產生器** | `/athena:domain` 一鍵產生 15+ 檔案 |
| **Epic Pipeline** | spec → implement → qa → commit → merge |
| **TDD 精神** | 測試與實作同步產生，確保品質 |
| **Athena 指令** | 每個開發階段都有對應的自動化指令 |

### 接下來可以做什麼

- **建立更多 Domain** — 試試 `/athena:domain todo` 或參考 `docs/templates/domain/examples/` 的範例設定（blog、todo、crm）
- **深入架構** — 閱讀 [TECHSTACK.md](../../../TECHSTACK.md) 了解完整技術決策
- **查看路線圖** — 閱讀 [EPIC_INDEX.md](../../epics/EPIC_INDEX.md) 了解所有 Phase 的規劃
- **使用 `/athena:loop`** — 讓 Loop 指令自動推進 Epic 的下一步
- **使用 `/athena:plan`** — 讓 @strategist Agent 審計現況並提案新 Epic

---

## 下一步

- **[AI Agent 團隊指南](ai-agent-team-guide.md)** — 學習序列與並行執行模式，同時推進多個 Epic
- **[OpenAPI 設計模式](openapi-patterns.md)** — 掌握本專案使用的 4 種 OpenAPI 模式（CRUD、分頁、巢狀資源、檔案上傳）
- **[建立領域專家 Agent](custom-agents.md)** — 為你的業務領域建立自訂 AI Agent
- **[學習路徑](learning-path.md)** — 查看所有指南的推薦閱讀順序

---

## 延伸閱讀

| 文件 | 說明 |
|------|------|
| [CLAUDE.md](../../../CLAUDE.md) | 專案規則、Agent 團隊、Memory 系統 |
| [TECHSTACK.md](../../../TECHSTACK.md) | 完整技術架構（可上傳至 Claude 恢復上下文） |
| [E22 — Domain Registry](../../epics/EPIC_INDEX.md) | Domain 自動發現機制的設計與實作 |
| [E23 — Starter Domain Generator](../../epics/e23-starter-domain-generator.md) | `/athena:domain` 產生器的完整規格 |
| [Domain 模板目錄](../../templates/domain/) | 所有 domain 產生器的模板檔案 |
| [範例 Domain 設定](../../templates/domain/examples/) | blog.yaml、todo.yaml、crm.yaml 範例 |
| [Athena 指令目錄](../../../.claude/commands/athena/) | 所有 17 個 slash commands 的定義 |
