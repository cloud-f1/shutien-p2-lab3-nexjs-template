---
title: "白皮書 — @saas Next.js 模組化 Registry 模板"
description: "完整範圍白皮書：Next.js 16、模組化 registry、AI 輔助開發，以及帳務抽象層。"
---

# @saas 模板白皮書

**Next.js + 模組化 Registry + AI 輔助 SaaS 開發**

> 版本 1.0 · 2026 年 6 月 · [English Version](/whitepaper/en)

---

## 執行摘要

**@saas 模板**是一套即開即用的 Next.js SaaS 起手式，將 2–4 週的基礎建設壓縮為一個 clone 指令。三大策略軸心：

1. **模組化 Registry** — 透過 shadcn registry 協議，以可組合的 block 形式安裝功能
2. **AI 輔助開發** — 12 個專業化的 Claude Code Agent 自動化完整的 spec→deploy 流程
3. **帳務抽象層** — `PaymentProvider` 介面讓你只需更改一個環境變數即可切換 Stripe ↔ ECPay

本白皮書記錄架構設計、Phase 56 模組系統，以及未來路線圖。

---

## 1. 問題

每個 SaaS 專案都從相同的基礎開始：

- 認證（註冊、登入、密碼重設、OAuth）
- 授權（角色型存取控制）
- 資料庫設定（Schema、Migration、ORM）
- 後台管理（使用者管理）
- 行銷首頁
- 付款整合（訂閱、Webhook）
- 部署流水線（CI/CD、環境管理）
- 開發者工具（測試、Lint、型別檢查）

正確建置這些基礎設施需要 **2–4 週**。大多數團隊因為趕時程而倉促完成，累積技術債，然後花接下來一年修復認證漏洞和 RBAC 缺口。

@saas 模板消除了這些成本。

---

## 2. 解決方案架構

### 2.1 Next.js App Router（Next.js 16）

模板使用 **Next.js 16 App Router**，採用：

- **React Server Components（RSC）**作為預設 — 只在需要瀏覽器 API、事件處理器或 state 時加上 `"use client"`
- **Server Actions**（`"use server"`）處理 mutation — 內部狀態不需要 REST 層
- **Route Handlers**（`app/api/`）處理跨域可呼叫的 endpoint（OAuth callback、Webhook）
- **巢狀 Layout** 用於路由群組：`(auth)/`、`(dashboard)/`、`(marketing)/`

### 2.2 模組化 Registry（E229–E230）

Registry 遵循 **shadcn/ui registry 協議**：

```
next-app/registry.json          — registry 清單（名稱、項目）
next-app/registry/<id>/         — 模組原始檔案
  module.manifest.json          — 宣告路由、Actions、DB 表格、環境變數
  components/                   — React 元件
  actions/                      — Server Actions
  app/                          — 路由檔案
```

**安裝模組：**

```bash
npx shadcn@latest add @saas/landing
```

這會依照 `module.manifest.json` 中的 `target` 路徑，將模組的檔案複製到你的 `next-app/`。沒有神奇的 post-install 腳本 — 純粹的檔案複製 + 手動接線步驟。

**驗證所有 Manifest：**

```bash
pnpm module:validate     # 驗證 JSON Schema + 必要欄位
pnpm registry:build      # 建置並驗證 registry 匯出
```

### 2.3 認證（NextAuth v5）

認證使用 **NextAuth v5** 搭配 JWT 策略：

- Session 為**無狀態** — 無需 DB Session 表
- JWT 儲存在 httpOnly cookie（生產環境）或記憶體中（開發環境）
- OAuth 提供者：Google、GitHub（在 `auth.config.ts` 中新增更多）
- Email/密碼透過 `Credentials` provider 搭配 bcrypt

### 2.4 三層 RBAC

角色：`viewer` → `editor` → `admin`

```ts
// lib/is-admin.ts
export const isAdmin = (role: string) => role === 'admin'
export const isEditor = (role: string) => ['editor', 'admin'].includes(role)

// lib/permissions.ts
export async function requireRole(minRole: Role): Promise<Session> {
  const session = await auth()
  if (!session) redirect('/login')
  if (!hasRole(session.user.role, minRole)) notFound()
  return session
}
```

每個受保護的 Server Action 的第一行都呼叫 `requireRole()`。

### 2.5 帳務抽象層（E231）

`PaymentProvider` 介面跨提供者標準化帳務：

```ts
interface PaymentProvider {
  createCheckoutSession(params: CheckoutParams): Promise<{ url: string }>
  createPortalSession(params: PortalParams): Promise<{ url: string }>
  handleWebhook(payload: string, signature: string): Promise<WebhookEvent>
  syncSubscription(customerId: string): Promise<Subscription>
}
```

只需一個環境變數即可切換提供者：`PAYMENT_PROVIDER=stripe` 或 `PAYMENT_PROVIDER=ecpay`。

### 2.6 資料庫（Drizzle + PostgreSQL）

- **Drizzle ORM** — 型別安全的 Schema，零執行時開銷
- **PostgreSQL 15** — 生產級別，透過 Zeabur 或自架管理
- Migration 透過 `pnpm db:generate` + `pnpm db:migrate`
- Schema：`users`、`accounts`、`sessions`、`verificationTokens`、`plans`、`subscriptions`、`payment_events`

---

## 3. Phase 56 模組目錄

Phase 56 透過 registry 提供四個生產模組：

| 模組 | 路由 | 說明 |
|------|------|------|
| `@saas/landing` | `/` | 行銷首頁：Hero、Features、Pricing、FAQ、CTA |
| `@saas/account` | `/dashboard/settings` | 個人資料、修改密碼、刪除帳號 |
| `@saas/admin` | `/dashboard/admin` | 使用者表格、角色選擇器（僅限管理員） |
| `@saas/billing` | `/dashboard/billing` | Stripe/ECPay 結帳 + 客戶入口 |

每個模組提供一個 `module.manifest.json`，宣告其完整介面：

```json
{
  "id": "landing",
  "version": "1.0.0",
  "routes": ["(marketing)/page.tsx"],
  "serverActions": [],
  "dbTables": [],
  "docs": "/docs/modules/landing",
  "demo": { "path": "/", "iframeSrc": "..." }
}
```

---

## 4. AI 輔助開發

模板搭配 **Claude Code** 和 12 個 AI Agent 團隊，實現自動化開發。

### 4.1 Epic 驅動的流水線

```
/athena:spec "功能"    → 規格設計
/athena:implement      → TDD 實作
/athena:qa             → 審查 + 測試 + 驗收
/athena:pr             → commit + PR
```

### 4.2 Agent 架構

每個 Agent 是 `.claude/agents/` 中的一個範圍化 Markdown 檔案，帶有 YAML 前置資料，定義：
- 模型（sonnet / opus）
- 允許的工具
- 特定指令和輸出格式

Agent 透過 orchestrator 呼叫子 Agent，並將結果寫入 `docs/context/` 以實現跨 Session 持久性。

### 4.3 記憶體系統

兩層知識持久化：
- **Tier 0**（`~/.claude/template-memory/`）— 跨專案智慧，15 個精選課程檔案
- **Tier 1**（`docs/context/`）— 專案特定狀態，16 個上下文檔案

`/athena:promote` 透過 `@memory-curator` Agent 將高信號課程從 Tier 1 提取到 Tier 0。

### 4.4 工作量調節

`--effort <tier>` 調整 Agent 深度與成本：

| 層級 | 並發數 | 迭代次數 | 閾值 |
|------|--------|----------|------|
| `quick` | 1 | 1 | 0.80 |
| `standard` | 4 | 4 | 0.85 |
| `thorough` | 4 | 6 | 0.90 |
| `ultra` | 16 | 8 | 0.95 |

---

## 5. 開發者體驗

### 5.1 零樣板 Fork

```bash
git clone https://github.com/qwedsazxc78/ai-coding-nexjs-template.git
cd ai-coding-nexjs-template/next-app
pnpm install && pnpm dev
```

不到一小時完成第一個 Epic。

### 5.2 品質關卡

- **型別檢查：** `pnpm typecheck`（強制零錯誤）
- **Lint：** `pnpm lint`（eslint-config-next）
- **單元測試：** `pnpm test`（Vitest，≥80% 覆蓋率關卡）
- **E2E 測試：** `pnpm test:e2e`（Playwright，冒煙測試關卡）
- **Stop Verifier：** 23 條規則在違規時阻止完成（console.log、RBAC 缺口等）

### 5.3 模組驗證

```bash
pnpm module:validate     # 驗證所有 module.manifest.json 檔案
pnpm registry:build      # 建置 registry 匯出 + 驗證完整性
```

---

## 6. 部署

模板以單一服務形式部署到 **Zeabur**。Migration 在啟動時執行。

`dev-docs/` 站台（本文件）透過 `gh-cf-deploy` skill 部署到 **Cloudflare Pages**。

完整配置請參閱[部署指南](/docs/deployment)。

---

## 7. 路線圖

| Phase | 重點 |
|-------|------|
| 57 | 團隊 + 多租戶工作區 |
| 58 | 通知系統（應用內 + Email + Webhook） |
| 59 | 分析儀表板 + 使用量指標 |
| 60 | 白標主題 + 自訂網域支援 |

---

## 8. 結論

@saas 模板為任何開發者提供了可 fork 並在幾天內上線的生產級別基礎。其模組化 registry、AI Agent 團隊和帳務抽象層相結合，消除了最常見的 SaaS 樣板成本 — 讓你專注於使你的產品與眾不同的核心功能。

**立即開始：** [快速入門指南](/docs/getting-started) · [模組目錄](/modules/) · [GitHub](https://github.com/qwedsazxc78/ai-coding-nexjs-template)
