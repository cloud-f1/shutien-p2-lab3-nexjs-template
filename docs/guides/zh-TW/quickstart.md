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

1. 檢查前置工具（Node >= 22、pnpm、Python >= 3.12、uv、Docker）
2. 安裝所有依賴（pnpm install + uv sync）
3. 產生 `server/.env`（含自動產生的 JWT 密鑰）
4. 啟動 PostgreSQL + Mailpit（Docker）
5. 執行資料庫遷移
6. 產生 TypeScript 類型
7. 啟動前後端開發伺服器

完成後：

- **入門導覽**：`http://localhost:5173/getting-started`（互動式導覽 — 從這裡開始！）
- **前端**：`http://localhost:5173`（Vite dev server）
- **後端 API**：`http://localhost:8080/docs`（Swagger UI）
- **Mailpit**：`http://localhost:8025`（開發用郵件 UI）

> **第一次使用？** 打開 `/getting-started` 跟著互動導覽認識模板功能，或執行 `make tutorial` 用 5 分鐘完成第一個 endpoint 練習。

### 純 Docker 起步（不需安裝 Node/Python）

如果你只有 Docker，可以用一個指令啟動整個開發環境：

```bash
docker compose --profile dev up
```

這會啟動 PostgreSQL + 後端（含自動遷移）+ 前端（含 hot-reload），完全不需安裝 Node 或 Python。

- **前端**：`http://localhost:5173`（Vite dev server，hot-reload）
- **後端 API**：`http://localhost:8080/docs`
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
| Node.js | >= 22 | 前端建置與 CLI 工具 |
| pnpm | >= 8 | Node 套件管理（workspace monorepo） |
| Python | >= 3.12 | 後端伺服器 |
| uv | 最新版 | Python 套件管理（取代 pip） |
| Docker | 最新版 | 資料庫（PostgreSQL 容器） |
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

# Python（建議透過 pyenv 管理版本）
brew install pyenv
pyenv install 3.12
pyenv global 3.12

# uv — Python 套件管理工具
curl -LsSf https://astral.sh/uv/install.sh | sh

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

# Python（透過 pyenv）
curl https://pyenv.run | bash
pyenv install 3.12
pyenv global 3.12

# uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Docker
# 參考 https://docs.docker.com/engine/install/

# git
sudo apt-get install git
```

### 驗證版本

```bash
node --version    # 應顯示 v22.x.x 以上
pnpm --version    # 應顯示 8.x.x 以上
python --version  # 應顯示 3.12.x 以上
uv --version      # 應顯示版本號
docker --version  # 應顯示版本號
git --version     # 應顯示 2.x.x 以上
```

---

### Step 1：安裝依賴

本專案使用 **pnpm workspace monorepo** 結構，根目錄的 `pnpm-workspace.yaml` 管理 `client` 和 `dev-docs` 兩個子專案。

```bash
# 安裝 Node 依賴（根目錄執行，會一併安裝所有 workspace 子專案）
pnpm install

# 安裝 Python 依賴（進入 server 目錄）
cd server && uv sync && cd ..
```

> `uv sync` 會根據 `pyproject.toml` 安裝所有依賴（含 dev 依賴），
> 並自動建立虛擬環境在 `server/.venv/`。

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
cp server/.env.example server/.env
# 然後編輯 SECRET_KEY 和 REFRESH_SECRET_KEY（建議用 openssl rand -hex 32 產生）
```

---

### Step 3：執行資料庫遷移

```bash
make migrate
```

> **Seed 帳號**：遷移完成後，系統內建兩組測試帳號：
>
> | 帳號 | 密碼 | 角色 |
> |------|------|------|
> | `admin@test.com` | `Admin#Pass1` | 超級管理員 |
> | `user@test.com` | `User#Pass1` | 一般使用者 |

---

### Step 4：產生 TypeScript 類型

```bash
make generate-types
```

---

### Step 5：啟動 Dev Server

```bash
make dev
```

或分別啟動：

```bash
# 終端 1 — 後端
cd server && uv run uvicorn app.main:app --reload

# 終端 2 — 前端
cd client && pnpm dev
```

### 驗證

| 服務 | URL | 預期結果 |
|------|-----|----------|
| 前端 | `http://localhost:5173` | Landing Page |
| 後端 API | `http://localhost:8080/health` | `{"status": "healthy"}` |
| Swagger UI | `http://localhost:8080/docs` | API 文件 |
| Docker 部署 | `http://localhost:3000` | 前端（nginx） |

---

### Step 6：執行測試

```bash
make test
```

> **覆蓋率門檻**：本專案要求前後端測試覆蓋率 **>= 80%**，低於此門檻會阻擋部署。
>
> 查看覆蓋率報告：
>
> ```bash
> # 後端
> cd server && uv run pytest --cov=app --cov-report=term-missing && cd ..
>
> # 前端
> cd client && pnpm test:coverage && cd ..
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
# 清除快取後重新安裝
pnpm store prune
rm -rf node_modules client/node_modules dev-docs/node_modules
pnpm install
```

### Python 版本不符

**症狀**：`pyproject.toml` 要求 `>=3.12` 但系統版本較舊

**解決方案**：

```bash
# 使用 pyenv 安裝正確版本
pyenv install 3.12
pyenv local 3.12

# 確認 uv 使用正確的 Python
uv python list
```

### Port 衝突

**症狀**：`Address already in use`

**解決方案**：

```bash
# 找出佔用 port 的程序
lsof -i :8000  # 後端
lsof -i :5173  # 前端
lsof -i :5432  # PostgreSQL

# 結束佔用的程序
kill -9 <PID>
```

或修改啟動 port：

```bash
# 後端改用其他 port
cd server && uv run uvicorn app.main:app --reload --port 8001

# 前端改用其他 port
cd client && pnpm dev --port 3000
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
2. **打開 [`/getting-started`](http://localhost:5173/getting-started)** — 互動式應用內導覽，認識模板功能
3. **執行 `make tutorial`** — 5 分鐘完成第一個 endpoint
4. **[第一個 Epic 實戰](first-epic-walkthrough.md)** — 手把手教你建立自訂 domain，完整走過 epic pipeline
5. **[TECHSTACK.md](../../../TECHSTACK.md)** — 深入了解技術架構
6. **[EPIC_INDEX.md](../../epics/EPIC_INDEX.md)** — 查看所有 Epic 的開發進度
7. **[學習路徑](learning-path.md)** — 查看所有指南的推薦閱讀順序
