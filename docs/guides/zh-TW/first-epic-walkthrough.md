# 第一個 Epic 實戰（First Epic Walkthrough）

> 手把手建立一個完整的自訂 domain，預估時間約 **30 分鐘**。

## 前言

完成本指南後，你將學會：

- **Epic-Driven Development** 的完整流程
- **規格先行（spec-first）** 的實踐：以共用 Zod 驗證 schema 作為契約
- **App Router** 檔案系統路由模型（資料夾*即*路由）
- **`/athena:domain`** 產生器的使用方式（E23）
- **Athena 指令** 在開發流程中的運用時機

### 前置條件

- 已完成 [快速入門](quickstart.md)，dev server 可正常啟動
- 已安裝 Claude Code CLI（用於執行 Athena slash commands）

---

## 核心概念速覽

### Epic-Driven Development

本專案所有功能開發都遵循 **Epic Pipeline**：

```
spec → implement → qa → commit → merge
```

每個 Epic 是一個獨立的功能單元，由 [EPIC_INDEX.md](../../epics/EPIC_INDEX.md) 統一追蹤進度。不允許脫離 Epic 的臨時開發。

### 規格先行（Spec-First Development）

**核心規則**：在寫實作前，先定義**契約**。本技術棧沒有 OpenAPI YAML — 契約是位於 `next-app/lib/validations/*.ts` 的共用 **Zod 驗證 schema**，作為單一真實來源（single source of truth），由 Server Actions 與前端表單共同 import。

流程順序：

1. 用 `/athena:spec` 設計功能 — 產生 epic/spec markdown（`docs/epics/` + `docs/specs/`），以及位於 `next-app/lib/validations/` 的共用 Zod schema 與推導出的型別
2. 加入資料庫 schema（`next-app/db/schema.ts` 中的 Drizzle 資料表）
3. 實作伺服器層（`next-app/actions/` 的 Server Actions 與／或 `next-app/app/api/` 的 Route Handlers）
4. 實作 UI（async Server Components + 前端表單）

### Athena 指令概覽

以下是開發流程中最常用的指令：

| 指令 | 用途 | 何時使用 |
|------|------|----------|
| `/athena:spec <feature>` | 設計功能規格 | 開始新 Epic 時，定義共用 Zod schema + spec |
| `/athena:domain <name>` | 產生完整 domain 骨架 | 建立新的資料 domain（模型+API+頁面） |
| `/athena:implement` | TDD 開發循環 | 從 spec 進入實作階段 |
| `/athena:qa` | 程式碼審查 + 測試 | 實作完成後，執行品質檢查 |
| `/athena:ship` | 快速發佈 | 審查 → 修正 → commit → PR |
| `/athena:loop` | Epic 推進器 | 自動判斷下一步並執行 |
| `/athena:loop status` | 查看當前狀態 | 確認 Epic 進度 |
| `/athena:pr` | 完整 PR 流程 | merge main → build → test → lint → PR |
| `/athena:deploy` | 部署到 Zeabur | 通過 6 道檢查門後部署 |
| `/athena:save` | 全體 Agent 存檔 | 結束工作前，保存所有 Agent 狀態 |
| `/athena:load` | 載入上下文 | 開始新 session，恢復完整狀態 |
| `/athena:plan` | 策略規劃 | 審計現況、提案新 Epic |
| `/athena:learn` | 記憶更新 | 刷新 MEMORY.md，偵測知識漂移 |
| `/athena:promote` | 提取通用經驗 | 將專案經驗推廣至全域記憶 |

> 完整的 Agent 團隊說明請參考 [CLAUDE.md](../../../CLAUDE.md)。

---

## 情境設定

我們將建立一個 **bookmark**（書籤管理）domain 作為示範。

### 為什麼選擇 bookmark？

- 簡單直觀 — 只有 2-3 個欄位
- CRUD 完整 — 建立、讀取、更新、刪除一應俱全
- 不與現有 domain 衝突（專案已有 `places` 和 `portfolios`）

### 預期資料欄位

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `url` | string | 是 | 書籤網址 |
| `title` | string | 是 | 書籤標題 |
| `notes` | text | 否 | 備註 |

> 系統會自動加入 `id`（UUID 主鍵）、`user_id`（外鍵關聯使用者）、
> `created_at` 和 `updated_at`（時間戳記），你不需要手動定義。

---

## Step 1：建立 Epic Entry

在開始任何開發前，先在 [EPIC_INDEX.md](../../epics/EPIC_INDEX.md) 登記新的 Epic。

在 Epic Step Matrix 中新增一行：

```markdown
| E99 | Bookmark Domain | S | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 書籤管理 CRUD |
```

> **命名慣例**：
>
> - Epic 編號：`E{數字}`（遞增，取下一個可用號碼）
> - 分支名稱：`feat/E99-bookmark-domain`
> - Commit 訊息：`feat(E99): Bookmark domain CRUD`

建立 feature 分支：

```bash
git checkout -b feat/E99-bookmark-domain
```

---

## Step 2：用 `/athena:domain` 產生骨架

這是最關鍵的一步。`/athena:domain` 是 E23 建立的 domain 產生器，會依照規格先行流程，**先產生共用 Zod 契約與 DB schema，再產生伺服器與 UI 程式碼**。

在 Claude Code 中執行：

```
/athena:domain bookmark --fields "url:string,title:string,notes:text"
```

### 產生的檔案清單

執行後，產生器會依照規格先行的順序自動建立所有檔案：

**規格 + 共用 Zod 契約**（最先產生）：

```
docs/epics/e99-bookmark-domain.md            # Epic + 驗收條件
docs/specs/bookmark.md                        # 功能規格
next-app/lib/validations/bookmark.ts          # 共用 Zod schema + z.infer 型別（server + client）
```

> 型別是**推導**而來，不是從 YAML 產生 — 它們來自 Drizzle 的 `$inferSelect`/`$inferInsert` 與 Zod 的 `z.infer<typeof bookmarkSchema>`。

**資料庫 schema（Drizzle）：**

```
next-app/db/schema.ts                          # 新增 `bookmarks` 資料表定義
```

**伺服器層：**

```
next-app/actions/bookmarks.ts                  # Server Actions（"use server"）— create/update/delete
next-app/app/api/bookmarks/route.ts            # Route Handler（選用，用於讀取端點）
```

**測試：**

```
next-app/actions/bookmarks.test.ts             # Vitest 單元測試（actions + validations）
next-app/e2e/bookmarks.spec.ts                 # Playwright e2e（真實 seed 過的 DB）
```

**UI（App Router 路由 + modal）：**

```
next-app/app/(dashboard)/dashboard/bookmarks/page.tsx   # 使用 <DataTable> 的 async Server Component
```

> 此路由同時依本 repo 的 CRUD 慣例接上 modal 形式的 create/edit（shadcn `Dialog`）與 delete（`components/confirm-dialog.tsx`）。
> 樣式使用 Tailwind classes — 沒有 per-page `.css` 檔案。

> **預期輸出**：Claude Code 會逐步執行並報告每個檔案的建立結果。
> 整個過程約 2-3 分鐘。

---

## Step 3：理解 App Router 檔案系統路由

本技術棧沒有中央路由表，也沒有 router 註冊。**App Router 是檔案系統路由 — 你在 `app/` 底下建立的資料夾*即*路由。** Server Actions 是你在使用處直接 import 的一般模組；沒有 registry，也沒有 `main.py`。

### 目錄結構

產生完成後，dashboard 的路由樹會長這樣：

```
next-app/app/(dashboard)/dashboard/
  items/               # 既有路由（CRUD 參考範式）
    page.tsx
  bookmarks/           # 你剛建立的路由
    page.tsx           # async Server Component — 抓取資料並渲染 <DataTable>
```

伺服器層則與 app 其餘部分並列存放：

```
next-app/
  db/schema.ts                   # Drizzle `bookmarks` 資料表
  lib/validations/bookmark.ts    # 共用 Zod schema
  actions/bookmarks.ts           # Server Actions（"use server"）
  app/api/bookmarks/route.ts     # 選用的 Route Handler
```

### 為什麼沒有註冊步驟

1. 建立資料夾 `app/(dashboard)/dashboard/bookmarks/` 並放入 `page.tsx`，`/dashboard/bookmarks` 立刻成為可用路由 — Next.js 會從檔案系統自動發現。
2. Server Actions 由呼叫它們的元件直接 import（`import { createBookmark } from "@/actions/bookmarks"`）。
3. Route Handlers（`app/api/bookmarks/route.ts`）只要存在就會成為 `/api/bookmarks` 端點。

你的 `actions/bookmarks.ts` 會匯出類似這樣的 Server Actions：

```ts
"use server";

import { db } from "@/db";
import { bookmarks } from "@/db/schema";
import { bookmarkSchema } from "@/lib/validations/bookmark";
import { revalidatePath } from "next/cache";

export async function createBookmark(input: unknown) {
  const data = bookmarkSchema.parse(input);
  await db.insert(bookmarks).values(data);
  revalidatePath("/dashboard/bookmarks");
  return { ok: true };
}
```

> **重點**：資料夾*即*路由 — 不需手動接線。刪除 `bookmarks/` 資料夾及其 action／schema 檔案就能乾淨移除功能，
> 沒有中央 registry 需要清理。

---

## Step 4：執行 Migration

產生器已將 `bookmarks` 資料表加入 `db/schema.ts`，但你需要產生並套用 SQL 遷移。所有指令都在 `next-app/` 執行：

```bash
# 比對 db/schema.ts 與 DB 的差異，產生 SQL 遷移
cd next-app
pnpm db:generate
```

檢查產生的遷移檔案（位於 `next-app/drizzle/` 最新的 `.sql` 檔案），確認包含：

- `bookmarks` 資料表建立
- `id` 欄位（UUID 主鍵）
- `user_id` 外鍵（關聯 `users` 表）
- `url`、`title`、`notes` 欄位
- `created_at`、`updated_at` 時間戳記

確認無誤後，套用遷移：

```bash
pnpm db:migrate
```

> **預期輸出**：
>
> ```
> [✓] migrations applied successfully — added bookmarks table
> ```

回到專案根目錄：

```bash
cd ..
```

---

## Step 5：跑測試（RED → GREEN）

TDD 精神：測試先行。產生器已建立測試檔案，現在來確認它們通過。所有指令都在 `next-app/` 執行。

### 單元測試（Vitest）

這些測試涵蓋 Server Actions 與共用的 Zod 驗證：

```bash
cd next-app
pnpm test
```

> **預期輸出**：所有 CRUD 測試（建立、讀取、更新、刪除、列表）應通過。
>
> ```
> ✓ actions/bookmarks.test.ts > createBookmark inserts a row
> ✓ actions/bookmarks.test.ts > getBookmark returns a row
> ✓ actions/bookmarks.test.ts > listBookmarks returns rows
> ✓ actions/bookmarks.test.ts > updateBookmark updates a row
> ✓ actions/bookmarks.test.ts > deleteBookmark removes a row
> ```

### 端對端測試（Playwright）

e2e 測試會以真實 UI 對真實 seed 過的資料庫操作，所以先做 seed：

```bash
pnpm db:seed
pnpm test:e2e
```

> **預期輸出**：bookmarks 路由正常渲染、create/edit modal 可運作、delete 經由 dialog 確認 — 全部綠燈。

回到專案根目錄：

```bash
cd ..
```

> **如果測試失敗**：別慌，這正是 TDD 的 RED 階段。
> 檢查錯誤訊息、修正程式碼、再次執行測試。
> 也可以使用 `/athena:qa --test-only` 讓 QA Agent 幫你分析。

---

## Step 6：客製化（選讀）

產生器提供了完整的 CRUD 骨架，你可以根據需求進一步客製化。

### 新增欄位

例如，想加入 `is_favorite`（布林值）欄位：

1. **Zod Schema** — 在 `next-app/lib/validations/bookmark.ts` 的共用 schema 新增欄位（這是契約 — 先改它）
2. **Drizzle 欄位** — 在 `next-app/db/schema.ts` 的 `bookmarks` 資料表新增 `boolean("is_favorite")` 欄位
3. **Migration** — `cd next-app && pnpm db:generate && pnpm db:migrate`
4. **Server Action + 表單** — 更新 `actions/bookmarks.ts` 的 Server Action 與 create/edit 表單，納入新欄位
5. **測試** — 更新測試案例，確認新欄位正確運作

> 記住規格先行順序：**Zod schema（契約）→ Drizzle DB schema → Server Action → UI**。
> Zod schema 是共用契約 — 保持它同步，就能讓 server 與表單保持一致。

### 新增側邊欄連結

App Router 沒有中央路由表，所以唯一需要手動接線的是導航連結。在 dashboard 側邊欄導航（dashboard layout 所用的 shadcn `sidebar-01` 導航元件）中加入 bookmarks 項目，讓使用者能進入 `/dashboard/bookmarks`。

### 調整頁面樣式

樣式直接以 Tailwind utility classes 寫在 `page.tsx` 與表單元件中 — 沒有 per-page `.css` 檔案。
使用主題的 `dark:` 變體與 design tokens；切勿加入 inline `style=` 色彩覆寫（詳見 [TECHSTACK.md](../../../TECHSTACK.md)）。

---

## Step 7：用 `/athena:ship` 提交

功能開發完成、測試通過後，使用 Athena 指令提交並建立 PR：

### 方式 A：使用 `/athena:ship`

在 Claude Code 中執行：

```
/athena:ship
```

`/athena:ship` 會自動執行：

1. **Review** — 程式碼審查
2. **Fix** — 自動修正發現的問題
3. **Commit** — 建立 conventional commit
4. **PR** — 建立 Pull Request

### 方式 B：手動 git 流程

如果你偏好手動操作：

```bash
# 確認變更
git status
git diff

# Stage 所有變更
git add -A

# 建立 conventional commit
git commit -m "feat(E99): Bookmark domain CRUD

- Shared Zod schema + Drizzle bookmarks table
- Server Actions + optional Route Handler
- App Router page with <DataTable> + modal CRUD
- Vitest unit tests + Playwright e2e"

# 推送並建立 PR
git push -u origin feat/E99-bookmark-domain
```

### 更新 EPIC_INDEX

提交後，將 Epic 狀態更新為完成：

```markdown
| E99 | Bookmark Domain | S | ✅ | ✅ | ✅ | ✅ | ⬜ | 書籤管理 CRUD |
```

`merge` 欄位在 PR 合併後才標記為 ✅。

---

## 完成回顧

恭喜！你已經完整走過一次 Epic Pipeline。讓我們回顧學到的內容：

### 你學到了什麼

| 概念 | 實踐 |
|------|------|
| **規格先行** | 共用 Zod schema → Drizzle DB schema → Server Actions/Route Handlers → UI |
| **App Router 路由** | 資料夾*即*路由 — 檔案系統路由，零手動註冊 |
| **Domain 產生器** | `/athena:domain` 一鍵產生整套技術棧檔案 |
| **Epic Pipeline** | spec → implement → qa → commit → merge |
| **TDD 精神** | 測試與實作同步產生，確保品質 |
| **Athena 指令** | 每個開發階段都有對應的自動化指令 |

### 接下來可以做什麼

- **建立更多 Domain** — 試試 `/athena:domain todo` 或參考 `docs/templates/domain/examples/` 的範例設定（blog、todo、crm）
- **深入架構** — 閱讀 [TECHSTACK.md](../../../TECHSTACK.md) 了解完整技術決策
- **查看路線圖** — 閱讀 [EPIC_INDEX.md](../../epics/EPIC_INDEX.md) 了解所有 Phase 的規劃
- **使用 `/athena:loop`** — 讓 Loop 指令自動推進 Epic 的下一步
- **使用 `/athena:plan`** — 讓 @strategist Agent 審計現況並提案新 Epic

---

## 下一步

- **[AI Agent 團隊指南](ai-agent-team-guide.md)** — 學習序列與並行執行模式，同時推進多個 Epic
- **[建立領域專家 Agent](custom-agents.md)** — 為你的業務領域建立自訂 AI Agent
- **[學習路徑](learning-path.md)** — 查看所有指南的推薦閱讀順序

---

## 延伸閱讀

| 文件 | 說明 |
|------|------|
| [CLAUDE.md](../../../CLAUDE.md) | 專案規則、Agent 團隊、Memory 系統 |
| [TECHSTACK.md](../../../TECHSTACK.md) | 完整技術架構（可上傳至 Claude 恢復上下文） |
| [CRUD modal + DataTable 慣例](../../../CLAUDE.md) | 本 repo 的 CRUD 範式：modal（Dialog）+ 可重用 `<DataTable>`，參考 `app/(dashboard)/dashboard/items/` |
| [E23 — Starter Domain Generator](../../epics/e23-starter-domain-generator.md) | `/athena:domain` 產生器的完整規格 |
| [Domain 模板目錄](../../templates/domain/) | 所有 domain 產生器的模板檔案 |
| [範例 Domain 設定](../../templates/domain/examples/) | blog.yaml、todo.yaml、crm.yaml 範例 |
| [Athena 指令目錄](../../../.claude/commands/athena/) | 所有 17 個 slash commands 的定義 |
