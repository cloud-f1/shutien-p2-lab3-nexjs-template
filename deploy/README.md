# Deployment — 部署說明

> **⚠️ 本文件已過時 / This document is outdated**
>
> 以下內容描述的是舊版 Vite SPA + FastAPI 雙服務架構（GCR + 雙 container），  
> 該架構已於 Phase 53–54 遷移至 Next.js 單服務架構。  
> The content below describes the legacy Vite SPA + FastAPI dual-service architecture (GCR + dual containers),  
> which was migrated to a Next.js single-service architecture in Phases 53–54.
>
> **目前的部署指南請參閱：**  
> **For current deployment documentation, see:**
>
> - **Road 1（主要 / Primary）— Zeabur:** [`docs/guides/deployment-zeabur.md`](../docs/guides/deployment-zeabur.md)
> - **Road 2 — GCP Cloud Run:** coming in E256

---

## 現行架構 / Current Architecture (Phase 54+)

```
GitHub repo
  └── next-app/           ← 單一 Next.js 服務 / single Next.js service
        ├── Dockerfile    ← 多階段建置 / multi-stage build
        └── zbpack.json   ← Zeabur zbpack 設定 / Zeabur zbpack config

Zeabur
  ├── next-app service    ← Next.js (node:22-alpine, standalone output)
  └── PostgreSQL service  ← Zeabur managed DB → DATABASE_URL
```

**快速開始 / Quick start:** 參閱 [`docs/guides/deployment-zeabur.md`](../docs/guides/deployment-zeabur.md)

---

## 舊版內容（僅供歷史參考）/ Legacy Content (Historical Reference Only)

以下為遷移前的 GCR + 雙服務架構說明。不適用於目前的 Next.js 版本。  
The following describes the pre-migration GCR + dual-service setup. Not applicable to the current Next.js version.

- **GitHub**: https://github.com/cloud-f1/ai-coding-template
- **GCR Registry**: `asia-east1-docker.pkg.dev/common-411213` *(deprecated)*
- **Zeabur Template**: https://zeabur.com/templates/N8Y5Q5 *(deprecated — dual-service template)*

舊版使用 FastAPI `server/` + Vite `client/` 雙容器，透過 GitHub Actions 推送至 GCR，  
再由 Zeabur 從 GCR 拉取 image 部署。此流程已不再維護。  
The legacy flow used FastAPI `server/` + Vite `client/` dual containers pushed to GCR via GitHub Actions  
and deployed by Zeabur pulling from GCR. This flow is no longer maintained.
