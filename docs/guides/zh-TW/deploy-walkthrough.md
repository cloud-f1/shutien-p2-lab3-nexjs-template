# 部署你的應用 — 從 Clone 到正式上線

> 完整的逐步部署指南，涵蓋 Zeabur 和 Cloud Run 兩種路線。從頭跟到尾，不需要其他外部文件。

---

## 步驟 0：選擇你的平台

不確定該選哪個平台？先閱讀[部署決策指南](deploy-guide.md)。

**簡單來說** — 想要最簡單的路線就選 **Zeabur**。需要 GCP 或想要免費算力加上更多控制權就選 **Cloud Run**。

---

## 步驟 1：檢查前置條件

針對你選擇的平台執行前置條件檢查：

```bash
# Zeabur
make doctor-deploy PLATFORM=zeabur

# Cloud Run
make doctor-deploy PLATFORM=cloudrun
```

繼續之前先修復所有標記的問題。常見前置條件：

| 平台 | 需要的工具 |
|------|-----------|
| **Zeabur** | Docker、Zeabur CLI（`npm i -g zeabur`）、GitHub 帳號 |
| **Cloud Run** | Docker、`gcloud` CLI（已認證）、已啟用帳單的 GCP 專案 |

---

## 步驟 2：先在本地測試

部署到雲端之前，先在本機驗證生產建置是否正常：

```bash
make docker-prod
```

啟動後驗證：

- 瀏覽 `http://localhost:3000` — 應該看到首頁
- 瀏覽 `http://localhost:8080/health` — 應該回傳 `{"status": "ok"}`

如果任一檢查失敗，先在本地修復再部署。常見問題：

- **Port 衝突**：其他程序佔用了 3000 或 8080 port
- **缺少 `.env`**：執行 `make setup` 產生環境檔案
- **資料庫遷移錯誤**：確認 `server/.env` 中的 `DATABASE_URL` 正確

測試完成後按 `Ctrl+C` 停止本地生產環境。

---

## 步驟 3：首次部署

### 選項 A：Zeabur（推薦給初學者）

```bash
make deploy PLATFORM=zeabur ARGS="--first-time"
```

**每個關卡會發生什麼：**

1. **飛行前檢查** — 驗證 Docker 執行中、Zeabur CLI 已認證
2. **建置檢查** — 在本地建置生產 Docker 映像
3. **環境檢查** — 確認 Zeabur 控制台已設定必要的環境變數
4. **部署** — 推送到 Zeabur 並等待健康狀態
5. **冒煙測試** — 呼叫 `/health` 端點確認伺服器已啟動
6. **部署後** — 必要時執行資料庫遷移

**在哪裡找到你的應用 URL：**

1. 開啟 [Zeabur 控制台](https://dash.zeabur.com)
2. 選擇你的專案
3. 點擊 **server** 服務 → **Domains** 分頁 → 複製 URL
4. 點擊 **client** 服務 → **Domains** 分頁 → 複製 URL

**如何查看日誌：**

1. Zeabur 控制台 → 選擇服務 → **Logs** 分頁
2. 或透過 CLI：`zeabur logs --service server`

**設定環境變數：**

1. Zeabur 控制台 → 選擇服務 → **Variables** 分頁
2. 必要的變數：
   - `DATABASE_URL` — 使用 Zeabur PostgreSQL 附加服務時自動設定
   - `SECRET_KEY` — 使用 `openssl rand -hex 32` 產生
   - `REFRESH_SECRET_KEY` — 使用 `openssl rand -hex 32` 產生
   - `ALLOWED_ORIGINS` — 你的 client URL（例如 `https://your-app.zeabur.app`）
   - `VITE_API_URL` — 你的 server URL（在 **client** 服務上設定，必須在建置**之前**）

### 選項 B：Cloud Run

```bash
make deploy PLATFORM=cloudrun ARGS="--first-time"
```

**資料庫選擇：**

| 選項 | 費用 | 設定方式 |
|------|------|---------|
| **Cloud SQL** | ~$7/月（最小實例） | `gcloud sql instances create ...` — 託管式，自動備份 |
| **Neon**（免費方案） | $0 | 在 [neon.tech](https://neon.tech) 註冊，複製連線字串 |
| **Supabase**（免費方案） | $0 | 在 [supabase.com](https://supabase.com) 註冊，複製連線字串 |

使用免費方案的資料庫（Neon/Supabase）時，將 `DATABASE_URL` 設為 Cloud Run 環境變數，指向外部資料庫。

**在哪裡找到服務 URL：**

```bash
# 列出所有 Cloud Run 服務及其 URL
gcloud run services list --format="table(SERVICE,URL)"
```

或造訪 [Cloud Run 主控台](https://console.cloud.google.com/run)。

**如何查看日誌：**

```bash
# Server 日誌
gcloud run logs read --service=server --limit=50

# Client 日誌
gcloud run logs read --service=client --limit=50

# 或在 GCP 主控台使用 Cloud Logging
```

**設定環境變數：**

```bash
# 在 server 服務設定環境變數
gcloud run services update server \
  --set-env-vars="SECRET_KEY=$(openssl rand -hex 32)" \
  --set-env-vars="REFRESH_SECRET_KEY=$(openssl rand -hex 32)" \
  --set-env-vars="DATABASE_URL=postgresql+asyncpg://user:pass@host/db" \
  --set-env-vars="ALLOWED_ORIGINS=https://your-client-url.run.app"

# 在 client 服務設定 VITE_API_URL（需要重新建置）
gcloud run services update client \
  --set-env-vars="VITE_API_URL=https://your-server-url.run.app"
```

> **重要**：`VITE_API_URL` 在建置時寫入。如果更改了它，必須重新建置並重新部署 client。

---

## 步驟 4：驗證部署

部署完成後，驗證兩個服務都在執行：

```bash
# 檢查 server 健康狀態
curl https://your-server-url/health
# 預期回傳：{"status": "ok"}

# 檢查 client
open https://your-client-url
# 預期：首頁正確載入
```

**驗證清單：**

- [ ] `/health` 回傳 `{"status": "ok"}`
- [ ] 首頁正確載入且樣式正常
- [ ] 註冊流程可用（成功建立新使用者）
- [ ] 登入流程可用（回傳 JWT token）
- [ ] Client 的 API 呼叫能連到 Server（瀏覽器 console 沒有 CORS 錯誤）

---

## 步驟 5：後續部署

首次部署完成後，後續的重新部署更加簡單：

```bash
make deploy ARGS="--redeploy"
```

**這會做什麼：**

1. 建置新的 Docker 映像
2. 推送到你的平台
3. 執行資料庫遷移（如果有新的 Alembic 版本）
4. 對 `/health` 端點進行冒煙測試

**Zeabur 使用者**：如果啟用了自動部署，只要 `git push` 就能觸發新的部署。

**Cloud Run 使用者**：你也可以透過 Cloud Build 或 GitHub Actions 設定持續部署。

---

## 步驟 6：自訂網域（選用）

### Zeabur

1. Zeabur 控制台 → 選擇服務 → **Domains** 分頁
2. 點擊 **Add Custom Domain**
3. 在你的 DNS 供應商新增 CNAME 記錄，指向 Zeabur 提供的網域
4. SSL 憑證會自動配置

### Cloud Run

```bash
# 映射自訂網域
gcloud run domain-mappings create \
  --service=client \
  --domain=your-domain.com \
  --region=your-region

# 依照指令印出的 DNS 說明操作
# SSL 憑證會自動配置（可能需要幾分鐘）
```

---

## 疑難排解

### 常見問題

| 問題 | 症狀 | 修復方式 |
|------|------|---------|
| **VITE_API_URL 錯誤** | Client 呼叫錯誤的 API URL，瀏覽器出現網路錯誤 | 在建置**之前**在 client 服務設定 `VITE_API_URL`，然後重新建置 |
| **未執行遷移** | API 呼叫回傳 500 錯誤，日誌顯示 "relation does not exist" | 確認啟動指令包含 `alembic upgrade head`，檢查日誌中的遷移錯誤 |
| **CORS 錯誤** | 瀏覽器以 "CORS policy" 錯誤阻擋請求 | 將 server 的 `ALLOWED_ORIGINS` 設定為你的 client URL（包含 `https://`） |
| **冷啟動逾時** | 閒置後的第一個請求很慢或逾時 | Cloud Run：設定 `--min-instances=1` 保持一個實例常駐（每月約多 $3） |
| **資料庫連線被拒** | Server 回傳 500，日誌顯示 "connection refused" | 確認 `DATABASE_URL` 格式：`postgresql+asyncpg://user:pass@host:port/dbname` |
| **建置失敗** | 部署指令在建置步驟出錯 | 先在本地執行 `make docker-prod` 找出建置錯誤 |
| **SSL 無法運作** | 瀏覽器顯示「不安全」警告 | 等待 5-10 分鐘讓憑證配置完成；確認 DNS 記錄正確 |
| **記憶體不足** | 服務頻繁崩潰或重啟 | 增加記憶體限制：Zeabur 控制台或 `gcloud run services update --memory=512Mi` |

### 平台特定問題

**Zeabur：**

- **「找不到服務」**：確認你在 Zeabur 控制台連結了正確的 GitHub repo
- **環境變數未生效**：更改變數後重新部署（點擊「Redeploy」按鈕）
- **資料庫連線失敗**：使用 Zeabur PostgreSQL 附加服務提供的連線字串，不要用自訂的

**Cloud Run：**

- **「Permission denied」**：執行 `gcloud auth login` 並確認帳號有 Cloud Run Admin 角色
- **「Billing not enabled」**：在 [GCP 主控台](https://console.cloud.google.com/billing) 啟用帳單
- **映像推送失敗**：執行 `gcloud auth configure-docker` 設定 GCR/Artifact Registry 的 Docker 認證
- **服務無法啟動**：用 `gcloud run logs read --service=server` 檢查啟動錯誤

---

## 下一步

- 設定 [CI/CD 管線](ci-explained.md) 實現自動化測試和部署
- 閱讀[部署決策指南](deploy-guide.md)如果你想切換平台
- 執行 `make doctor-production` 審計你的正式環境設定
- 執行 `make verify` 確認 clone 後的客製化已完成
