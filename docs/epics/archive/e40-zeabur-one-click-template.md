# E40 — Zeabur 一鍵部署模板

> **Priority**: P2
> **Estimate**: 8 points
> **Dependencies**: None
> **Phase**: 15 — Distribution & Marketplace
> **Source**: User request — publish template to Zeabur marketplace for one-click deploy

---

## Problem Statement

專案目前透過 Git push + zbpack 部署到 Zeabur，但新使用者無法一鍵複製整個 stack。
Zeabur Template 讓任何人都能一鍵部署 PostgreSQL + FastAPI server + React client 完整堆疊，
是將此 SaaS template 從「clone → 手動設定」提升到「一鍵啟動」的關鍵步驟。

---

## Research Summary

### 部署方式比較

| 方式 | 優點 | 缺點 |
|------|------|------|
| **A: PREBUILT_V2 (Docker image)** | 啟動最快、版本可控 | 需建 Dockerfile + CI push image |
| **B: GIT template** | 不需 Docker image、直接用現有 repo | 需 public repo + repoID、build 時間較長 |
| **C: Zeabur CLI deploy** | 最簡單、`npx zeabur template deploy -f` | 僅供測試、不上架 marketplace |

### 建議方案：PREBUILT_V2 (方案 A)

理由：
1. 使用者一鍵部署速度最快（不需等 build）
2. 版本可鎖定（production-ready image tag）
3. 與 template marketplace 的標準做法一致
4. Dockerfile 本身也提升了 Docker Compose 本地開發體驗

### GIT 方式備註

Zeabur Template 支援 `template: GIT`，需要：
- `spec.source.type: GITHUB`
- `spec.source.repoID:` GitHub repo 的數字 ID（`gh api repos/OWNER/REPO --jq .id`）
- 選填 `spec.source.branch: main`

如果不想維護 Docker image，GIT 方式是 fallback 方案。但部署速度較慢，
且使用者每次都要等完整 build。

---

## Stories

### S01 — Server Dockerfile (2 pts) ✅

**Goal**: 為 FastAPI server 建立 production-ready Docker image

**AC**:
- [x] `server/Dockerfile` — single-stage slim build（已有，已加強）
- [x] pip 安裝依賴（保持現有 requirements.txt 方式）
- [x] Runtime: `python:3.12-slim`、非 root user (`appuser`)
- [x] Entrypoint: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- [x] `.dockerignore` 排除 test files、`__pycache__`、`.env`、coverage、uv.lock
- [ ] 本機 `docker build` + `docker run` 驗證通過

### S02 — Client Dockerfile (2 pts) ✅

**Goal**: 為 React client 建立 production-ready Docker image（nginx static serve）

**AC**:
- [x] `client/Dockerfile` — multi-stage build（node build + nginx runtime，已有）
- [x] Build stage: `pnpm install && pnpm build`，接受 `VITE_API_URL` build arg
- [x] Runtime: `nginx:alpine`，port 3000
- [x] nginx config 支援 SPA fallback（`try_files $uri /index.html`）
- [x] `.dockerignore` 排除 `node_modules`、`coverage`、test files
- [ ] 本機 `docker build --build-arg VITE_API_URL=http://localhost:8000` 驗證

### S03 — GitHub Actions: Build & Push Image (1 pt) ✅

**Goal**: CI 自動 build + push Docker image 到 GHCR

**AC**:
- [x] `.github/workflows/docker-publish.yml`
- [x] Trigger: push tag `v*` + manual `workflow_dispatch`
- [x] Build `server` + `client` image 平行（parallel jobs）
- [x] Push to `ghcr.io/cloud-f1/ai-coding-template-server:latest` + `ghcr.io/cloud-f1/ai-coding-template-client:latest`
- [x] Tag with git SHA + semver + latest
- [ ] 驗證 image 可 pull

### S04 — Zeabur Template YAML (2 pts) ✅

**Goal**: 撰寫完整 Zeabur 一鍵部署模板

**AC**:
- [x] `zeabur-template.yaml` 放在 repo root
- [x] Schema 驗證：`# yaml-language-server: $schema=https://schema.zeabur.app/template.json`
- [x] 3 個服務定義：
  - `postgresql` — Prebuilt `postgres:16-alpine`、volume、expose 連線資訊
  - `server` — PREBUILT_V2、依賴 postgresql、所有 env vars 正確引用
  - `client` — PREBUILT_V2、依賴 server、domain binding
- [x] Variables: `PUBLIC_DOMAIN` (DOMAIN)、`API_DOMAIN` (DOMAIN)
- [x] 密碼用 `${PASSWORD}` 自動生成
- [x] `DATABASE_URL` 用 `postgresql+asyncpg://` scheme（非預設 `postgresql://`）
- [x] Localization: `zh-TW`、`zh-CN` 翻譯
- [x] README section 含使用說明（英/繁/簡）

### S05 — 測試部署 & 發布 (1 pt)

**Goal**: 驗證 template 可正常一鍵部署

**AC**:
- [ ] `npx zeabur@latest template deploy -f zeabur-template.yaml` 成功
- [ ] Health check `GET /health` 回 200
- [ ] Client 可訪問、API 連線正常
- [ ] `npx zeabur@latest template create -f zeabur-template.yaml` 發布
- [ ] 取得 template code，分享用 URL 可用

---

## Technical Notes

### VITE_API_URL Runtime 注入（S02 關鍵挑戰）

`VITE_API_URL` 是 build-time 環境變數，打包進 JS bundle。Zeabur 使用者的 API domain 在 deploy 時才確定。

**解法：nginx envsubst**
```dockerfile
# 在 entrypoint 用 envsubst 替換 placeholder
RUN echo 'window.__ENV__ = { API_URL: "${VITE_API_URL}" };' > /usr/share/nginx/html/env-config.js
```

或在 build stage 用 placeholder，runtime `sed` 替換：
```bash
# entrypoint.sh
sed -i "s|__API_URL_PLACEHOLDER__|${VITE_API_URL}|g" /usr/share/nginx/html/assets/*.js
```

### Zeabur 內建變數速查

| 變數 | 用途 |
|------|------|
| `${PASSWORD}` | 自動生成安全密碼 |
| `${CONTAINER_HOSTNAME}` | 服務間內部通訊 hostname |
| `${ZEABUR_WEB_URL}` | 服務的完整公開 URL |
| `${ZEABUR_WEB_DOMAIN}` | 網域名稱（不含 protocol） |
| `${POSTGRES_HOST}` | PostgreSQL 主機（需 expose） |

### Zeabur CLI 常用指令

```bash
npx zeabur@latest auth login           # 登入
npx zeabur@latest template deploy -f   # 測試部署
npx zeabur@latest template create -f   # 發布到 marketplace
npx zeabur@latest template update -c   # 更新已發布 template
```

---

## Out of Scope

- Docker Compose 本地開發優化（已有 `docker-compose.yml`）
- Zeabur 付費方案設定（使用者自行在 Zeabur dashboard 選擇）
- Custom domain SSL（Zeabur 自動處理）
- GIT template 方式（作為 fallback，不在此 epic 實作）
