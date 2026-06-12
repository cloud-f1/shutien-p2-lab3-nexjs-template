# 不使用 Claude Code 的開發工作流程

> 本指南介紹如何僅使用 `make` 指令和標準 CLI 工具進行完整的開發工作流程。Claude Code 是**加速器**，不是必需品。

---

## 快速參考

| 任務 | 指令 |
|------|------|
| 啟動所有服務 | `make go` |
| 建立新 Domain | `make new-domain NAME=notes` |
| 執行所有測試 | `make test` |
| 執行後端測試 | `make test-server` |
| 執行前端測試 | `make test-client` |
| 檢查環境狀態 | `make doctor` |
| 互動式教學 | `make tutorial` |

---

## 1. 初始設定

```bash
# 複製專案
git clone <your-repo-url>
cd ai-coding-template

# 一鍵啟動（安裝相依套件、啟動資料庫、執行 migration、啟動開發伺服器）
make go
```

`make go` 會自動處理：
- 檢查前置工具（Node、pnpm、Python、uv、Docker）
- 產生含隨機密鑰的 `.env` 檔案
- 安裝 Python 和 Node 相依套件
- 透過 Docker 啟動 PostgreSQL
- 執行資料庫 migration
- 從 OpenAPI 規格產生 TypeScript 型別
- 啟動 API 伺服器和前端開發伺服器

## 2. 建立新 Domain

「Domain」是一個獨立的功能模組，包含自己的 model、endpoints、schemas 和測試。

```bash
# 建立 "notes" domain，預設欄位為 name + description
make new-domain NAME=notes
```

這會產生：
- `server/app/domains/notes/models.py` — SQLAlchemy model
- `server/app/domains/notes/schemas.py` — Pydantic 請求/回應 schemas
- `server/app/domains/notes/endpoints.py` — CRUD endpoints（列表、新增、讀取、更新、刪除）
- `server/app/domains/notes/__init__.py` — Domain 註冊（自動發現）
- 新資料表的 Alembic migration

Domain 會**自動註冊** — 不需要修改 `main.py` 或任何路由設定。

## 3. 自訂 Domain

### 新增欄位

編輯 `server/app/domains/notes/models.py`：

```python
class Note(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "notes"

    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    # 新增你的欄位：
    priority: Mapped[int] = mapped_column(Integer, default=0)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("user.id", ondelete="CASCADE"), index=True
    )
```

然後更新 `schemas.py` 中的 schemas，並產生新的 migration：

```bash
cd server
uv run alembic revision --autogenerate -m "add fields to notes"
uv run alembic upgrade head
```

### 更新 OpenAPI 規格

若要完整遵循規格驅動開發（SDD）工作流程，請**先**編輯 `docs/openapi.yaml`，再更新伺服器程式碼。這確保 API 契約始終是唯一的真實來源。

## 4. 測試

```bash
# 執行所有測試（後端 + 前端）
make test

# 僅執行後端測試（含覆蓋率）
make test-server

# 僅執行前端測試（含覆蓋率）
make test-client

# 執行特定測試檔案
cd server && uv run pytest tests/integration/test_notes.py -v

# 檢查程式碼風格
make lint
```

### 撰寫後端測試

建立 `server/tests/integration/test_notes.py`：

```python
import pytest
from httpx import AsyncClient


async def test_create_note(auth_client: AsyncClient):
    res = await auth_client.post(
        "/api/v1/notes/",
        json={"name": "My Note", "description": "Hello world"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "My Note"


async def test_list_notes(auth_client: AsyncClient):
    res = await auth_client.get("/api/v1/notes/")
    assert res.status_code == 200
    assert "items" in res.json()
```

## 5. 開發工作流程

### 日常開發

```bash
# 啟動開發環境
make go

# 在另一個終端機中，以 watch 模式執行測試
cd client && pnpm test
```

### 新增 Endpoint

1. （選擇性）編輯 `docs/openapi.yaml` 定義新 endpoint
2. 在 domain 的 `endpoints.py` 中新增路由
3. 如有需要，更新 schemas
4. 撰寫測試
5. 執行 `make test` 驗證

### 資料庫 Migration

```bash
# model 變更後產生 migration
cd server && uv run alembic revision --autogenerate -m "describe your change"

# 套用 migration
cd server && uv run alembic upgrade head

# 查看 migration 狀態
cd server && uv run alembic current
```

## 6. 部署

```bash
# 先執行診斷檢查
make doctor

# 執行完整測試套件
make test

# 建置前端
cd client && pnpm build
```

專案已設定為 Zeabur 部署。每個服務（server + client）都有各自的 `zbpack.json` 設定。

## 7. Claude Code 的加值功能

Claude Code 並非必要，但提供以下加速功能：

| 功能 | 不使用 Claude Code | 使用 Claude Code |
|------|-------------------|-----------------|
| 建立 Domain | `make new-domain NAME=x` | `/athena:domain notes --fields "title:string,body:text"` |
| 執行測試 | `make test` | `/athena:qa`（審查 + 測試 + 覆蓋率門檻） |
| 部署 | 手動步驟 | `/athena:deploy`（6 道關卡協定） |
| 程式碼審查 | 手動 | `/athena:qa --review-only` |
| 策略規劃 | 手動 | `/athena:plan` |
| 完整開發循環 | 手動步驟 | `/athena:loop`（推進 epic pipeline） |

AI 代理自動化工作流程，但永遠不會取代理解。先不使用 Claude Code 開始，準備好加速時再加入。

---

## 疑難排解

```bash
# 完整環境診斷
make doctor

# 僅檢查前置工具
make check-prereqs

# 重設資料庫
make db-stop && make db && cd server && uv run alembic upgrade head

# 重新產生 TypeScript 型別
cd client && pnpm generate:types
```

---

## 下一步

- **[第一個 Epic 實戰](first-epic-walkthrough.md)** — 一步步建立完整 Domain（無論是否使用 Claude Code 都適用）
- **[CI 流程說明](ci-explained.md)** — 了解每次推送時自動執行的檢查
- **[OpenAPI 設計模式](openapi-patterns.md)** — 學習本專案使用的 4 種 API 模式
- **[學習路徑](learning-path.md)** — 查看所有指南的推薦閱讀順序
