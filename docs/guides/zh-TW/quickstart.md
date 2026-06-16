# 快速入門（Quickstart）

> 從 clone 到啟動 dev server，最快只需 **2 個指令**。

---

## 最快起步：`make go`

```bash
git clone https://github.com/your-org/ai-coding-template.git
cd ai-coding-template
make go
```

`make go` 會自動完成以下所有步驟：

1. 檢查前置工具（Node >= 22、pnpm、Docker）
2. 安裝所有依賴（pnpm install）
3. 產生 `next-app/.env`（含自動產生的 JWT/Auth.js 密鑰）
4. 啟動 PostgreSQL + Mailpit（Docker）
5. 執行資料庫遷移（Drizzle）
6. 建立 demo 帳號（seed）
7. 啟動 Next.js 開發伺服器

完成後：

- **應用程式**：`http://localhost:3000`（Next.js dev server — 打開它，逛逛 landing page 與 dashboard）
- **Mailpit**：`http://localhost:8025`（開發用郵件 UI）

> **第一次使用？** 打開 `http://localhost:3000`，逛逛 landing page 與 dashboard，感受一下模板的功能。

### 純 Docker 起步（不需安裝 Node）

如果你只有 Docker，可以用一個指令啟動整個開發環境（Postgres + 應用程式 + mailpit）：

```bash
docker compose up --build -d
```

這會啟動 PostgreSQL + Next.js 應用程式（含自動遷移與 hot-reload）+ Mailpit，完全不需在本機安裝 Node。

- **應用程式**：`http://localhost:3000`（Next.js，hot-reload）
- **Mailpit**：`http://localhost:8025`

> **macOS 效能提示**：Docker volume mount 在 macOS 上可能較慢，如果感覺 hot-reload 延遲，可考慮使用 [mutagen](https://mutagen.io/) 加速。

---

> **替代方案：Interactive Site Builder**
>
> 如果你想從互動式精靈開始（可自訂專案名稱、主題、功能模組等），
> 可以在 clone 後執行 `pnpm new-site`。這是 E21 建立的 CLI 工具，
> 會引導你完成專案初始化。完成後執行 `make go` 即可啟動。
> 詳見 [E21 說明](../../epics/EPIC_INDEX.md)。

---

## 手動設定（進階使用者）

以下是 `make go` 背後的各個步驟，適合想要了解細節或自訂設定的使用者。

### 前置需求

請確認以下工具已安裝在你的系統上：

| 工具 | 最低版本 | 用途 |
|------|----------|------|
| Node.js | >= 22 | Next.js 建置與 CLI 工具 |
| pnpm | >= 8 | Node 套件管理 |
| Docker | 最新版 | 資料庫（PostgreSQL 容器）+ 完整本機環境 |
| git | >= 2 | 版本控制 |

> 執行 `make check-prereqs` 可一鍵驗證所有工具版本。

### 安裝指令

**macOS**（使用 Homebrew）：

```bash
# Node.js（建議透過 nvm 管理版本）
brew install nvm
nvm install 22
nvm use 22

# pnpm
npm install -g pnpm

# Docker
brew install --cask docker

# git（macOS 通常已預裝）
brew install git
```

**Linux（Ubuntu/Debian）**：

```bash
# Node.js（透過 nvm）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install 22
nvm use 22

# pnpm
npm install -g pnpm

# Docker
# 參考 https://docs.docker.com/engine/install/

# git
sudo apt-get install git
```

### 驗證版本

```bash
node --version    # 應顯示 v22.x.x 以上
pnpm --version    # 應顯示 8.x.x 以上
docker --version  # 應顯示版本號
git --version     # 應顯示 2.x.x 以上
```

---

### Step 1：安裝依賴

應用程式位於 `next-app/`，使用 pnpm 安裝它的 Node 依賴。

```bash
# 安裝 Node 依賴（在 next-app/ 執行）
cd next-app && pnpm install && cd ..
```

> `pnpm install` 會讀取 `next-app/package.json` 安裝所有依賴（含 dev 依賴），
> 安裝到 `next-app/node_modules/`。

---

### Step 2：資料庫設定

```bash
# 啟動 PostgreSQL + Mailpit（Docker）
make db

# 或手動：
docker compose up -d db mailpit
```

> 預設帳號為 `saas_user` / `saas_pass`，資料庫名稱 `saas_dev`。
> Mailpit UI 在 `http://localhost:8025`。

### 設定環境變數

```bash
# 自動產生（含隨機密鑰）：
make ensure-env

# 或手動複製：
cp next-app/.env.example next-app/.env
# 然後編輯 AUTH_SECRET（建議用 openssl rand -hex 32 產生）
```

---

### Step 3：執行資料庫遷移

```bash
make migrate

# 或手動，在 next-app/ 執行：
cd next-app && pnpm db:generate && pnpm db:migrate && cd ..
```

> `pnpm db:generate` 會從 schema 產生 Drizzle migration 檔案，
> `pnpm db:migrate` 則把它們套用到 PostgreSQL。

---

### Step 4：建立 demo 帳號（seed）

```bash
# 在 next-app/ 執行：
cd next-app && pnpm db:seed && cd ..
```

> **Seed 帳號**：seed 完成後，系統內建三組測試帳號（3 層 RBAC）：
>
> | 帳號 | 密碼 | 角色 |
> |------|------|------|
> | `admin@example.com` | `Admin123!` | Admin |
> | `editor@example.com` | `Editor123!` | Editor |
> | `viewer@example.com` | `Viewer123!` | Viewer |

---

### Step 5：啟動 Dev Server

```bash
make dev

# 或直接，在 next-app/ 執行：
cd next-app && pnpm dev
```

這會在 `http://localhost:3000` 提供整個應用程式 — UI、Server Actions 與 Route Handlers（`app/api`）。

### 驗證

| 服務 | URL | 預期結果 |
|------|-----|----------|
| 應用程式 | `http://localhost:3000` | Landing Page + Dashboard + API routes |
| Mailpit | `http://localhost:8025` | 開發用郵件 UI |

---

### Step 6：執行測試

```bash
make test

# 或直接，在 next-app/ 執行：
cd next-app && pnpm test
```

> **覆蓋率門檻**：本專案要求測試覆蓋率 **>= 80%**，低於此門檻會阻擋部署。
>
> 查看覆蓋率報告：
>
> ```bash
> # 在 next-app/ 執行：
> cd next-app && pnpm test:coverage && cd ..
> ```
>
> **端對端測試**用 Playwright（請先 seed 資料庫）：
>
> ```bash
> # 在 next-app/ 執行：
> cd next-app && pnpm db:seed && pnpm test:e2e && cd ..
> ```

---

## 常見問題（FAQ）

### PostgreSQL 連線失敗

**症狀**：`ConnectionRefusedError` 或 `could not connect to server`

**解決方案**：

```bash
# 確認 PostgreSQL 正在執行
# macOS:
brew services list | grep postgresql

# Linux:
sudo systemctl status postgresql

# 確認資料庫存在
psql -l | grep saas_dev
```

如果資料庫不存在，重新執行 `createdb saas_dev`。

### pnpm install 失敗

**症狀**：權限錯誤或 lockfile 衝突

**解決方案**：

```bash
# 清除快取後重新安裝（在 next-app/ 執行）
cd next-app
pnpm store prune
rm -rf node_modules
pnpm install
cd ..
```

### Port 衝突

**症狀**：`Address already in use`

**解決方案**：

```bash
# 找出佔用 port 的程序
lsof -i :3000  # 應用程式
lsof -i :8025  # Mailpit
lsof -i :5432  # PostgreSQL

# 結束佔用的程序
kill -9 <PID>
```

或修改啟動 port：

```bash
# 應用程式改用其他 port（在 next-app/ 執行）
cd next-app && pnpm dev -- -p 3001
# 或：
PORT=3001 pnpm dev
```

### Docker Compose 啟動問題

如果你使用 Docker 方式啟動 PostgreSQL：

```bash
# 確認容器狀態
docker compose ps

# 查看日誌
docker compose logs db

# 重新啟動
docker compose down
docker compose up -d db
```

---

## 下一步

恭喜你已成功啟動開發環境！接下來推薦的步驟：

1. **執行 `make verify`** — 檢查所有模板佔位符是否已自訂完成
2. **打開 [`http://localhost:3000`](http://localhost:3000)** — 逛逛 landing page 與 dashboard
3. **[第一個 Epic 實戰](first-epic-walkthrough.md)** — 手把手教你建立自訂 domain，完整走過 epic pipeline
4. **[TECHSTACK.md](../../../TECHSTACK.md)** — 深入了解技術架構
5. **[EPIC_INDEX.md](../../epics/EPIC_INDEX.md)** — 查看所有 Epic 的開發進度
6. **[學習路徑](learning-path.md)** — 查看所有指南的推薦閱讀順序
