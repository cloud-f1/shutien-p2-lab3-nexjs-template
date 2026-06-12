# VRT 視覺回歸基準擷取指南（E211 — Phase B 完整矩陣）

> 本指南說明如何在**本機 dev-server** 上擷取與更新 Playwright 視覺回歸（VRT）基準快照。
> CI 目前為 `workflow_dispatch`-only（2026-05-20 刻意停用），**本流程不會重新啟用 CI**；
> 基準擷取一律在本機手動執行。

---

## 矩陣範圍

完整矩陣 = **14 個頁面 × 6 個主題 × 2 個 preset × 2 個視窗 = 336 格**，
外加少量**關鍵狀態快照**（表單驗證錯誤、無效 token、空清單等，僅 default 主題/preset/桌面視窗）。

- 公開頁面（10）：landing、getting-started、privacy、terms、404、signin、signup、forgot-password、reset-password、verify-email — **不需後端**。
- 儀表板頁面（4）：dashboard 的 overview / sessions / projects / settings — **需要登入（後端 session）**。

快照命名：`${page}--${theme}--${preset}--${viewport}.png`；狀態快照：`${page}--state-${state}.png`。
基準存放於 `client/e2e/__snapshots__/`。

---

## 前置作業（後端 session）

儀表板頁面的 96 格會「註冊 + 登入」真實使用者，因此必須有一個**可用的後端 session**。

### 1. 啟動 Postgres

```bash
make db          # docker compose up -d db（saas_user / saas_pass / saas_dev，localhost:5432）
```

### 2. 套用資料庫遷移

```bash
cd server && uv run alembic upgrade head
```

> 若你的 `server/.env` 的 `DATABASE_URL` 指向其他資料庫（fork 客製），請於此步驟與啟動後端時
> 以環境變數覆寫，例如：
> `DATABASE_URL='postgresql+asyncpg://saas_user:saas_pass@localhost:5432/saas_dev'`。
> 環境變數的優先序高於 `.env`，因此不需修改 fork 的 `.env`。

### 3. 啟動後端（uvicorn，port 8080）

```bash
cd server && uv run uvicorn app.main:app --port 8080
```

**重要 — 速率限制（rate limit）**：認證端點預設 `RATE_LIMIT_AUTH=15/minute`。
擷取時 96 格儀表板會**並行**地對 `/auth/register`、`/auth/jwt/login` 發出大量請求
（全部來自 `127.0.0.1`，共用同一個 rate-limit bucket），會迅速觸發 **429 → 前端顯示
「Sign in failed」→ 儀表板格全數失敗**。

擷取期間請將 rate limit 調高（僅供本機擷取，切勿用於正式環境）：

```bash
cd server && \
  RATE_LIMIT_AUTH='100000/minute' RATE_LIMIT_GENERAL='100000/minute' \
  DATABASE_URL='postgresql+asyncpg://saas_user:saas_pass@localhost:5432/saas_dev' \
  ALLOWED_ORIGINS_STR='http://localhost:3100,http://localhost:5173' \
  ENVIRONMENT=development \
  uv run uvicorn app.main:app --port 8080
```

> CORS：瀏覽器中的 client（`client/src/api/client.ts` 的 `baseURL` 預設 `http://localhost:8080`）
> 會以**跨來源**方式呼叫後端，因此 `ALLOWED_ORIGINS` 必須包含 e2e 的來源 `http://localhost:3100`
> （上面的 `ALLOWED_ORIGINS_STR` 已包含）。

---

## 擷取基準

後端 session 就緒後（`curl localhost:8080/health` 回 200），執行：

```bash
# 完整 336 格 + 狀態快照（Playwright 的 webServer 會自動啟動 :3100 的 Vite）
pnpm --filter client exec playwright test --project=visual --update-snapshots
```

只重新擷取部分（例如修正後僅補儀表板格）：

```bash
pnpm --filter client exec playwright test --project=visual --update-snapshots -g "dashboard"
```

---

## 審查與提交

1. 檢視 `client/e2e/__snapshots__/` 內新增 / 變更的 `.png`，確認是「**有意圖的設計變更**」而非回歸。
2. 基準只有在**刻意的設計調整**後才應重新產生 — 一般 PR 不應夾帶基準變動。
3. 將基準與相關程式變更一併提交。

驗證（不更新基準，比對既有基準）：

```bash
pnpm --filter client exec playwright test --project=visual
```

---

## 範圍外（Out of Scope）

- **不重新啟用 CI**：GitHub Actions 維持 `workflow_dispatch`-only；本流程純本機。
- **Phase C（漂移閘）**：在 pipeline 中自動以截圖差異阻擋 / 失敗，屬後續 epic，非本指南範圍。
- **無頭批次（headless batch）不適用**：`/athena:batch` 的 cron autopilot 沒有瀏覽器 / dev-server，
  無法擷取視覺基準 — 必須以本機手動 session 執行。

---

_對應 epic：E211（VRT Phase B）。a11y 矩陣的對應流程見 E212 與 `docs/design/A11Y_BASELINE.md`。_
