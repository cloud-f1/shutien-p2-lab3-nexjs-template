# E19: Session Cleanup & Observability — Spec

> **Epic**: E19 | **Size**: M | **Dependencies**: none
> **Created**: 2026-03-13

---

## 1. 問題描述

### 1.1 過期 Session 累積

`sessions` 資料表中的記錄只會被「撤銷」（`is_revoked = True`），但從不刪除。隨時間推移，過期與撤銷的 session 會無限累積，造成：

- 資料庫儲存空間浪費
- `list_sessions` 查詢因表膨脹而變慢
- `token_hash` 索引效率下降

目前狀態：`Session` model 有 `expires_at` 與 `is_revoked` 欄位，但無任何清理機制。

### 1.2 缺乏結構化日誌

現有日誌情況：
- `audit.py` 使用 `logging.getLogger("audit")` 發送認證事件，但格式為純文字
- `health.py` 使用 `logging.getLogger(__name__)` — 唯一有 logger 的端點模組
- `places.py`、`portfolios.py`、`sessions.py` 完全沒有 logger
- 無 request correlation ID，跨日誌條目難以追蹤同一請求
- 日誌格式與 Sentry breadcrumbs 不相容

---

## 2. 設計方案

### 2.1 Session 清理

#### 策略：FastAPI lifespan + 定期背景任務

使用 FastAPI 的 `lifespan` context manager 啟動一個 `asyncio.Task`，每隔固定間隔（預設 1 小時）執行一次批次刪除。

```python
# server/app/tasks/session_cleanup.py

async def purge_expired_sessions(session_factory) -> int:
    """刪除所有過期或已撤銷超過保留期的 session。回傳刪除數量。"""
    async with session_factory() as db:
        cutoff = datetime.now(timezone.utc) - timedelta(days=settings.SESSION_RETENTION_DAYS)
        result = await db.execute(
            delete(Session).where(
                or_(
                    Session.expires_at < datetime.now(timezone.utc),
                    and_(Session.is_revoked.is_(True), Session.updated_at < cutoff),
                )
            )
        )
        await db.commit()
        return result.rowcount

async def cleanup_loop(session_factory, interval_seconds: int):
    """在背景中持續執行清理循環。"""
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            count = await purge_expired_sessions(session_factory)
            logger.info("session_cleanup", extra={"purged_count": count})
        except Exception:
            logger.exception("session_cleanup_error")
```

#### 新增設定值（`config.py`）

| 設定名稱 | 預設值 | 說明 |
|----------|--------|------|
| `SESSION_CLEANUP_INTERVAL_MINUTES` | `60` | 清理間隔（分鐘） |
| `SESSION_RETENTION_DAYS` | `7` | 已撤銷 session 保留天數（過期的立即刪除） |

#### Lifespan 整合（`main.py`）

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: launch cleanup task
    task = asyncio.create_task(
        cleanup_loop(async_session_factory, settings.SESSION_CLEANUP_INTERVAL_MINUTES * 60)
    )
    yield
    # Shutdown: cancel cleanup task
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task

app = FastAPI(..., lifespan=lifespan)
```

### 2.2 結構化日誌

#### 2.2.1 JSON 日誌格式器

建立統一的 JSON 格式 logging 配置，所有日誌輸出結構化 JSON，與 Sentry breadcrumbs 相容。

```python
# server/app/core/logging_config.py

import json
import logging
import sys
from datetime import datetime, timezone

class JSONFormatter(logging.Formatter):
    """JSON log formatter compatible with Sentry breadcrumbs."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
        }
        # Merge extra fields (correlation_id, user_id, etc.)
        for key in ("correlation_id", "user_id", "method", "path",
                     "status_code", "duration_ms", "event", "ip",
                     "success", "detail", "purged_count"):
            value = getattr(record, key, None)
            if value is not None:
                log_entry[key] = value
        # Exception info
        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry, default=str)

def setup_logging():
    """Configure root logger with JSON formatter."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)
    # Quiet noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
```

#### 2.2.2 Request Correlation ID 中介層

為每個 HTTP 請求產生唯一 correlation ID，注入 response header 與 logging context。

```python
# server/app/middleware/correlation.py

import uuid
import contextvars
from starlette.middleware.base import BaseHTTPMiddleware

correlation_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "correlation_id", default=""
)

class CorrelationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        # Accept client-provided ID or generate new
        cid = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
        correlation_id_var.set(cid)
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = cid
        return response
```

#### 2.2.3 Request Logging 中介層

記錄每個請求的 method、path、status code、duration，並包含 correlation ID。

```python
# server/app/middleware/request_logging.py

import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from app.middleware.correlation import correlation_id_var

logger = logging.getLogger("http")

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.monotonic()
        response = await call_next(request)
        duration_ms = round((time.monotonic() - start) * 1000, 2)
        logger.info(
            "request_completed",
            extra={
                "correlation_id": correlation_id_var.get(""),
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            },
        )
        return response
```

#### 2.2.4 端點 Logger 實例

在以下模組頂部加入 `logger = logging.getLogger(__name__)`，並在關鍵操作處加入日誌：

| 模組 | 現有 Logger | 新增日誌點 |
|------|-------------|-----------|
| `auth.py` | 透過 `audit.py` | 加入 `logger`，記錄 register/verify/reset 操作 |
| `sessions.py` | 無 | 加入 `logger`，記錄 list/revoke 操作 |
| `places.py` | 無 | 加入 `logger`，記錄 CRUD 操作與 nearby 查詢 |
| `portfolios.py` | 無 | 加入 `logger`，記錄 CRUD + membership + analytics 操作 |
| `health.py` | `logging.getLogger(__name__)` ✅ | 已有，無需變更 |

#### 2.2.5 Audit Logger 升級

`audit.py` 中的 `log_auth_event` 將自動受益於 JSON formatter，因為它已使用 `extra` dict。唯一變更：注入 `correlation_id`。

```python
# audit.py — 在 log_auth_event 中增加
from app.middleware.correlation import correlation_id_var

# 在 extra dict 中加入：
"correlation_id": correlation_id_var.get(""),
```

### 2.3 Sentry Breadcrumbs 相容性

JSON 日誌格式天然與 Sentry 的 breadcrumb 採集相容：
- `timestamp` — ISO 8601 格式
- `level` — 標準 Python logging level name
- `message` — 事件描述
- `data` — 其他結構化欄位（correlation_id, user_id 等）

Sentry SDK 的 `logging` integration 會自動將 `logging.info/warning/error` 轉為 breadcrumbs。無需額外配置，只需確保 `sentry_sdk.init()` 中未停用 `LoggingIntegration`。

---

## 3. 需修改/建立的檔案

### 新增檔案

| 檔案 | 用途 |
|------|------|
| `server/app/tasks/__init__.py` | Tasks 套件 |
| `server/app/tasks/session_cleanup.py` | 過期 session 清理邏輯 |
| `server/app/core/logging_config.py` | JSON formatter + `setup_logging()` |
| `server/app/middleware/correlation.py` | Correlation ID 中介層 |
| `server/app/middleware/request_logging.py` | Request logging 中介層 |

### 修改檔案

| 檔案 | 變更內容 |
|------|---------|
| `server/app/core/config.py` | 新增 `SESSION_CLEANUP_INTERVAL_MINUTES`、`SESSION_RETENTION_DAYS` 設定 |
| `server/app/main.py` | 加入 `lifespan`、掛載 correlation + request logging 中介層、呼叫 `setup_logging()` |
| `server/app/core/audit.py` | 注入 `correlation_id` 到 log extra |
| `server/app/api/v1/endpoints/auth.py` | 加入 `logger` 實例 + 操作日誌 |
| `server/app/api/v1/endpoints/sessions.py` | 加入 `logger` 實例 + 操作日誌 |
| `server/app/api/v1/endpoints/places.py` | 加入 `logger` 實例 + 操作日誌 |
| `server/app/api/v1/endpoints/portfolios.py` | 加入 `logger` 實例 + 操作日誌 |

### 不變更

| 檔案 | 原因 |
|------|------|
| `server/app/api/v1/endpoints/health.py` | 已有 logger，無需變更 |
| `server/app/models/session.py` | Model 不變 — 清理依據現有 `expires_at` 與 `is_revoked` 欄位 |
| `docs/openapi/` | 無新 API 端點 — 清理為內部任務 |

---

## 4. 中介層順序

`main.py` 中中介層的掛載順序（由外到內）：

```
1. CorrelationMiddleware     ← 最外層，產生 correlation_id
2. RequestLoggingMiddleware  ← 記錄完整 request 生命週期
3. SecurityHeadersMiddleware ← 現有
4. CORSMiddleware            ← 現有
5. SlowAPI (rate limiter)    ← 現有
```

FastAPI/Starlette 中介層以 LIFO 順序執行，因此最後加入的最先執行。程式碼中需反序掛載。

---

## 5. 測試計畫

### 5.1 Session 清理測試

| 測試 | 說明 | 檔案 |
|------|------|------|
| `test_purge_expired_sessions` | 建立已過期 session，呼叫 `purge_expired_sessions`，驗證已刪除 | `tests/test_session_cleanup.py` |
| `test_purge_revoked_beyond_retention` | 建立已撤銷超過保留期的 session，驗證已刪除 | 同上 |
| `test_keep_active_sessions` | 建立未過期且未撤銷的 session，驗證保留 | 同上 |
| `test_keep_recently_revoked` | 建立剛撤銷的 session（在保留期內），驗證保留 | 同上 |
| `test_cleanup_loop_runs` | Mock `purge_expired_sessions`，啟動 `cleanup_loop`，驗證被呼叫 | 同上 |
| `test_cleanup_loop_handles_error` | Mock 拋出例外，驗證迴圈繼續運行不崩潰 | 同上 |

### 5.2 Logging 測試

| 測試 | 說明 | 檔案 |
|------|------|------|
| `test_json_formatter_output` | 驗證 `JSONFormatter.format()` 回傳合法 JSON，包含必要欄位 | `tests/test_logging.py` |
| `test_json_formatter_extras` | 驗證 extra fields（correlation_id 等）正確出現在 JSON 中 | 同上 |
| `test_json_formatter_exception` | 驗證含 exc_info 的 log 記錄包含 `exception` 欄位 | 同上 |

### 5.3 Correlation ID 測試

| 測試 | 說明 | 檔案 |
|------|------|------|
| `test_correlation_id_generated` | 不送 header，驗證 response 含 `X-Correlation-ID` | `tests/test_correlation.py` |
| `test_correlation_id_passthrough` | 送 `X-Correlation-ID` header，驗證 response 回傳同值 | 同上 |
| `test_correlation_id_in_logs` | 發送請求，擷取 log 輸出，驗證 `correlation_id` 欄位存在 | 同上 |

### 5.4 Request Logging 測試

| 測試 | 說明 | 檔案 |
|------|------|------|
| `test_request_log_fields` | 發送 GET /health，擷取 log，驗證含 method/path/status_code/duration_ms | `tests/test_request_logging.py` |
| `test_request_log_error_status` | 發送會回傳 404 的請求，驗證 log 正確記錄 status_code | 同上 |

### 5.5 Audit Logger 整合測試

| 測試 | 說明 | 檔案 |
|------|------|------|
| `test_audit_log_contains_correlation_id` | 在有 correlation context 下呼叫 `log_auth_event`，驗證 correlation_id 存在 | `tests/test_audit.py` |

### 5.6 覆蓋率目標

- 所有新程式碼覆蓋率 >= 80%
- 整體 server 測試套件覆蓋率維持 >= 80%

---

## 6. 實作順序

1. **`logging_config.py`** — JSON formatter + `setup_logging()`
2. **`correlation.py`** — Correlation ID 中介層
3. **`request_logging.py`** — Request logging 中介層
4. **`session_cleanup.py`** — 清理邏輯 + 背景迴圈
5. **`config.py`** — 新增設定值
6. **`main.py`** — 整合 lifespan + 中介層 + `setup_logging()`
7. **`audit.py`** — 注入 correlation_id
8. **端點模組** — 加入 logger 實例與日誌點
9. **測試** — 依上述測試計畫撰寫

---

## 7. 風險與注意事項

| 風險 | 對策 |
|------|------|
| 中介層順序錯誤導致 correlation_id 未注入 | 測試驗證 + 明確文件化順序 |
| 清理任務在測試中干擾 | 測試不啟動 lifespan 背景任務；直接測試 `purge_expired_sessions` 函式 |
| `BaseHTTPMiddleware` 與 streaming responses 不相容 | 本專案無 streaming 端點，風險極低。若未來需要，可改用 raw ASGI middleware |
| JSON 日誌在本地開發時不易閱讀 | 可考慮依 `settings.DEBUG` 切換 formatter（DEBUG=True 時用 human-readable 格式） |
| `contextvars` 在 asyncio task 間共享 | `ContextVar` 在 asyncio 中正確隔離每個 task，無風險 |
