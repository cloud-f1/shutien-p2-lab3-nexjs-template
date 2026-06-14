# GCP Cloud Run + Cloud SQL — Deployment Runbook (Road 2)
# GCP Cloud Run + Cloud SQL — 部署手冊（Road 2）

> **Road 2**: Deploy `next-app/` to **Google Cloud Run** backed by **Cloud SQL (Postgres)**, with secrets in **Secret Manager** and images in **Artifact Registry**.
>
> **Road 2**：將 `next-app/` 部署至 **Google Cloud Run**，搭配 **Cloud SQL（Postgres）** 資料庫、**Secret Manager** 密鑰管理與 **Artifact Registry** 容器倉庫。

**Prerequisites / 前置條件**

| Tool / 工具 | Version / 版本 | Purpose / 用途 |
|-------------|----------------|----------------|
| `gcloud` CLI | >= 468 | All GCP operations / 所有 GCP 操作 |
| Docker | Latest | Local image build (optional) / 本機建置（可選） |
| `psql` | Any | Verify DB (optional) / 驗證資料庫（可選） |

---

## 0. Variables — Set These First / 變數設定（先設定這些）

All commands below use shell variables so you can copy-paste without editing.
以下所有指令皆使用 shell 變數，可直接複製貼上，無需手動替換。

```bash
# ── GCP project & region / GCP 專案與區域 ──────────────────────────────────
export PROJECT_ID="${PROJECT_ID}"        # e.g. my-saas-prod
export REGION="${REGION}"                # e.g. asia-east1 or us-central1

# ── Artifact Registry ──────────────────────────────────────────────────────
export AR_REPO="${AR_REPO}"              # e.g. saas-images / 例：saas-images
export IMAGE_NAME="next-app"
export IMAGE_TAG="latest"               # or $(git rev-parse --short HEAD)
export IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/${IMAGE_NAME}:${IMAGE_TAG}"

# ── Cloud Run ──────────────────────────────────────────────────────────────
export SERVICE_NAME="${SERVICE_NAME}"    # e.g. saas-web / 例：saas-web

# ── Cloud SQL ─────────────────────────────────────────────────────────────
export INSTANCE="${INSTANCE}"            # e.g. saas-db / 例：saas-db
export DB_NAME="${DB_NAME}"              # e.g. saas / 例：saas
export DB_USER="${DB_USER}"              # e.g. saas_user / 例：saas_user
# Full connection name — used in --add-cloudsql-instances
export SQL_CONN="${PROJECT_ID}:${REGION}:${INSTANCE}"
```

> **Tip / 提示**: Add these exports to a `.env.gcp` file and `source .env.gcp` at the start of each session. Do NOT commit this file.
> 建議將這些 export 放入 `.env.gcp` 並在每次作業前執行 `source .env.gcp`。請勿提交此檔案。

---

## 1. Project Setup & Enable APIs / 專案設定與啟用 API

```bash
# Authenticate & set project / 驗證並設定專案
gcloud auth login
gcloud config set project "${PROJECT_ID}"

# Enable required APIs / 啟用所需 API
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com

# Create Artifact Registry repo (one-time) / 建立 Artifact Registry 倉庫（一次性）
gcloud artifacts repositories create "${AR_REPO}" \
  --repository-format=docker \
  --location="${REGION}" \
  --description="SaaS app images"

# Configure Docker auth for Artifact Registry / 設定 Docker 認證
gcloud auth configure-docker "${REGION}-docker.pkg.dev"
```

---

## 2. Build & Push Image to Artifact Registry / 建置並推送映像

### Option A: `gcloud run deploy --source` (Simplest) / 最簡單方法

Cloud Build handles Docker build + push automatically.
由 Cloud Build 自動完成 Docker 建置與推送。

```bash
# Run from the repo root (Dockerfile is in next-app/)
# 從 repo 根目錄執行（Dockerfile 在 next-app/）
cd /path/to/repo

gcloud run deploy "${SERVICE_NAME}" \
  --source next-app/ \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --build-arg NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false
```

> **NEXT_PUBLIC_\* gotcha / 注意事項**: `NEXT_PUBLIC_*` env vars are **baked at build time** — they are not runtime secrets. Pass them as `--build-arg` (Option A) or Cloud Build substitutions (Option B). Do NOT put them in Secret Manager; they end up in the JS bundle anyway.
>
> `NEXT_PUBLIC_*` 環境變數在**建置時就已嵌入**，並非執行期密鑰。請以 `--build-arg`（選項 A）或 Cloud Build substitutions（選項 B）傳入。不要放入 Secret Manager，這些值最終會出現在 JS bundle 中。

### Option B: Local Docker Build + Push / 本機建置後推送

```bash
# Build with build-time NEXT_PUBLIC_* values
# 建置並帶入 NEXT_PUBLIC_* 值
docker build \
  --build-arg NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false \
  --build-arg NEXT_PUBLIC_APP_URL="https://${SERVICE_NAME}-<hash>-${REGION}.a.run.app" \
  -t "${IMAGE}" \
  next-app/

# Push to Artifact Registry / 推送至 Artifact Registry
docker push "${IMAGE}"
```

### Option C: Cloud Build with Substitutions / 使用 Cloud Build substitutions

Create `next-app/cloudbuild.yaml`:

```yaml
# next-app/cloudbuild.yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - build
      - '--build-arg'
      - 'NEXT_PUBLIC_ENABLE_DEMO_LOGIN=${_DEMO_LOGIN}'
      - '--build-arg'
      - 'NEXT_PUBLIC_APP_URL=${_APP_URL}'
      - '-t'
      - '${_IMAGE}'
      - 'next-app/'
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', '${_IMAGE}']
substitutions:
  _IMAGE: '${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/next-app:latest'
  _DEMO_LOGIN: 'false'
  _APP_URL: 'https://your-service-url.a.run.app'
images:
  - '${_IMAGE}'
```

```bash
gcloud builds submit \
  --config next-app/cloudbuild.yaml \
  --substitutions _DEMO_LOGIN=false,_APP_URL="https://${SERVICE_NAME}-<hash>-${REGION}.a.run.app" \
  .
```

---

## 3. Cloud SQL Postgres / 建立 Cloud SQL Postgres

```bash
# Create Cloud SQL instance (one-time; ~3 min) / 建立 Cloud SQL 實例（一次性，約 3 分鐘）
gcloud sql instances create "${INSTANCE}" \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region="${REGION}" \
  --storage-auto-increase

# Create DB and user / 建立資料庫與使用者
gcloud sql databases create "${DB_NAME}" --instance="${INSTANCE}"

gcloud sql users create "${DB_USER}" \
  --instance="${INSTANCE}" \
  --password="$(openssl rand -base64 24)"
```

> **Save the generated password!** You will need it for the DATABASE_URL secret in Step 4.
> **請儲存產生的密碼！** Step 4 建立 DATABASE_URL 密鑰時需要使用。

### Cloud SQL Connector / Cloud SQL 連線方式

Cloud Run connects to Cloud SQL via **Unix socket** (no public IP, no SSL certificates needed).
Cloud Run 透過 **Unix socket** 連線 Cloud SQL（無需公開 IP 或 SSL 憑證）。

The `DATABASE_URL` for the unix socket path follows this pattern:
Unix socket 連線的 `DATABASE_URL` 格式如下：

```
postgresql://${DB_USER}:<PASSWORD>@localhost/${DB_NAME}?host=/cloudsql/${PROJECT_ID}:${REGION}:${INSTANCE}
```

---

## 4. Secrets in Secret Manager / 在 Secret Manager 中儲存密鑰

```bash
# AUTH_SECRET — random 32-byte hex string / 隨機 32 位元組十六進位字串
gcloud secrets create AUTH_SECRET \
  --data-file=<(openssl rand -hex 32)

# DATABASE_URL — unix socket URL (no public IP) / Unix socket 連線字串
gcloud secrets create DATABASE_URL \
  --data-file=<(echo -n "postgresql://${DB_USER}:<PASSWORD>@localhost/${DB_NAME}?host=/cloudsql/${SQL_CONN}")

# Grant Cloud Run Service Account access to secrets
# 授予 Cloud Run 服務帳號存取密鑰的權限
PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')
SA="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding AUTH_SECRET \
  --member="${SA}" --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member="${SA}" --role="roles/secretmanager.secretAccessor"
```

---

## 5. Deploy Cloud Run Service / 部署 Cloud Run 服務

```bash
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --add-cloudsql-instances "${SQL_CONN}" \
  --set-secrets "AUTH_SECRET=AUTH_SECRET:latest,DATABASE_URL=DATABASE_URL:latest" \
  --set-env-vars "AUTH_TRUST_HOST=true,NODE_ENV=production,NEXT_TELEMETRY_DISABLED=1" \
  --port 3000 \
  --min-instances 0 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1
```

> **`--add-cloudsql-instances` note / 說明**: This flag mounts the Cloud SQL Auth Proxy as a sidecar and creates the unix socket at `/cloudsql/${PROJECT_ID}:${REGION}:${INSTANCE}`. The `DATABASE_URL` must reference this path — **not** a TCP host.
>
> 此 flag 會以 sidecar 方式掛載 Cloud SQL Auth Proxy，並在 `/cloudsql/${PROJECT_ID}:${REGION}:${INSTANCE}` 建立 unix socket。`DATABASE_URL` 必須指向此路徑，**而非** TCP host。

### Get the deployed service URL / 取得部署後的服務 URL

```bash
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region "${REGION}" \
  --format 'value(status.url)')
echo "Service URL: ${SERVICE_URL}"
```

---

## 6. Run Migrations & Seed as a Cloud Run Job / 以 Cloud Run Job 執行 migrate 與 seed

The same Docker image contains `drizzle-kit` and the seed script (devDependencies are kept in the builder stage). Run them as a one-shot Cloud Run Job.

同一個 Docker 映像已包含 `drizzle-kit` 與 seed 腳本（devDependencies 保留於 builder stage）。以一次性 Cloud Run Job 執行。

```bash
# Create the migrate job (one-time) / 建立 migrate job（一次性）
gcloud run jobs create migrate-job \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --add-cloudsql-instances "${SQL_CONN}" \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest" \
  --set-env-vars "NODE_ENV=production" \
  --command "node_modules/.bin/drizzle-kit" \
  --args "migrate"

# Execute the migrate job / 執行 migrate job
gcloud run jobs execute migrate-job \
  --region "${REGION}" \
  --wait

# Create and run the seed job (optional / 可選) / 建立並執行 seed job
gcloud run jobs create seed-job \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --add-cloudsql-instances "${SQL_CONN}" \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest" \
  --set-env-vars "NODE_ENV=production" \
  --command "node_modules/.bin/tsx" \
  --args "db/seed.ts"

gcloud run jobs execute seed-job \
  --region "${REGION}" \
  --wait
```

> **Re-run on schema changes / 結構變更時重新執行**: After pushing a new image with new Drizzle migrations, re-run `migrate-job` before (or immediately after) deploying the updated service.
>
> 部署包含新 Drizzle migration 的映像後，請在更新服務前（或立即之後）重新執行 `migrate-job`。

---

## 7. Custom Domain Mapping / 自訂網域對應

```bash
# Verify domain ownership first in Google Search Console, then:
# 先在 Google Search Console 驗證網域所有權，然後：

gcloud run domain-mappings create \
  --service "${SERVICE_NAME}" \
  --domain "yourdomain.com" \
  --region "${REGION}"

# Get the DNS records to configure with your registrar
# 取得需設定至網域註冊商的 DNS 記錄
gcloud run domain-mappings describe \
  --domain "yourdomain.com" \
  --region "${REGION}"
```

After the domain is active, update `AUTH_URL` so Auth.js generates correct redirect URLs.
網域生效後，更新 `AUTH_URL` 以讓 Auth.js 產生正確的 redirect URL。

```bash
gcloud run services update "${SERVICE_NAME}" \
  --region "${REGION}" \
  --set-env-vars "AUTH_URL=https://yourdomain.com,AUTH_TRUST_HOST=true"
```

> **`AUTH_TRUST_HOST` / 注意事項**: Always set `AUTH_TRUST_HOST=true` on Cloud Run. Cloud Run terminates TLS at the load balancer and forwards requests with `X-Forwarded-Proto: https`. Without this flag, Auth.js treats the internal HTTP connection as insecure and may reject callbacks.
>
> 在 Cloud Run 上請一律設定 `AUTH_TRUST_HOST=true`。Cloud Run 在 load balancer 終止 TLS，並以 `X-Forwarded-Proto: https` 轉發請求。若未設定此 flag，Auth.js 可能將內部 HTTP 連線視為不安全並拒絕 callback。

---

## 8. Verify the Deployment / 驗證部署

```bash
# Health check / 健康檢查
curl -I "${SERVICE_URL}"
# Expected: HTTP/2 200

# Confirm Cloud SQL connectivity (logs) / 確認 Cloud SQL 連線（日誌）
gcloud run services logs read "${SERVICE_NAME}" \
  --region "${REGION}" \
  --limit 50

# Test auth flow in browser / 在瀏覽器測試登入流程
open "${SERVICE_URL}"
```

---

## Quick Reference Cheatsheet / 快速參考

```bash
# ─── One-time setup / 一次性設定 ──────────────────────────────────────────

gcloud services enable run.googleapis.com sqladmin.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com

gcloud artifacts repositories create "${AR_REPO}" \
  --repository-format=docker --location="${REGION}"

gcloud auth configure-docker "${REGION}-docker.pkg.dev"

gcloud sql instances create "${INSTANCE}" \
  --database-version=POSTGRES_16 --tier=db-f1-micro --region="${REGION}"

gcloud sql databases create "${DB_NAME}" --instance="${INSTANCE}"
gcloud sql users create "${DB_USER}" --instance="${INSTANCE}" --password="<PASSWORD>"

gcloud secrets create AUTH_SECRET --data-file=<(openssl rand -hex 32)
gcloud secrets create DATABASE_URL \
  --data-file=<(echo -n "postgresql://${DB_USER}:<PASSWORD>@localhost/${DB_NAME}?host=/cloudsql/${SQL_CONN}")

# ─── Deploy (repeat on each release) / 每次發佈執行 ──────────────────────

docker build --build-arg NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false -t "${IMAGE}" next-app/
docker push "${IMAGE}"

gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" --region "${REGION}" \
  --add-cloudsql-instances "${SQL_CONN}" \
  --set-secrets "AUTH_SECRET=AUTH_SECRET:latest,DATABASE_URL=DATABASE_URL:latest" \
  --set-env-vars "AUTH_TRUST_HOST=true,NODE_ENV=production" \
  --port 3000

gcloud run jobs execute migrate-job --region "${REGION}" --wait
```

---

## Troubleshooting / 常見問題排除

| Symptom / 症狀 | Likely Cause / 可能原因 | Fix / 解決方式 |
|----------------|-------------------------|----------------|
| `ECONNREFUSED` to DB | Missing `--add-cloudsql-instances` or wrong `SQL_CONN` | Verify `${PROJECT_ID}:${REGION}:${INSTANCE}` format |
| Auth callback 302 loop | `AUTH_TRUST_HOST` not set | Add `--set-env-vars AUTH_TRUST_HOST=true` |
| `NEXT_PUBLIC_*` undefined at runtime | Variable not passed at build time | Use `--build-arg` or Cloud Build substitutions; redeploy |
| Secret not found | SA lacks `secretAccessor` role | Re-run `gcloud secrets add-iam-policy-binding` |
| Cold start > 5s | `--min-instances 0` + large image | Set `--min-instances 1` or use `--cpu-boost` |
| Migration fails on deploy | Job using stale image | Update job image: `gcloud run jobs update migrate-job --image "${IMAGE}"` |

---

## Related Guides / 相關文件

- [Deploy Decision Guide](en/deploy-guide.md) — Zeabur vs Cloud Run comparison / 平台比較
- [Quickstart](en/quickstart.md) — Local development setup / 本機開發環境
- [E256 Epic Spec](../epics/e256-gcp-cloudrun-cloudsql-path.md) — Background and acceptance criteria
