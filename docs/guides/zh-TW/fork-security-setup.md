# Fork 安全設定 — Secrets 與 OWASP Top 10 合規指南

> 你 fork 了這個模板。生產環境的安全閘門**已經在程式碼中強制執行** — 這份指南告訴你上線前**你自己**必須做什麼，以及模板已經防禦了哪些 OWASP Top 10（2021）項目，讓你知道**不要**去削弱它們。
>
> 純文件。這裡的一切都不改變行為 — 只是解釋已經存在的閘門。

---

## 摘要（TL;DR）

1. 用 `openssl rand -hex 32` 產生 `SECRET_KEY` 和 `REFRESH_SECRET_KEY`（兩個**不同**的值）。
2. 把它們 — 加上真實的 `DATABASE_URL` — 設定在 `server/.env`（開發）與主機環境變數（生產）。
3. 在第一次部署前執行 `make doctor-production`，把每一個 ❌ 都修掉。
4. 不要撤掉繼承來的 OWASP 防禦（CORS allowlist、Pydantic 驗證、JSX 自動跳脫、fail-fast 設定檢查）。詳見 [§2](#2-owasp-top-10-2021-對照表) 的表格。

如果你跳過第 1 步，**伺服器在生產環境會拒絕啟動** — `validate_production_config()` 會呼叫 `SystemExit`。這是刻意設計（見 [`server/app/core/config.py:134-173`](../../../server/app/core/config.py)）。

---

## 1. 你必須設定的 Secrets

下列每個 secret 都由 [`server/app/core/config.py`](../../../server/app/core/config.py) 的 `Settings` 讀取。「程式碼閘門」欄位指出強制執行（或警告）它的確切機制 — 你可以讀那個檔案來逐一驗證。

| Secret | 用途 | 產生 / 取得方式 | 強制執行的程式碼閘門 |
|---|---|---|---|
| `SECRET_KEY` | 簽署 access JWT（HS256） | `openssl rand -hex 32` | `@field_validator` `_reject_placeholder_secret` 拒絕 placeholder（`config.py:76-87`）；`validate_production_config` 在生產環境 `SystemExit`（`config.py:148-152`）；`make doctor-production` 標記 placeholder 與長度 < 32 |
| `REFRESH_SECRET_KEY` | 簽署 refresh JWT（獨立金鑰） | `openssl rand -hex 32` — **必須不同**於 `SECRET_KEY` | `@field_validator` `_reject_placeholder_refresh`（`config.py:89-100`）；`_check_secrets` model validator 在非開發環境拒絕 `SECRET_KEY == REFRESH_SECRET_KEY`（`config.py:125-132`）；`validate_production_config`（`config.py:153-157`） |
| `DATABASE_URL` | Postgres 連線字串 | 你的 Postgres URL（`postgresql+asyncpg://...`） | `validate_production_config` 在生產環境若含 `sqlite` 會 `SystemExit`（`config.py:158-162`）；`make doctor-production` 拒絕 SQLite 與空值 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth 登入 | Google Cloud Console → OAuth 2.0 憑證 | 選用（預設 `""`）。若**沒有**設定任何 OAuth provider，`make doctor-production` 會 ❌ |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth 登入 | GitHub → Developer settings → OAuth Apps | 選用（預設 `""`）。同一個 `make doctor-production` OAuth 檢查 |
| Email provider 金鑰（`MAILGUN_API_KEY` + `MAILGUN_DOMAIN`，或 `ZEABUR_EMAIL_API_KEY`） | 交易型 email（驗證、重設密碼） | Mailgun / Zeabur 後台 | `EMAIL_PROVIDER` 預設為 `console`（只寫 log）。若生產環境仍是 `console`，`make doctor-production` 會 ❌ |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | 金流（若有使用） | Stripe 後台 → API keys + webhook 簽章密鑰 | 選用（預設 `""`）。無 fail-fast — 只有啟用金流時才需要 |

**它們放在哪裡**

- **開發：** `server/.env` — 從 [`server/.env.example`](../../../server/.env.example) 複製，該範例帶有 placeholder（`SECRET_KEY=CHANGE_ME_TO_A_RANDOM_64_CHAR_HEX_STRING`、`REFRESH_SECRET_KEY=CHANGE_ME_REFRESH_SECRET`）。`make go` 會幫你產生真實值。
- **生產（Zeabur / Cloud Run 等）：** 設為**主機環境變數**，絕不 commit。`server/.env` 已被 git ignore。
- **產生兩把不同的金鑰：**

  ```bash
  openssl rand -hex 32   # → SECRET_KEY
  openssl rand -hex 32   # → REFRESH_SECRET_KEY（再跑一次 — 必須不同）
  ```

關於**輪替（rotation）**的生命週期（透過 `SECRET_KEY_PREVIOUS` 零停機更換線上金鑰），請見 [`docs/SECRET_ROTATION.md`](../../SECRET_ROTATION.md) — 該 runbook 是輪替的單一真實來源，這裡**不**重複它。

---

## 2. OWASP Top 10（2021）對照表

模板已經防禦了什麼、證據在哪、以及 fork 不能破壞的那一件事。每個 file:line 都已對照當前 repo 逐一核實。

| OWASP 2021 | 模板的防禦措施 | 檔案證據 | 不要破壞這個 |
|---|---|---|---|
| **A01 — 存取控制失效（Broken Access Control）** | CORS allowlist，無萬用字元。`allow_origins=settings.ALLOWED_ORIGINS` 搭配 `allow_credentials=True`；origins 由 `ALLOWED_ORIGINS_STR` 解析 | [`server/app/main.py:51-63`](../../../server/app/main.py)；allowlist 來源 `config.py:64,119-121` | 絕不要設 `allow_origins=["*"]` — 萬用字元 + credentials 會悄悄關掉這層防護。維持你真實的網域。`make doctor-production` 會 ❌ 生產 origins 中的 `localhost` |
| **A02 — 加密失效（Cryptographic Failures）** | JWT 簽署金鑰擋掉 placeholder；HS256；雙金鑰輪替 | placeholder 集合 `config.py:10-18`；validators `config.py:76-100`；輪替 [`docs/SECRET_ROTATION.md`](../../SECRET_ROTATION.md) | 不要上線 placeholder 或太短的金鑰。不要讓 access 與 refresh 共用同一把金鑰（`_check_secrets`，`config.py:125-132`） |
| **A03 — 注入 / XSS（Injection / XSS）** | 伺服器輸入由 **Pydantic v2** schema 驗證；用戶端透過 **React JSX 自動跳脫**渲染 — `client/src/` 中有 **0** 個 `dangerouslySetInnerHTML`（已核實） | Pydantic schema（`server/app/schemas/`，見 [`server/CLAUDE.md`](../../../server/CLAUDE.md) §2）；JSX 跳脫：`grep -rn "dangerouslySetInnerHTML" client/src/` → 0 個結果 | 不要加 `dangerouslySetInnerHTML`（會在無警告下重新打開 XSS 破口）。不要接受原始 SQL / 未驗證的 body — 每個 endpoint 都要保留 schema |
| **A05 — 安全設定錯誤（Security Misconfiguration）** | 生產設定 **fail-fast**：啟動時若有 placeholder secret 或生產用 SQLite，伺服器會 `SystemExit`；除非 `DEBUG`，否則關閉 API 文件（`/docs`、`/redoc`） | `validate_production_config()` `config.py:134-173`，在 lifespan 呼叫 `main.py:21-26`；文件開關 `main.py:32-33` | 生產環境不要設 `DEBUG=true`（會暴露 `/docs` + 詳細錯誤）。不要繞過 lifespan 啟動檢查。`make doctor-production` 會 ❌ `DEBUG=true` |
| **A07 — 識別與驗證失效（Identification & Authentication Failures）** | `fastapi-users` **argon2** 密碼雜湊；auth **速率限制**（`RATE_LIMIT_AUTH = "15/minute"`）；忘記密碼**一律回 202**（防帳號列舉） | argon2 + 202 規則：[`server/CLAUDE.md`](../../../server/CLAUDE.md) §6；速率限制 `config.py:65`，limiter `server/app/core/limiter.py`，接線 `main.py:37-38`；一般預設 `200/minute` | 不要調低 / 移除 `RATE_LIMIT_AUTH`。不要讓忘記密碼對未知 email 回 404（會洩漏哪些帳號存在） |

### 誠實的缺口 — 你的責任（模板並未完整處理這些）

下列 OWASP 類別在模板中**不是**開箱即用。明說出來，讓你不會誤以為有覆蓋：

- **A04 — 不安全的設計（Insecure Design）** — 針對**你自己**功能的威脅建模與濫用情境設計由你負責；模板只提供 auth 骨架。
- **A06 — 易受攻擊與過期的元件（Vulnerable & Outdated Components）** — 預設沒有接任何相依套件 CVE 掃描器。請自行加上 Dependabot / `pip-audit` / `pnpm audit`。
- **A08 — 軟體與資料完整性失效（Software & Data Integrity Failures）** — 未設定 Subresource Integrity 或供應鏈簽章。
- **A09 — 安全日誌與監控失效（Security Logging & Monitoring Failures）** — 結構化日誌 + `request_id` 已存在（見 [`sre-observability.md`](sre-observability.md)），**但**你必須為自己的環境接好 Sentry 告警與日誌保留；若沒有 `SENTRY_DSN_SERVER`，開箱即用狀態下不會有任何告警。
- **A10 — 伺服器端請求偽造（SSRF）** — 未設定對外請求 allowlist；若你新增會抓取使用者提供 URL 的程式碼，SSRF 的防護由你負責。

---

## 3. Fork 上線前檢查清單（pre-flight）

複製貼上，在第一次生產部署前執行。每個指令都是 repo 中真實存在的。

```bash
# 1. 產生兩把「不同」的簽署金鑰
openssl rand -hex 32   # 貼到 SECRET_KEY
openssl rand -hex 32   # 貼到 REFRESH_SECRET_KEY（必須不同！）

# 2. 在 server/.env（開發）與主機環境變數（生產）設定 secrets：
#    SECRET_KEY、REFRESH_SECRET_KEY、DATABASE_URL（PostgreSQL，不是 SQLite）、
#    真實的 EMAIL_PROVIDER（mailgun/zeabur）+ 金鑰、若有使用則設 OAuth IDs。

# 3. 執行生產就緒診斷 — 把每個 ❌ 都修掉：
make doctor-production
#    檢查項目（scripts/doctor-production.sh）：placeholder/空值/太短的 secret、
#    SECRET_KEY != REFRESH_SECRET_KEY、PostgreSQL（非 SQLite）、email provider
#    不是 'console'、至少一個 OAuth provider、無待處理 migration、
#    DEBUG 關閉、ALLOWED_ORIGINS_STR 不含 'localhost'、金鑰長度 >= 32、
#    client build 成功。
```

接著用肉眼確認：

- [ ] 生產環境有設 `ENVIRONMENT=production` — 這才會讓 `validate_production_config()` 真正執行（開發/測試會提前 return）。見 `config.py:143-144`。
- [ ] `ALLOWED_ORIGINS_STR` 是**你的**網域、以逗號分隔 — **不是** `*`、不是 `localhost`。CORS 在 `main.py:53` 讀取它。
- [ ] `SECRET_KEY` 與 `REFRESH_SECRET_KEY` 是兩個不同的 64 位元 hex 值，且都不是 placeholder。
- [ ] `DATABASE_URL` 在生產環境是 PostgreSQL（`postgresql+asyncpg://...`），絕非 SQLite。
- [ ] 生產環境 `DEBUG` 為 `false`/未設定（讓 `/docs` + `/redoc` 維持關閉 — `main.py:32-33`）。
- [ ] 你客製化過程中沒有在 `client/src/` 加入 `dangerouslySetInnerHTML`。

只要 `make doctor-production` 以 `0` 結束、且上面的方塊都勾選，你繼承來的安全姿態就完好無損。

---

## 4. 延伸閱讀（See also）

- [`docs/SECRET_ROTATION.md`](../../SECRET_ROTATION.md) — 零停機的 JWT secret **輪替**（雙金鑰 `*_PREVIOUS`）。本設定指南的生命週期搭檔。
- [`deploy-guide.md`](deploy-guide.md) — 選擇平台，以及各主機放 secret 的位置。
- [`deploy-walkthrough.md`](deploy-walkthrough.md) — 第一次部署的逐步教學。
- [`sre-observability.md`](sre-observability.md) — 日誌、`request_id` 排查、Sentry（涵蓋 A09 接線）。
- 本指南所描述閘門的真實來源：[`server/app/core/config.py`](../../../server/app/core/config.py)、[`server/app/main.py`](../../../server/app/main.py)、[`scripts/doctor-production.sh`](../../../scripts/doctor-production.sh)。
