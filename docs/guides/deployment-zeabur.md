# Zeabur 部署指南 — Road 1 (Next.js 單服務)
# Zeabur Deployment Guide — Road 1 (Next.js Single Service)

> **適用版本 / Applies to:** Phase 54+ · `next-app/` monolith · Auth.js v5 · Drizzle ORM + PostgreSQL
>
> Road 1 = Zeabur 管理所有基礎設施（Next.js + PostgreSQL）。  
> Road 1 = Zeabur manages all infrastructure (Next.js + PostgreSQL).

---

## 目錄 / Table of Contents

1. [前置條件 / Prerequisites](#前置條件--prerequisites)
2. [建立 Zeabur 專案 / Create Zeabur Project](#建立-zeabur-專案--create-zeabur-project)
3. [新增 PostgreSQL 服務 / Add PostgreSQL Service](#新增-postgresql-服務--add-postgresql-service)
4. [部署 next-app 服務 / Deploy the next-app Service](#部署-next-app-服務--deploy-the-next-app-service)
5. [環境變數設定 / Environment Variables](#環境變數設定--environment-variables)
6. [⚠️ 關鍵：NEXT_PUBLIC_* 在建置時燒入 / Build-time NEXT_PUBLIC_* Gotcha](#️-關鍵next_public_-在建置時燒入--build-time-next_public_-gotcha)
7. [首次部署後：執行 migrate / First-Deploy Migration](#首次部署後執行-migrate--first-deploy-migration)
8. [自訂網域 / Custom Domain](#自訂網域--custom-domain)
9. [CLI 部署流程 / CLI Deploy Flow](#cli-部署流程--cli-deploy-flow)
10. [疑難排解 / Troubleshooting](#疑難排解--troubleshooting)

---

## 前置條件 / Prerequisites

| 項目 | 說明 | Item | Notes |
|------|------|------|-------|
| Zeabur 帳號 | https://zeabur.com — 免費方案即可開始 | Zeabur account | Free plan works to start |
| Zeabur CLI | `npm i -g @zeabur/cli` （v0.18.0+） | Zeabur CLI | `npm i -g @zeabur/cli` (v0.18.0+) |
| `AUTH_SECRET` | `openssl rand -base64 32` 產生 | `AUTH_SECRET` | Generate with `openssl rand -base64 32` |
| GitHub repo | 推送至 GitHub（Zeabur 從 repo 拉取原始碼） | GitHub repo | Push to GitHub (Zeabur pulls source) |

---

## 建立 Zeabur 專案 / Create Zeabur Project

### 方式 A：Dashboard（推薦新手 / Recommended for beginners）

1. 登入 https://zeabur.com/dashboard
2. 點擊 **Create Project** → 輸入專案名稱（例如 `my-saas`）
3. 選擇 Region（建議 `ap-east` 亞洲或 `us-west` 美西）
4. 建立後進入空白 Project canvas

### 方式 B：CLI

```bash
zeabur login          # 開啟瀏覽器授權 / opens browser auth
zeabur project create --name my-saas --region ap-east
```

---

## 新增 PostgreSQL 服務 / Add PostgreSQL Service

### Dashboard

1. 在 Project canvas 點擊 **Add Service**
2. 選擇 **Marketplace** → 搜尋 **PostgreSQL** → 點擊安裝
3. Zeabur 自動啟動 PostgreSQL 並產生 `DATABASE_URL`（格式：`postgresql://...`）
4. 點擊 PostgreSQL 服務 → **Variables** 分頁 → 複製 `DATABASE_URL` 的值

> **注意 / Note:** Zeabur 的 `DATABASE_URL` 格式為 `postgresql://user:pass@host:5432/db`，  
> 與 Drizzle ORM 相容，直接使用不需轉換。  
> The format is compatible with Drizzle ORM — use it as-is.

### CLI

```bash
zeabur service create --name postgres --template postgresql
# 等候 30 秒讓 DB 初始化 / wait ~30s for DB to initialize
zeabur service env list --service postgres
# 複製輸出中的 DATABASE_URL / copy DATABASE_URL from output
```

---

## 部署 next-app 服務 / Deploy the next-app Service

本 repo 的 `next-app/` 包含 `Dockerfile`（多階段建置，產出 `.next/standalone`）。  
Zeabur 支援直接使用 Dockerfile 或 zbpack 自動偵測。  
The `next-app/` directory contains a multi-stage `Dockerfile` that outputs `.next/standalone`.

### Dashboard — 從 GitHub 部署

1. Project canvas → **Add Service** → **GitHub**
2. 選擇你的 repo → **Root Directory** 填入 `next-app`
3. Zeabur 偵測到 `Dockerfile` 後自動使用它建置
4. 若要強制使用 Dockerfile：Service Settings → **Build Method** → `Dockerfile`

### CLI

```bash
cd next-app
zeabur deploy --name next-app --root next-app
# 或從 repo 根目錄：
zeabur deploy --name next-app --root ./next-app
```

> `zbpack.json`（E254 新增）可讓 Zeabur zbpack 自動偵測 Node/pnpm 並跳過 Dockerfile。  
> 若 `zbpack.json` 與 `Dockerfile` 並存，Zeabur 優先使用 Dockerfile。  
> If both `zbpack.json` and `Dockerfile` exist, Zeabur prefers the Dockerfile.

---

## 環境變數設定 / Environment Variables

在 Zeabur dashboard → next-app 服務 → **Variables** 分頁設定以下變數，  
或使用 CLI `zeabur env set`。  
Set these in Zeabur dashboard → next-app service → **Variables** tab, or via CLI.

### 必填 / Required

| 變數 | 範例值 / Example | 說明 |
|------|-----------------|------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | 從 PostgreSQL 服務複製 / Copy from the PostgreSQL service |
| `AUTH_SECRET` | `openssl rand -base64 32` 輸出 | Auth.js v5 JWT 簽名金鑰，至少 32 字元 / JWT signing key, min 32 chars |
| `AUTH_URL` | `https://your-app.zeabur.app` | 你的 Zeabur 或自訂網域（含 `https://`）/ Your domain (with `https://`) |
| `AUTH_TRUST_HOST` | `true` | Auth.js v5 在反向代理後必須設 true / Required when behind reverse proxy |

### 選填 / Optional

| 變數 | 預設 / Default | 說明 |
|------|---------------|------|
| `NODE_ENV` | `production` | Zeabur 通常自動設定 / Usually set automatically |
| `NEXT_TELEMETRY_DISABLED` | `1` | 關閉 Next.js 遙測 / Disable Next.js telemetry |

### CLI 批次設定

```bash
zeabur env set \
  DATABASE_URL="postgresql://user:pass@host:5432/db" \
  AUTH_SECRET="$(openssl rand -base64 32)" \
  AUTH_URL="https://your-app.zeabur.app" \
  AUTH_TRUST_HOST="true" \
  --service next-app
```

---

## ⚠️ 關鍵：NEXT_PUBLIC_* 在建置時燒入 / Build-time NEXT_PUBLIC_* Gotcha

**這是最常見的錯誤來源。請仔細閱讀。**  
**This is the #1 source of first-deploy failures. Read carefully.**

### 原理 / How it works

`NEXT_PUBLIC_*` 變數在 `next build` 執行時被靜態內嵌進 JavaScript bundle，  
**不是**在 runtime 讀取。這代表：  
`NEXT_PUBLIC_*` variables are statically inlined into the JavaScript bundle during `next build`,  
**not** at runtime. This means:

- 必須在 Zeabur **觸發建置之前**設定好 `NEXT_PUBLIC_*` 變數  
  You must set `NEXT_PUBLIC_*` variables **before** triggering a build in Zeabur
- 如果建置後才修改這些值，**需要重新觸發建置**才能生效（重新啟動服務無效）  
  Changing them after build requires a **rebuild** to take effect (restarting the service does nothing)
- `DATABASE_URL`、`AUTH_SECRET` 等無 `NEXT_PUBLIC_` 前綴的變數是 runtime 讀取，不受此限制  
  Runtime-only vars like `DATABASE_URL`, `AUTH_SECRET` are read at runtime and are not affected

### 本 repo 的 NEXT_PUBLIC_* 變數 / NEXT_PUBLIC_* variables in this repo

| 變數 | 功能 | 注意 |
|------|------|------|
| `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` | 顯示 Admin/Editor/Viewer 快速登入按鈕 | 正式環境設 `false` 移除演示帳號入口 |
| `NEXT_PUBLIC_APP_URL` | 公開站台 base URL（email 驗證/重設連結、ECPay 金流 callback） | **必須設為部署網域**，否則 email 連結與付款 callback 會指向 `localhost:3000`。`next-app/Dockerfile` 以 `ARG NEXT_PUBLIC_APP_URL` 接收。/ Must be the deploy domain or email links + payment callbacks bake `localhost:3000`. |

```bash
# 設定範例 / Example
# 正式環境：關閉 demo 登入 + 設定公開 URL / Production: disable demo login + set public URL
zeabur env set \
  NEXT_PUBLIC_ENABLE_DEMO_LOGIN="false" \
  NEXT_PUBLIC_APP_URL="https://your-app.zeabur.app" \
  --service next-app

# 設定完成後，重新觸發建置（NEXT_PUBLIC_* 在建置時燒入）/ After setting, trigger a rebuild:
zeabur service redeploy --service next-app
```

### 正確流程 / Correct workflow

```
1. 在 Zeabur Variables 設定所有 NEXT_PUBLIC_* 變數
   Set all NEXT_PUBLIC_* variables in Zeabur Variables
        ↓
2. 觸發建置（push commit 或 Redeploy）
   Trigger build (push a commit or click Redeploy)
        ↓
3. 建置完成後，NEXT_PUBLIC_* 的值已燒入 bundle
   After build, NEXT_PUBLIC_* values are baked into the bundle
        ↓
4. 若需修改 NEXT_PUBLIC_*，重複步驟 1-3
   To change NEXT_PUBLIC_*, repeat steps 1-3
```

---

## 首次部署後：執行 migrate / First-Deploy Migration

應用程式啟動前需要先建立資料庫 schema。  
The database schema must be created before the app can start.

> **⚠️ 映像 devDeps 注意 / Image devDeps caveat:** `pnpm db:migrate` 需要 `drizzle-kit`、`pnpm db:seed` 需要 `tsx` —— 兩者都是 **devDependencies**。如果 Zeabur 直接用 `next-app/Dockerfile` 建置，執行期映像是 `runner` stage（Next.js standalone），**不含** devDependencies，`zeabur exec ... pnpm db:migrate` 會出現 `drizzle-kit: not found`。
> 若使用 Dockerfile 建置，請改用 **方式 A 的 Pre-deploy Command**（在 build context 中跑，仍有 devDeps），或先用 zbpack（Node build，保留 devDeps）；GCP 路線的對應做法是用 `--target builder` 另建 migrate 映像（見 `deployment-gcp.md` §6）。
>
> `pnpm db:migrate` needs `drizzle-kit` and `pnpm db:seed` needs `tsx` — both are **devDependencies**. If Zeabur builds from `next-app/Dockerfile`, the runtime image is the `runner` stage (Next.js standalone) which does **NOT** ship devDependencies, so `zeabur exec ... pnpm db:migrate` fails with `drizzle-kit: not found`. Use the **Pre-deploy Command (方式 A)** which runs in the build context (devDeps still present), or a zbpack build. The GCP equivalent is a separate `--target builder` migrate image (see `deployment-gcp.md` §6).

### 方式 A：Zeabur 一次性任務（推薦 / Recommended）

Zeabur 支援在服務旁執行一次性指令（Run Command）：

1. next-app 服務 → **Settings** → **Commands**
2. 在 **Pre-deploy Command** 或 **One-time Command** 欄位輸入：

```bash
node -e "require('child_process').execSync('pnpm db:migrate', {stdio:'inherit', cwd:'/app'})"
```

或直接使用（若 Zeabur shell 可用）：

```bash
pnpm db:migrate
```

### 方式 B：CLI 執行遠端指令

```bash
zeabur exec --service next-app -- pnpm db:migrate
```

### 方式 C：Dockerfile ENTRYPOINT（進階 / Advanced）

若要在每次容器啟動時自動 migrate（冪等安全），可修改 `next-app/Dockerfile` 最後幾行：

```dockerfile
# 建立 entrypoint script
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
CMD ["./docker-entrypoint.sh"]
```

```bash
# next-app/docker-entrypoint.sh
#!/bin/sh
set -e
pnpm db:migrate
exec node server.js
```

> **注意 / Note:** `pnpm db:migrate` 執行 Drizzle Kit migrations（`drizzle-kit migrate`），  
> 每次執行前會先檢查已套用的 migrations，因此重複執行安全。  
> `pnpm db:migrate` runs Drizzle Kit migrations and is idempotent — safe to run on every start.

### 選填：seed 演示資料 / Optional: seed demo data

```bash
zeabur exec --service next-app -- pnpm db:seed
# 建立 admin@example.com / Admin123! + editor@example.com / Editor123! + viewer@example.com / Viewer123!
# Creates demo accounts: admin, editor, viewer
```

---

## 自訂網域 / Custom Domain

### Dashboard

1. next-app 服務 → **Networking** 分頁
2. 點擊 **Add Domain** → 輸入你的網域（例如 `app.yourdomain.com`）
3. Zeabur 顯示 CNAME 記錄，至你的 DNS 供應商新增：
   ```
   CNAME  app  →  your-app.zeabur.app
   ```
4. DNS 傳播後（通常 < 5 分鐘），Zeabur 自動簽發 TLS 憑證

### CLI

```bash
zeabur domain add --service next-app --domain app.yourdomain.com
# 輸出 CNAME 目標 / outputs CNAME target
```

### 更新 AUTH_URL

自訂網域設定後，**務必更新** `AUTH_URL`：

```bash
zeabur env set AUTH_URL="https://app.yourdomain.com" --service next-app
zeabur service redeploy --service next-app
```

> `AUTH_URL` 是 runtime 變數（無 `NEXT_PUBLIC_` 前綴），更新後重新啟動即生效，  
> **不需**重新建置。  
> `AUTH_URL` is a runtime variable — restart is sufficient, no rebuild needed.

---

## CLI 部署流程 / CLI Deploy Flow

完整從 0 到上線的 CLI 流程：  
Full zero-to-live CLI workflow:

```bash
# 0. 安裝 CLI / Install CLI
npm install -g @zeabur/cli

# 1. 登入 / Login
zeabur login

# 2. 建立專案 / Create project
zeabur project create --name my-saas --region ap-east

# 3. 新增 PostgreSQL / Add PostgreSQL
zeabur service create --template postgresql --name postgres

# 4. 取得 DATABASE_URL / Get DATABASE_URL
DB_URL=$(zeabur env get DATABASE_URL --service postgres)

# 5. 部署 next-app（從 repo root）/ Deploy next-app (from repo root)
zeabur deploy --name next-app --root ./next-app

# 6. 設定環境變數 / Set env vars
APP_DOMAIN="https://$(zeabur service domain --service next-app)"
zeabur env set \
  DATABASE_URL="$DB_URL" \
  AUTH_SECRET="$(openssl rand -base64 32)" \
  AUTH_URL="$APP_DOMAIN" \
  AUTH_TRUST_HOST="true" \
  NEXT_PUBLIC_APP_URL="$APP_DOMAIN" \
  NEXT_PUBLIC_ENABLE_DEMO_LOGIN="false" \
  --service next-app

# 7. 重新建置（讓 NEXT_PUBLIC_* 生效）/ Rebuild (to bake NEXT_PUBLIC_*)
zeabur service redeploy --service next-app

# 8. 等候建置完成後執行 migrate / Wait for build, then migrate
zeabur exec --service next-app -- pnpm db:migrate

# 9. （選填）seed 演示資料 / (Optional) seed demo data
zeabur exec --service next-app -- pnpm db:seed

# 10. 驗證 / Verify
curl -I "https://$(zeabur service domain --service next-app)"
```

---

## 疑難排解 / Troubleshooting

### 應用程式啟動失敗：`DATABASE_URL` 未設定

```
Error: DATABASE_URL is not set
```

**解決 / Fix:** 確認 Variables 分頁中 `DATABASE_URL` 已設定且格式正確（以 `postgresql://` 開頭）。  
Check that `DATABASE_URL` is set and starts with `postgresql://`.

---

### Auth 錯誤：`[auth][error] UntrustedHost`

```
[auth][error] UntrustedHost: Host must be trusted.
```

**解決 / Fix:** 設定 `AUTH_TRUST_HOST=true`，因為 Zeabur 使用反向代理。  
Set `AUTH_TRUST_HOST=true` — Zeabur sits behind a reverse proxy.

---

### 登入後跳轉到錯誤網域

**原因 / Cause:** `AUTH_URL` 設定的網域與實際存取網域不符。  
**解決 / Fix:** 確認 `AUTH_URL` 與你在瀏覽器輸入的 URL 完全一致（含 `https://`，不含尾部 `/`）。  
Ensure `AUTH_URL` exactly matches the URL in your browser (include `https://`, no trailing slash).

---

### `NEXT_PUBLIC_*` 修改後沒有生效

**原因 / Cause:** `NEXT_PUBLIC_*` 在建置時燒入，重新啟動服務無法更新。  
**解決 / Fix:** 修改變數後，點擊 **Redeploy** 觸發完整重新建置。  
After changing `NEXT_PUBLIC_*`, click **Redeploy** to trigger a full rebuild.

---

### Drizzle migrate 失敗：`relation already exists`

這通常表示部分 migrations 已套用。Drizzle Kit 記錄每個 migration 的狀態，  
重複執行 `pnpm db:migrate` 是安全的（冪等操作）。  
This means some migrations are already applied. Drizzle Kit tracks migration state;  
running `pnpm db:migrate` again is safe (idempotent).

---

### Mac 本機建置的 Docker image 無法在 Zeabur 執行

**原因 / Cause:** Mac 預設建置 ARM64 image，Zeabur 執行 amd64。  
**解決 / Fix:** 讓 Zeabur 直接從 GitHub 建置（不要推送本機 image），  
或使用 `docker buildx build --platform linux/amd64`。  
Let Zeabur build directly from GitHub, or use `docker buildx build --platform linux/amd64`.

---

## 自動化 / 無人值守部署 / Automated (Headless) Deploy

For CI pipelines or automated fork setup, use the **zeabur-deploy** skill which encodes the
exact non-interactive CLI flow and all five gotchas (dotfile uploader, deprecated marketplace,
standalone runtime, NEXT_PUBLIC bake order, env-then-redeploy ordering):

```
→ .claude/skills/zeabur-deploy/SKILL.md  (invoke /zeabur-deploy in Claude Code)
```

The skill covers dedicated-server targeting (`zeabur server list --json -i=false`), provisioning
PostgreSQL via template B20CX0 (not the deprecated marketplace), and migrating from your local
machine against the public endpoint (since the standalone runtime has no drizzle-kit).

---

## 相關文件 / Related Documents

| 文件 | 說明 |
|------|------|
| `next-app/Dockerfile` | 多階段 Docker 建置設定 / Multi-stage Docker build |
| `next-app/drizzle.config.ts` | Drizzle ORM 設定 / Drizzle ORM config |
| `docs/guides/deployment.md` | 部署總覽（多平台）/ Deployment overview (multi-platform) |
| `deploy/README.md` | 舊版部署說明（已過時）/ Legacy deploy docs (superseded) |
| `.claude/skills/zeabur-deploy/SKILL.md` | 無人值守 CLI 流程 + 5 個常見錯誤 / Headless CLI flow + 5 gotchas |
| [Zeabur 官方文件](https://zeabur.com/docs) | Zeabur 官方參考 / Zeabur official reference |
