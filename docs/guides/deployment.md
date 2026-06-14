# Deployment Overview / 部署總覽

> **Two roads, one image.** The Next.js standalone build (`output: "standalone"`) produces a
> self-contained `server.js` that runs on both Zeabur and GCP Cloud Run without modification.
>
> **兩條部署路徑，同一份映像檔。** Next.js standalone 建置產生獨立的 `server.js`，
> 可直接在 Zeabur 和 GCP Cloud Run 上執行，無需修改。

---

## Step 0 — Prerequisites / 前置條件

Install the deploy toolchain once per machine / 每台機器安裝一次：

```bash
make install-deploy-tools
```

This installs the Zeabur CLI and Google Cloud SDK (gcloud + docker credential helper).
/ 此指令安裝 Zeabur CLI 和 Google Cloud SDK（gcloud + Docker 憑證助手）。

---

## The Two Roads / 兩條部署路徑

| | Road 1 — Zeabur | Road 2 — GCP Cloud Run |
|---|---|---|
| **Audience / 適合對象** | Indie devs, fast iteration / 個人開發者、快速迭代 | Teams needing fine-grained IAM + VPC / 需要細粒度 IAM + VPC 的團隊 |
| **Database / 資料庫** | Zeabur PostgreSQL service / Zeabur PostgreSQL 服務 | Cloud SQL for PostgreSQL (private IP + connector) |
| **Complexity / 複雜度** | Low — dashboard-driven / 低，使用控制台操作 | Medium — CLI/Terraform / 中，使用 CLI |
| **Cold start / 冷啟動** | ~1 s | ~2 s (min-instances=1 eliminates it) |
| **Guide / 指南** | [deployment-zeabur.md](deployment-zeabur.md) | [deployment-gcp.md](deployment-gcp.md) |

---

## Build-Time vs Runtime Env Vars / 建置期 vs 執行期環境變數

> This is the single most common deploy gotcha.
> / 這是最常見的部署陷阱。

```
┌──────────────────────────────────────────────────────────────────────┐
│  NEXT_PUBLIC_* vars are baked into the JS bundle at `next build`.    │
│  Changing them AFTER the build has NO effect — you must rebuild.     │
│                                                                      │
│  NEXT_PUBLIC_* 變數在 `next build` 時被嵌入 JS bundle。              │
│  建置完成後修改這些變數「無效」—— 必須重新建置。                      │
└──────────────────────────────────────────────────────────────────────┘
```

| Category / 類別 | Variables / 變數 | Timing / 時機 |
|---|---|---|
| Public app config / 公開設定 | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` | Build-time / 建置期 |
| Auth secrets / 認證密鑰 | `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST` | Runtime / 執行期 |
| Database / 資料庫 | `DATABASE_URL` | Runtime / 執行期 |
| Google OAuth | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Runtime / 執行期 |
| Email / 郵件 | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Runtime / 執行期 |
| Stripe billing | `BILLING_PROVIDER`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Runtime / 執行期 |
| ECPay billing | `ECPAY_MERCHANT_ID`, `ECPAY_HASH_KEY`, `ECPAY_HASH_IV`, `ECPAY_API_BASE_URL` | Runtime / 執行期 |

See [`next-app/.env.example`](../../next-app/.env.example) for the full annotated matrix.
/ 完整注解矩陣請參閱 [`next-app/.env.example`](../../next-app/.env.example)。

---

## Dockerfile — Cloud Run Ready / Dockerfile — 已符合 Cloud Run 規範

The existing `next-app/Dockerfile` is Cloud Run-ready. No changes needed.
/ 現有的 `next-app/Dockerfile` 已符合 Cloud Run 規範，無需修改。

Key properties confirmed / 已確認的關鍵屬性：

- `output: "standalone"` in `next.config.ts` — produces a self-contained `server.js`
- Multi-stage build: `deps` → `builder` → `runner` (minimal Alpine image)
- Non-root user: `nextjs` (UID 1001) — required by Cloud Run
- `ENV PORT=3000` and `ENV HOSTNAME=0.0.0.0` — Cloud Run injects `$PORT` at runtime
- `EXPOSE 3000` — documents the listening port
- `CMD ["node", "server.js"]` — runs the standalone server directly

---

## Road 1 — Zeabur

Full guide: [deployment-zeabur.md](deployment-zeabur.md) *(E255)*

Quick summary / 快速摘要：

1. Push repo to GitHub.
2. In Zeabur dashboard → New Project → Deploy from GitHub → select `next-app/` as the service root.
3. Set all **build-time** env vars (especially `NEXT_PUBLIC_APP_URL`) before the first build.
4. Add a Zeabur PostgreSQL service and link `DATABASE_URL`.
5. Set all runtime secrets (`AUTH_SECRET`, OAuth keys, SMTP, billing).
6. Trigger deploy — Zeabur picks up `zbpack.json` automatically.

Zeabur reads `next-app/zbpack.json` to determine the build and start commands:

```json
{
  "build_command": "pnpm build",
  "start_command": "node server.js",
  "node_version": "22",
  "install_command": "pnpm install --frozen-lockfile",
  "output_dir": ".next"
}
```

---

## Road 2 — GCP Cloud Run

Full guide: [deployment-gcp.md](deployment-gcp.md) *(E256)*

Quick summary / 快速摘要：

1. Build and push the Docker image to Artifact Registry.
2. Create a Cloud SQL for PostgreSQL instance and a private-IP connector.
3. Deploy to Cloud Run, passing runtime env vars via `--set-env-vars` and Cloud SQL connection via `--add-cloudsql-instances`.
4. Set `NEXT_PUBLIC_*` as `--build-arg` during `docker build` (baked at build time).
5. Use Secret Manager for `AUTH_SECRET`, database password, and billing keys.

---

## Local Dev / 本地開發

```bash
# Full stack with Docker Compose (PostgreSQL + Mailpit):
docker compose up --build -d

# App:    http://localhost:3000
# Email:  http://localhost:8025 (Mailpit)
```

Demo accounts / 示範帳號：
- `admin@example.com / Admin123!`
- `editor@example.com / Editor123!`
- `viewer@example.com / Viewer123!`

---

## Related / 相關文件

| Document / 文件 | Purpose / 用途 |
|---|---|
| [`next-app/.env.example`](../../next-app/.env.example) | Full env-var matrix with comments / 完整環境變數矩陣含注解 |
| [`next-app/zbpack.json`](../../next-app/zbpack.json) | Zeabur build descriptor / Zeabur 建置描述符 |
| [`next-app/Dockerfile`](../../next-app/Dockerfile) | Container build (Cloud Run + local Docker) / 容器建置 |
| [`next-app/next.config.ts`](../../next-app/next.config.ts) | `output: "standalone"` config / 獨立輸出設定 |
| [deployment-zeabur.md](deployment-zeabur.md) | Road 1 step-by-step guide / 路徑一逐步指南 |
| [deployment-gcp.md](deployment-gcp.md) | Road 2 step-by-step guide / 路徑二逐步指南 |
