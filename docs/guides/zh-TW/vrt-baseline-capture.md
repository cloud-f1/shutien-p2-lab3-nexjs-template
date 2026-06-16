# VRT 視覺回歸基準擷取指南（E211 — Phase B 完整矩陣）

> 本指南說明如何在**本機 dev-server** 上擷取與更新 Playwright 視覺回歸（VRT）基準快照。
> CI 目前為 `workflow_dispatch`-only（2026-05-20 刻意停用），**本流程不會重新啟用 CI**；
> 基準擷取一律在本機手動執行。

---

## 矩陣範圍

完整矩陣 = **14 個頁面 × 6 個主題 × 2 個 preset × 2 個視窗 = 336 格**，
外加少量**關鍵狀態快照**（表單驗證錯誤、無效 token、空清單等，僅 default 主題/preset/桌面視窗）。

- 公開頁面（10）：landing、getting-started、privacy、terms、404、login、signup、forgot-password、reset-password、verify-email — **不需登入**。
- 儀表板頁面（4）：dashboard 的 overview / sessions / projects / settings — **需要登入（Auth.js session）**。

快照命名：`${page}--${theme}--${preset}--${viewport}.png`；狀態快照：`${page}--state-${state}.png`。
基準存放於 `next-app/e2e/__snapshots__/`。

---

## 前置作業（登入 session）

儀表板頁面的 96 格會以真實使用者登入，因此必須有一個**已 seed 的資料庫 session**。

### 1. 啟動完整本地堆疊（Postgres + app + mailpit）

```bash
docker compose up --build -d    # app 於 http://localhost:3000，mailpit 於 :8025
```

> 若你只想跑應用本身，也可從 `next-app/` 執行 `pnpm dev`（同樣是 http://localhost:3000），
> 並另外備妥一個 Postgres。

### 2. 套用資料庫遷移

```bash
cd next-app && pnpm db:migrate
```

> 若你的 `next-app/.env` 的 `DATABASE_URL` 指向其他資料庫（fork 客製），請確認該環境變數
> 已正確設定；環境變數的優先序高於 `.env`，因此不需修改 fork 的 `.env`。
> Drizzle/postgres-js 使用純 `postgresql://user:pass@host:port/db`（不含 `+asyncpg`）。

### 3. Seed demo 帳號

96 格儀表板會以 seed 出來的 demo 帳號登入，因此擷取前必須先 seed：

```bash
cd next-app && pnpm db:seed
```

> Demo 帳號（3-tier RBAC）：
> `admin@example.com / Admin123!`、`editor@example.com / Editor123!`、`viewer@example.com / Viewer123!`。
> 因為登入使用既有的 seed 帳號（而非每格都重新註冊），擷取時**不會**對 auth 路由產生大量重複請求，
> 也就沒有舊架構那種速率限制 / 429 問題。本應用是**單一同源** Next.js 服務（UI 與 Server Actions /
> Route Handlers 同源），擷取期間不需要額外的 CORS 設定。

---

## 擷取基準

dev-server 就緒後（瀏覽 `http://localhost:3000` 回 200、demo 帳號可登入），執行：

```bash
# 完整 336 格 + 狀態快照（Playwright 的 webServer 會自動啟動 :3000 的 Next.js dev-server）
cd next-app && pnpm test:e2e --project=visual --update-snapshots
```

只重新擷取部分（例如修正後僅補儀表板格）：

```bash
cd next-app && pnpm test:e2e --project=visual --update-snapshots -g "dashboard"
```

---

## 審查與提交

1. 檢視 `next-app/e2e/__snapshots__/` 內新增 / 變更的 `.png`，確認是「**有意圖的設計變更**」而非回歸。
2. 基準只有在**刻意的設計調整**後才應重新產生 — 一般 PR 不應夾帶基準變動。
3. 將基準與相關程式變更一併提交。

驗證（不更新基準，比對既有基準）：

```bash
cd next-app && pnpm test:e2e --project=visual
```

---

## 範圍外（Out of Scope）

- **不重新啟用 CI**：GitHub Actions 維持 `workflow_dispatch`-only；本流程純本機。
- **Phase C（漂移閘）**：在 pipeline 中自動以截圖差異阻擋 / 失敗，屬後續 epic，非本指南範圍。
- **無頭批次（headless batch）不適用**：`/athena:batch` 的 cron autopilot 沒有瀏覽器 / dev-server，
  無法擷取視覺基準 — 必須以本機手動 session 執行。

---

_對應 epic：E211（VRT Phase B）。a11y 矩陣的對應流程見 E212 與 `docs/design/A11Y_BASELINE.md`。_
