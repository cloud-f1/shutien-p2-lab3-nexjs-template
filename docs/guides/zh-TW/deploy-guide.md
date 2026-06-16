# 部署決策指南

> 在部署之前，先選擇適合的平台。本指南幫助初學者在 Zeabur、Cloud Run 和本地生產環境之間做選擇。

---

## 決策流程圖

```
你是否需要使用 GCP？（公司/學校/工作要求）
  |
  +-- 是 --> Cloud Run
  |
  +-- 否 --> 你想要最簡單的部署方式嗎？
              |
              +-- 是 --> Zeabur（推薦給初次部署者）
              |
              +-- 否 --> 你想要免費算力 + 更多控制權嗎？
                          |
                          +-- 是 --> Cloud Run（免費算力，資料庫約 $7/月或用 Neon 免費方案）
                          |
                          +-- 否 --> Zeabur
```

**簡單來說** — 如果不確定，先選 **Zeabur**。之後隨時可以遷移。

---

## 比較表

| 項目 | Zeabur | Cloud Run | 本地生產環境 |
|------|--------|-----------|-------------|
| **複雜度** | 低 — GitHub 登入，一鍵部署 | 中 — gcloud CLI，Docker 建置 | 中 — docker-compose |
| **月費** | ~$5–15（Hobby 方案） | ~$0–7（免費算力，資料庫另計） | $0（使用自己的硬體） |
| **冷啟動** | 極少（付費方案常駐） | 有（0→1 擴展，約 2-5 秒） | 無 |
| **區域** | 有限（美國/亞洲） | 30+ GCP 區域 | 不適用 |
| **資料庫** | 一鍵 PostgreSQL 附加服務 | Cloud SQL（~$7/月）或 Neon/Supabase（免費） | Docker PostgreSQL |
| **密鑰管理** | 控制台 UI | Secret Manager 或環境變數 | `.env` 檔案 |
| **自訂網域** | 支援（免費 SSL） | 支援（透過 Cloud Run 映射免費 SSL） | 手動設定（nginx + certbot） |
| **CI/CD** | git push 自動部署 | Cloud Build 或 GitHub Actions | 手動 |
| **適合場景** | 個人專案、MVP、展示 | 正式應用、團隊、合規需求 | 僅限本地測試 |

---

## 平台詳情

### Zeabur（推薦給初次部署者）

**簡介**：從 GitHub repo 直接部署的 PaaS 平台，設定極少。

**選擇理由**：
- 用 GitHub 帳號登入 — 不需學習雲端主控台
- 一鍵 PostgreSQL — 不需手動設定資料庫
- push 即自動部署 — 不需設定 CI/CD 流程
- 內建網域 + 免費 SSL

**費用概估**：
- Hobby 方案：~$5/月（含小型資料庫）
- Developer 方案：~$15/月（更多資源、自訂網域）

**開始使用**：
```bash
# 1. 檢查前置條件
make doctor-deploy PLATFORM=zeabur

# 2. 部署
make deploy
```

### Cloud Run（更多控制權）

**簡介**：Google Cloud 的無伺服器容器平台。推送 Docker 映像，GCP 負責運行。

**選擇理由**：
- 免費方案：每月 200 萬次請求、180,000 vCPU 秒
- 全球 30+ 區域
- 精細的擴展控制（0→N 實例）
- IAM、VPC、稽核日誌滿足合規需求

**費用概估**：
- 算力：免費方案足夠大多數個人專案
- 資料庫：Cloud SQL ~$7/月（最小實例）或 Neon/Supabase 免費方案
- 總計：低流量應用約 $0–7/月

**開始使用**：
```bash
# 1. 檢查前置條件
make doctor-deploy PLATFORM=cloudrun

# 2. 建置並推送（參考 Cloud Run 部署指南）
gcloud run deploy
```

### 本地生產環境（僅限測試）

**簡介**：在本機執行生產 Docker 環境進行測試。

**選擇理由**：
- 在部署前驗證生產建置是否正常
- 不需雲端帳號
- 適合在本地網路做展示

**開始使用**：
```bash
# 建置並啟動完整生產風格環境（postgres + migrate + web）
make docker-up      # → http://localhost:3000（停止：make docker-down）
```

> **注意**：本地生產環境僅供測試使用。缺少 SSL、監控、備份和自動重啟功能。

---

## 該選哪個？

| 如果你是... | 選擇 |
|------------|------|
| 學生做課堂專案 | **Zeabur** — 最簡單的設定，價格實惠 |
| 獨立開發者發布 MVP | **Zeabur** — 快速迭代，自動部署 |
| 團隊需要合規/稽核日誌 | **Cloud Run** — IAM、VPC、稽核追蹤 |
| 公司已在使用 GCP | **Cloud Run** — 與現有基礎設施一致 |
| 在本地測試生產建置 | **本地生產環境** — 不需雲端帳號 |
| 還不確定 | **Zeabur** — 最容易上手，之後再遷移 |

---

## 前置條件檢查

部署前，確認你的工具已就緒：

```bash
# 檢查平台特定的前置條件
make doctor-deploy PLATFORM=zeabur
make doctor-deploy PLATFORM=cloudrun
```

這會執行前置條件檢查器，驗證 CLI 工具、認證狀態和平台設定。

**第一次生產部署前**，也請完成 [`fork-security-setup.md`](fork-security-setup.md) — 產生你的 secrets、執行 `make doctor-production`，並確認你沒有削弱繼承來的 OWASP Top 10 防禦。

---

## 下一步

1. 使用你選擇的平台執行 `make doctor-deploy`
2. 修復檢查器標記的問題
3. 依照平台的部署說明操作：
   - Zeabur：`make deploy`
   - Cloud Run：參考 GCP 文件執行 `gcloud run deploy`
   - 本地：`make docker-up`
