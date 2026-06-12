# SRE 可觀測性指南

> 如何閱讀 SLI 儀表板、處理 Sentry 事件、追蹤 `request_id` 全鏈路。模板開箱即用 — 不需要額外服務。

---

## 內建功能（E159）

| 層級 | 工具 | 檔案位置 |
|------|------|----------|
| 錯誤追蹤 | `@sentry/react`（瀏覽器）+ `sentry-sdk[fastapi]`（伺服器）| `client/src/observability/sentry.ts`、`server/app/observability/sentry.py` |
| 結構化日誌 | `structlog` JSON 渲染器 | `server/app/observability/logging.py` |
| 請求關聯 | `RequestIDMiddleware` | `server/app/observability/middleware.py` |
| 健康 SLI | `GET /admin/sli`（僅限超級使用者）+ `SystemHealthView` 儀表板 | `server/app/observability/sli.py`、`client/src/pages/dashboard/views/SystemHealthView.tsx` |
| 待辦：SRE CLI | 基於 Typer 的 `scripts/sre/` | 延後到後續 dispatch（E159 Part 5） |

---

## 必要的環境變數

```bash
# 伺服器端
ENVIRONMENT=production            # production | staging | development
SENTRY_DSN_SERVER=https://...     # 生產環境必填（缺失會啟動失敗）
GIT_SHA=$(git rev-parse --short HEAD)   # Sentry 釋出標籤，用於深層連結

# 用戶端（建置時烘焙 — 必須在 pnpm build 前設定）
VITE_SENTRY_DSN=https://...       # 瀏覽器 DSN（與伺服器使用不同 Sentry 專案）
VITE_GIT_SHA=$(git rev-parse --short HEAD)
```

生產環境若伺服器 DSN 為空，啟動會以清楚的訊息直接 crash — 這是刻意設計。
用戶端 DSN 為空時只會 `console.warn`（我們不希望因為 Sentry 故障就拒絕渲染整個 SPA）。

開發 / 測試環境若 DSN 為空則安靜 no-op。

---

## 閱讀 SLI 儀表板

打開應用、以超級使用者登入（預設種子帳號：`admin@test.com` / `Admin#Pass1`），
進入 **Dashboard → System Health**。每 30 秒自動刷新一次。

頁面包含兩組面板：

### 上層 — `/admin/health`（同步探測）

| 面板 | 顯示內容 | 警示閾值 |
|------|----------|----------|
| Database | 連線狀態 + ping 延遲 | latency > 50 ms 對健康池而言可疑 |
| Email Provider | 是否設定？哪一個（`console`/`mailgun`/`zeabur`）| 生產環境顯示 `Not configured` 等於靜默失敗 |
| OAuth Providers | 配置了哪些 provider | 若文宣有 OAuth 但這裡為空 = 警報 |
| Application | 版本、運行時間、環境 | 頻繁 uptime 重置代表 crash 或自動重新部署 |

### 下層 — `/admin/sli`（5 分鐘滾動聚合，行程內）

| 面板 | 顯示內容 | 處理門檻 |
|------|----------|----------|
| Success Rate (5m) | `(2xx + 3xx + 4xx) / total` | < 99% = 調查；持續 < 95% = 通知 on-call |
| Latency (5m) | 全部請求的 p50 / p95 | p95 > 500 ms 是金絲雀；> 1 s = 服務降級 |
| DB Connection Pool | size / checked-out / overflow | `checked_out` 接近 `size` = 飽和；`overflow` > 0 代表洩漏 |
| Release | 當前 `GIT_SHA` + 環境 | 健全檢查：最新部署是否真的生效 |
| Top Endpoints | 路徑 · count · success · p50 · p95 | 找出熱點與單一 endpoint 的回歸 |

> **注意** — SLI 快照是 **單副本、行程內** 的。1 個副本就是真相全貌；多副本時刷新幾次取樣不同副本，跨副本聚合請使用 Sentry / Zeabur 儀表板對應同名指標。

---

## 處理 Sentry 事件

事件抵達 Sentry 後：

1. 打開事件，`tags` 面板包含：
   - `release` — 發出事件的部署 `GIT_SHA`
   - `environment` — `production` / `staging` / `development`
2. **在 breadcrumbs（伺服器事件）或 contexts（瀏覽器事件）找出 `request_id`**。
   該請求的所有伺服器日誌共享此 ID。
3. 在結構化伺服器日誌搜尋此 ID：
   ```bash
   # 本地 docker-compose
   docker compose logs server | grep '"request_id":"<id>"'
   # Zeabur — 用儀表板的日誌搜尋框輸入字面 ID
   ```
4. 走時間線：HTTP 進入 → DB 呼叫 → response 狀態。每行的 `duration_ms` 告訴你哪一步慢。
5. 若 bug 在本地能復現，因為 `RequestIDMiddleware` 永遠開著，**同一個 `request_id` 流程** 在本地伺服器一樣有效。

---

## `request_id` 關聯契約

Middleware 位於 [`server/app/observability/middleware.py`](../../../server/app/observability/middleware.py)：

- 若用戶端傳入 `x-request-id` header 則使用，否則生成新 UUID v4。
- 將 ID 綁定到 `structlog.contextvars`，整個請求生命週期共享。
- 在 response `x-request-id` header 回傳。

用戶端通常不需主動設定此 header — 伺服器會自動生成。但若前端有自家追蹤系統想要關聯，
從 SPA 送出 `x-request-id`，伺服器會原樣保留。

`@debugger` agent 預期每份 bug 報告都附帶 `request_id`。這個 header 是我們最便宜的關聯介面，請務必使用。

---

## 預備（staging）vs 生產（production）

兩個 Zeabur 專案，使用同一份 `Dockerfile`：

| | Staging | Production |
|---|---------|-----------|
| `ENVIRONMENT` | `staging` | `production` |
| `SENTRY_DSN_SERVER` | 建議設定（獨立專案）| 必填 |
| `GIT_SHA` | 設定 | 設定 |
| Migration review | 第一站 — E157 review SQL 對 staging snapshot 執行 | staging 綠燈後才執行 |
| Sentry environment tag | `staging` | `production` |
| 受眾 | 團隊 | 終端使用者 |

`/athena:deploy staging` 路由到 staging 服務 ID（見 [`.claude/commands/athena/deploy.md`](../../../.claude/commands/athena/deploy.md)）。
若 staging 服務 ID 未設定，部署器會大聲報錯而非猜測目標。

---

## 日誌位置

| 位置 | 格式 | 適用場景 |
|------|------|----------|
| 本地終端（`uvicorn`）| structlog JSON to stdout | 開發迭代 |
| `docker compose logs server` | 同 JSON，捕獲 | 冒煙測試 |
| Zeabur 儀表板 → Logs | 同 JSON，可搜尋 | 生產環境 triage |
| Sentry → Issues | 已分組，含 breadcrumbs + tags | 錯誤面板 |
| `/admin/sli` | 滾動 SLI 快照 | 「系統現在還好嗎？」 |

跨上述所有來源的唯一關聯來源就是 `request_id`。

---

## 常見問題

**Q. success_rate_5m 顯示 100% 但我知道有錯誤。**
A. SLI 只把 5xx 算失敗。4xx（用戶端錯誤）是預期行為，會計為成功。若懷疑驗證有漏，
請看 top-endpoints 找出 4xx 比例異常的路徑。

**Q. checked_out 持續上升而且不歸零。**
A. 連線洩漏。在結構化日誌搜尋最慢 endpoint 的 request id，檢查每條程式路徑（特別是錯誤處理）
都有 await FastAPI 的 `get_db` 依賴。

**Q. Sentry release 顯示 `unknown`。**
A. 部署時沒設 `GIT_SHA`。在 Zeabur env 加上後重新部署。
用戶端要記得在 `pnpm build` **之前** 設定，因為 Vite 在建置期烘焙 `import.meta.env`。

**Q. 我能拿到跨副本的 SLI 嗎？**
A. 單靠 `/admin/sli` 不行 — 用 Zeabur 指標或 Sentry transactions 對應同名指標。
行程內快照的目的是 triage，不是計費。

---

## 後續工作 — SRE CLI（E159 Part 5）

`scripts/sre/` 中以 Typer 為基礎的 CLI 規劃在獨立 dispatch 完成：

- `sre logs tail <service>` — 依 request id 過濾並串流日誌
- `sre sli` — 抓取 `/admin/sli` 並美化輸出
- `sre deploy status` — Zeabur GraphQL 查詢
- `sre rollback <service>` — Zeabur 回滾（含確認）
- `sre alert test` — 發送 Sentry 測試事件

在 CLI 上線前，儀表板視圖 + Zeabur 日誌 + Sentry 是支援的介面。

---

## 檔案參考

- 伺服器：[`server/app/observability/`](../../../server/app/observability/)
- 用戶端：[`client/src/observability/sentry.ts`](../../../client/src/observability/sentry.ts)
- 儀表板：[`client/src/pages/dashboard/views/SystemHealthView.tsx`](../../../client/src/pages/dashboard/views/SystemHealthView.tsx)
- 規格：[`docs/epics/e159-sre-observability-platform.md`](../../epics/e159-sre-observability-platform.md)
- 部署路由：[`.claude/commands/athena/deploy.md`](../../../.claude/commands/athena/deploy.md)
