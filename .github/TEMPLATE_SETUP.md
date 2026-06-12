# GitHub Template Repository 設定指南

此文件說明如何將 `ai-coding-template` 設定為 GitHub Template Repository，讓其他使用者可以透過 "Use this template" 按鈕一鍵建立新專案。

> **注意**：這是 repo owner 的一次性設定，不需重複執行。

---

## 設定步驟

### 1. 啟用 Template Repository

1. 前往 GitHub repo 頁面
2. 點擊 **Settings**（齒輪圖示）
3. 在 **General** 頁面中，找到 **Template repository** 選項
4. 勾選 **Template repository** 核取方塊

### 2. 確認必要檔案

確認以下檔案已 commit 至 `main` 分支：

- [x] `.github/template-cleanup.sh` — Post-clone 清理腳本
- [x] `README.md` — 包含 "Use this template" 使用流程
- [x] `CONTRIBUTING.md` — 貢獻指南
- [x] `LICENSE` — MIT 授權
- [x] `.github/ISSUE_TEMPLATE/` — Issue 模板

### 3. 設定 Repository Topics

在 repo 首頁的 **About** 區域，點擊齒輪圖示，加入以下 Topics：

```
saas-template
claude-code
fastapi
react
ai-agents
typescript
python
```

### 4. 設定 Repository Description

```
Full-stack SaaS template with AI Agent workflows for Claude Code
```

### 5. 設定 About 連結（選填）

如果有部署的 Demo 網站，在 **About** 區域加入 Website 連結。

---

## 使用者流程

設定完成後，使用者的操作流程為：

1. 在 GitHub 上點擊 **"Use this template"** → **"Create a new repository"**
2. 命名新 repo，選擇 Public 或 Private
3. Clone 新建的 repo
4. 執行清理腳本：
   ```bash
   bash .github/template-cleanup.sh
   ```
5. 執行互動式設定：
   ```bash
   pnpm install && pnpm new-site
   ```

---

## 此文件的生命週期

`template-cleanup.sh` 執行時會自動刪除此文件，因為新專案不需要此設定指南。
