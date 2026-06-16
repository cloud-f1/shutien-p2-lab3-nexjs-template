# Fork 安全設定 — Secrets 與 OWASP Top 10 合規指南

> 你 fork 了這個模板。這個 app **預設就是安全的（secure by default）** — 這份指南告訴你上線前**你自己**必須做什麼，以及模板已經防禦了哪些 OWASP Top 10（2021）項目，讓你知道**不要**去削弱它們。
>
> 純文件。這裡的一切都不改變行為 — 只是解釋已經存在的防禦。

---

## 摘要（TL;DR）

1. 用 `openssl rand -hex 32`（或 `npx auth secret`）產生一把真實的 `AUTH_SECRET`。
2. 把它 — 加上真實的 `DATABASE_URL`（Postgres）— 設定在 `next-app/.env.local`（開發）與主機環境變數（生產）。
3. 在第一次部署前，確認 `AUTH_SECRET` 與 `DATABASE_URL` 都是真實值（不是 placeholder），並且沒有任何伺服器 secret 透過 `NEXT_PUBLIC_*` 變數外洩。
4. 不要撤掉繼承來的 OWASP 防禦（Auth.js + RBAC 守衛、共用 Zod 驗證、Drizzle 參數化查詢、JSX 自動跳脫）。詳見 [§2](#2-owasp-top-10-2021-對照表) 的表格。

如果你跳過第 1 步，**Auth.js 無法簽署 session** — Auth.js v5 *要求*一把真實的 `AUTH_SECRET`，沒有它就無法簽發 / 驗證 JWT session。DB 後端的 RBAC 守衛同樣依賴有效的 `DATABASE_URL`。這是刻意設計 — 見 Auth.js 設定 `next-app/auth.config.ts` / `next-app/lib/auth.ts` 與 `next-app/.env.example`。

---

## 1. 你必須設定的 Secrets

Next.js 透過 `process.env` 從環境變數讀取這些值。這裡沒有 FastAPI 那種 lifespan 啟動閘門；取而代之的實務強制是：沒有 `AUTH_SECRET`，Auth.js v5 就無法簽署 session；沒有 `DATABASE_URL`，RBAC 守衛就無法運作。你可以在 `next-app/auth.config.ts` / `next-app/lib/auth.ts` 與 `next-app/.env.example` 看到每個值如何被使用。

| Secret | 用途 | 產生 / 取得方式 | 由什麼強制執行 |
|---|---|---|---|
| `AUTH_SECRET` | 簽署 Auth.js v5 的 JWT session（單一密鑰 — 沒有獨立的 access/refresh 金鑰） | `openssl rand -hex 32` 或 `npx auth secret` | Auth.js v5 *要求*它：沒有真實密鑰就會丟錯 / 無法簽署或驗證 session JWT。使用高熵值，絕不用 placeholder，絕不 commit |
| `DATABASE_URL` | Postgres 連線字串 | 你的 Postgres URL（`postgresql://user:pass@host:port/db`） | App 透過 Drizzle（`postgres-js`）連 Postgres。生產環境請用真實的 Postgres URL — app 預期 Postgres，不是 SQLite |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`（`AUTH_GOOGLE_*`） | Google OAuth 登入 | Google Cloud Console → OAuth 2.0 憑證 | 選用。只有啟用 Google provider 時才需要 |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`（`AUTH_GITHUB_*`） | GitHub OAuth 登入 | GitHub → Developer settings → OAuth Apps | 選用。只有啟用 GitHub provider 時才需要 |
| Email provider 金鑰 | 交易型 email（驗證、重設密碼） | 你的 email provider 後台 | 選用。若要寄驗證 / 重設密碼信才接 |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | 金流（若有使用） | Stripe 後台 → API keys + webhook 簽章密鑰 | 選用。只有啟用金流時才需要 |

**它們放在哪裡**

- **開發：** `next-app/.env.local` — 從 [`next-app/.env.example`](../../../next-app/.env.example) 複製，該範例帶有 placeholder（`AUTH_SECRET=replace-me-with-a-32-char-random-secret`、`DATABASE_URL=postgresql://user:password@host:5432/dbname`）。請把它們換成真實值。
- **生產（Zeabur / Cloud Run 等）：** 設為**主機環境變數**，絕不 commit。`.env.local` 已被 git ignore。記住 `NEXT_PUBLIC_*` 變數會在**建置時（build time）被烤進用戶端 bundle** — 這些要在 build 之前設好，而且絕不要把 secret 放在 `NEXT_PUBLIC_` 前綴後面。
- **產生一把真實密鑰：**

  ```bash
  openssl rand -hex 32   # → AUTH_SECRET
  # 或：
  npx auth secret        # 幫你產生並寫入 AUTH_SECRET
  ```

如果 `AUTH_SECRET` 曾經外洩，**請輪替它** — 產生新值並重新部署。注意輪替 `AUTH_SECRET` 會讓所有現有 session 失效（所有人都會被登出），請據此規劃更換時機。

---

## 2. OWASP Top 10（2021）對照表

模板已經防禦了什麼、相關程式碼在哪、以及 fork 不能破壞的那一件事。

| OWASP 2021 | 模板的防禦措施 | 它在哪裡 | 不要破壞這個 |
|---|---|---|---|
| **A01 — 存取控制失效（Broken Access Control）** | 單一來源（single-origin）的 Next.js app — 沒有跨來源的 client/server 拆分可以暴露。存取控制由伺服器端的 Auth.js + RBAC 守衛強制執行，這些守衛在**每次請求都從 DB 重新讀取角色**（三層 admin/editor/viewer） | Auth.js 設定 `next-app/auth.config.ts` / `next-app/lib/auth.ts`；角色守衛 `next-app/lib/permissions.ts`、`next-app/lib/is-admin.ts` | 不要削弱 RBAC 守衛，也不要在沒有 auth + 角色檢查的情況下暴露 Route Handler / Server Action。預設同源 app 不需要任何萬用字元 CORS — *如果*你新增跨來源的 Route Handler，請刻意設定它們的 CORS（絕不要 `*` 搭配 credentials） |
| **A02 — 加密失效（Cryptographic Failures）** | Auth.js v5 用 `AUTH_SECRET`（單一高熵密鑰）簽署 session JWT | `next-app/auth.config.ts` / `next-app/lib/auth.ts`；密鑰見 `next-app/.env.example` | 不要上線 placeholder 或太短的密鑰。若 `AUTH_SECRET` 外洩就輪替它 — 注意輪替會讓現有 session 失效 |
| **A03 — 注入 / XSS（Injection / XSS）** | 伺服器輸入由**共用 Zod schema** 驗證（Server Actions 與表單共用）；DB 存取透過 **Drizzle** 使用**參數化查詢**（不拼接原始 SQL 字串）；React/JSX **自動跳脫** — `next-app/` 中有 **0** 個 `dangerouslySetInnerHTML`（可用下方 grep 核實） | Zod schema `next-app/lib/validations/`；Drizzle 查詢 `next-app/lib/`；JSX 跳脫：`grep -rn "dangerouslySetInnerHTML" next-app/app next-app/components` → 0 個結果 | 不要加 `dangerouslySetInnerHTML`（會在無警告下重新打開 XSS 破口）。不要接受未驗證的 request body — 每個 Server Action 與 Route Handler 都要保留 Zod schema，並讓 Drizzle 參數化查詢，而不是自己拼 SQL 字串 |
| **A05 — 安全設定錯誤（Security Misconfiguration）** | 沒有 FastAPI 的 `/docs` 或 `/redoc` 介面，也沒有啟動時的 `SystemExit` 閘門可繞過。Secret 留在伺服器端；只有真正公開的值才帶 `NEXT_PUBLIC_` 前綴 | `next-app/.env.example`（注意 `NEXT_PUBLIC_*` 的 build-time 警告） | 生產環境不要用 `NODE_ENV=development` 執行，也不要暴露詳細錯誤輸出。確保 `AUTH_SECRET` + `DATABASE_URL` 是真實值。不要透過 `NEXT_PUBLIC_*` 洩漏伺服器 secret — 那些會在 build time 被烤進用戶端 bundle |
| **A07 — 識別與驗證失效（Identification & Authentication Failures）** | Auth.js v5 **Credentials** provider；密碼在存入 Drizzle users 表前以強健的自適應雜湊（透過 `next-app/lib/password.ts` 的 **bcrypt**）處理；session 為 JWT | Credentials provider `next-app/auth.config.ts` / `next-app/lib/auth.ts`；雜湊 `next-app/lib/password.ts`；users 表 `next-app/lib/schema/` | 建議的強化：在登入路由與你建立的任何重設密碼路由上加**速率限制**（`next-app/lib/rate-limit.ts` 提供以 `login:` 為 key 的 limiter 輔助函式 — 請為你的部署刻意接上它）。讓任何忘記密碼端點對**已知與未知 email 回相同的回應**（防帳號列舉）— 不要對未知 email 回 404 |

### 誠實的缺口 — 你的責任（模板並未完整處理這些）

下列 OWASP 類別在模板中**不是**開箱即用。明說出來，讓你不會誤以為有覆蓋：

- **A04 — 不安全的設計（Insecure Design）** — 針對**你自己**功能的威脅建模與濫用情境設計由你負責；模板只提供 auth 骨架。
- **A06 — 易受攻擊與過期的元件（Vulnerable & Outdated Components）** — 預設沒有接任何相依套件 CVE 掃描器。請自行加上 Dependabot / `pnpm audit`。
- **A08 — 軟體與資料完整性失效（Software & Data Integrity Failures）** — 未設定 Subresource Integrity 或供應鏈簽章。
- **A09 — 安全日誌與監控失效（Security Logging & Monitoring Failures）** — 開箱即用狀態下**沒有**內建的結構化 `request_id` 日誌或 Sentry 接線。日誌與告警是**你必須自行加上**的 — 為你的環境接好 Sentry DSN（或其他日誌 / 錯誤服務）並設定日誌保留。在你動手之前，不會有任何告警。
- **A10 — 伺服器端請求偽造（SSRF）** — 未設定對外請求 allowlist；若你新增會抓取使用者提供 URL 的程式碼，SSRF 的防護由你負責。

---

## 3. Fork 上線前檢查清單（pre-flight）

在第一次生產部署前跑一遍這個。

```bash
# 1. 產生一把真實的簽署密鑰
openssl rand -hex 32   # 貼到 AUTH_SECRET
# 或：npx auth secret

# 2. 在 next-app/.env.local（開發）與主機環境變數（生產）設定 secrets：
#    AUTH_SECRET、DATABASE_URL（PostgreSQL，不是 SQLite）、
#    若有使用則設 OAuth IDs / email provider 金鑰。
#    確認沒有任何 secret 放在 NEXT_PUBLIC_ 前綴後面。
```

接著用肉眼確認：

- [ ] 生產環境已設定為 production — Next.js build/runtime 用 `NODE_ENV=production`，且 `AUTH_SECRET` + `DATABASE_URL` 是真實值（不是 placeholder）。
- [ ] `AUTH_SECRET` 是真實的高熵值，不是 `.env.example` 裡的 placeholder。
- [ ] `DATABASE_URL` 在生產環境是真實的 PostgreSQL URL（`postgresql://user:pass@host:port/db`），絕非 SQLite。
- [ ] 沒有任何伺服器 secret 透過 `NEXT_PUBLIC_*` 變數暴露（那些會在 build time 被烤進用戶端 bundle）。
- [ ] `NODE_ENV=production` — 不要暴露詳細錯誤輸出。
- [ ] 若你新增了跨來源的 Route Handler，它們的 CORS 已設為你真實的網域（絕不要 `*` 搭配 credentials）。預設單一來源 app 不需要任何 CORS 設定。
- [ ] 你客製化過程中沒有在 `next-app/` 加入 `dangerouslySetInnerHTML`。

只要上面的方塊都勾選，你繼承來的安全姿態就完好無損。

---

## 4. 延伸閱讀（See also）

- [`deploy-guide.md`](deploy-guide.md) — 選擇平台，以及各主機放 secret 的位置。
- [`deploy-walkthrough.md`](deploy-walkthrough.md) — 第一次部署的逐步教學。
- 本指南所描述防禦的真實來源：Auth.js 設定（`next-app/auth.config.ts` / `next-app/lib/auth.ts`）、共用 Zod 驗證（`next-app/lib/validations/`）、`next-app/.env.example`，以及專案的 `nextjs-saas-patterns` skill / `CLAUDE.md`（涵蓋 Auth.js v5 + JWT + RBAC 的注意事項）。
