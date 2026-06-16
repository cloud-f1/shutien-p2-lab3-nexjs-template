# 不使用 Claude Code 的開發工作流程

> 本指南介紹如何僅使用 `pnpm` 和標準 CLI 工具進行完整的開發工作流程。Claude Code 是**加速器**，不是必需品。

---

## 快速參考

所有 `pnpm` 指令都在 `next-app/` 目錄下執行。

| 任務 | 指令 |
|------|------|
| 啟動完整本機環境 | `docker compose up --build -d` |
| 啟動開發伺服器 | `pnpm dev` |
| 建立新 Domain | `make new-domain NAME=notes` |
| 執行單元測試 | `pnpm test` |
| 執行 e2e 測試 | `pnpm test:e2e` |
| 型別檢查 | `pnpm typecheck` |
| 程式碼風格檢查 | `pnpm lint` |
| 產生資料庫 migration | `pnpm db:generate` |
| 套用 migration | `pnpm db:migrate` |
| 建立示範帳號 | `pnpm db:seed` |

---

## 1. 初始設定

```bash
# 複製專案
git clone <your-repo-url>
cd ai-coding-template

# 啟動完整本機環境（Postgres + Next.js app + mailpit）
docker compose up --build -d
```

`docker compose up --build -d` 會啟動：
- PostgreSQL
- Next.js app（http://localhost:3000）
- Mailpit 郵件攔截（http://localhost:8025）

接著建立示範帳號（在 `next-app/` 目錄下執行）：

```bash
cd next-app
pnpm db:migrate   # 套用 Drizzle migration
pnpm db:seed      # 建立下方的示範帳號
```

示範登入帳號：`admin@example.com / Admin123!`、`editor@example.com / Editor123!`、`viewer@example.com / Viewer123!`。

> 想直接執行 app？在 `next-app/` 下：`pnpm install` 後 `pnpm dev`（把 `DATABASE_URL` 指向任一 Postgres 即可——用 Docker 那組也行）。

## 2. 建立新 Domain

「Domain」是一個獨立的功能模組，包含自己的資料表、驗證 schema 和 Server Actions。

```bash
# 建立 "notes" domain，預設欄位為 title
make new-domain NAME=notes
```

這會產生：
- `next-app/lib/schema/notes.ts` — Drizzle 資料表（由 `lib/schema/index.ts` barrel 匯出）
- `next-app/lib/validations/note.ts` — 共用的 Zod 請求/回應 schema（契約）
- `next-app/actions/notes.ts` — Server Actions（`"use server"`）負責新增／更新／刪除，必要時搭配 Route Handler `next-app/app/api/notes/route.ts`
- 新資料表的 Drizzle SQL migration（位於 `next-app/drizzle/migrations/`）

**不需要任何集中註冊**。App Router 採用檔案系統路由——`app/` 底下的資料夾「就是」路由，Server Actions 在使用處直接 import。沒有 `main.py`，也沒有路由設定。

## 3. 自訂 Domain

### 新增欄位

編輯 `next-app/lib/schema/notes.ts` 中的 Drizzle 資料表：

```ts
import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { usersTable } from "./auth"

export const notesTable = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    // 新增你的欄位：
    priority: integer("priority").notNull().default(0),
    isPinned: boolean("is_pinned").notNull().default(false),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("notes_user_id_idx").on(t.userId)],
)

// 型別由 Drizzle 推導 — 沒有 codegen 步驟。
export type Note = typeof notesTable.$inferSelect
export type NewNote = typeof notesTable.$inferInsert
```

然後更新 `lib/validations/note.ts` 中的 Zod schema，並產生與套用 migration（在 `next-app/` 下執行）：

```bash
cd next-app
pnpm db:generate   # 將 SQL migration 寫入 drizzle/migrations/
pnpm db:migrate    # 套用到資料庫
```

### 更新共用的 Zod 驗證（契約）

本專案沒有 OpenAPI 規格，也沒有型別產生（type-gen）。唯一的真實來源是 `next-app/lib/validations/note.ts` 中的共用 Zod schema——它同時被 Server Actions 和前端表單使用。型別來自 `z.infer<typeof ...>` 以及 Drizzle 的 `$inferSelect` / `$inferInsert`。

請**先**編輯 Zod schema，再更新 Server Action 和表單以保持一致：

```ts
// next-app/lib/validations/note.ts
import { z } from "zod"

export const createNoteSchema = z.object({
  title: z.string().min(1, "請輸入標題").max(200),
  description: z.string().optional(),
  priority: z.number().int().default(0),
})

export type CreateNoteInput = z.infer<typeof createNoteSchema>
```

## 4. 測試

所有指令都在 `next-app/` 目錄下執行。

```bash
# 執行所有單元測試（Vitest）
pnpm test

# 執行單元測試（含覆蓋率）
pnpm test:coverage

# 執行特定測試檔案
pnpm test actions/notes.test.ts

# 執行 e2e 測試（Playwright — 先 seed 資料庫）
pnpm db:seed
pnpm test:e2e

# 程式碼風格檢查 + 型別檢查
pnpm lint
pnpm typecheck
```

### 撰寫單元測試（Vitest）

建立 `next-app/actions/notes.test.ts`（或 `lib/validations/note.test.ts`）：

```ts
import { describe, it, expect } from "vitest"

import { createNoteSchema } from "@/lib/validations/note"

describe("createNoteSchema", () => {
  it("接受有效的 note", () => {
    const result = createNoteSchema.safeParse({ title: "My Note", description: "Hello world" })
    expect(result.success).toBe(true)
  })

  it("拒絕空白標題", () => {
    const result = createNoteSchema.safeParse({ title: "" })
    expect(result.success).toBe(false)
  })
})
```

### 撰寫 e2e 測試（Playwright）

建立 `next-app/e2e/notes.spec.ts`，並以 `pnpm test:e2e` 執行（先跑 `pnpm db:seed`）。用其中一組示範帳號登入——例如 `editor@example.com / Editor123!`——以測試寫入流程。

## 5. 開發工作流程

### 日常開發

```bash
# 啟動開發伺服器（在 next-app/ 下）
cd next-app && pnpm dev

# 在另一個終端機中，以 watch 模式執行測試
cd next-app && pnpm test:watch
```

### 新增 Endpoint

1. 更新 `lib/validations/note.ts` 中的共用 Zod schema（契約）
2. 在 `actions/notes.ts` 中新增或擴充 Server Action（或修改 `app/api/notes/route.ts` 的 Route Handler）
3. 若資料結構有變，更新 `lib/schema/notes.ts` 中的 Drizzle 資料表
4. 撰寫測試
5. 執行 `pnpm test`（與 `pnpm typecheck`）驗證

### 資料庫 Migration

所有指令都在 `next-app/` 目錄下執行。

```bash
# 編輯 Drizzle 資料表後產生 migration
pnpm db:generate   # 將 SQL 寫入 drizzle/migrations/

# 套用 migration
pnpm db:migrate
```

> Drizzle 沒有 `alembic current` 的對應指令——要查看已產生的內容，請看 `next-app/drizzle/migrations/`（SQL 檔案與 `meta/_journal.json`）。

## 6. 部署

```bash
# 先做型別檢查 + 風格檢查 + 測試（在 next-app/ 下）
cd next-app
pnpm typecheck && pnpm lint && pnpm test

# 產生 production build
pnpm build
```

專案已設定為 Zeabur 部署——`next-app/` 為單一服務，具備自己的 `zbpack.json` 設定。

## 7. Claude Code 的加值功能

Claude Code 並非必要，但提供以下加速功能：

| 功能 | 不使用 Claude Code | 使用 Claude Code |
|------|-------------------|-----------------|
| 建立 Domain | `make new-domain NAME=x` | `/athena:domain notes --fields "title:string,body:text"` |
| 執行測試 | `pnpm test` | `/athena:qa`（審查 + 測試 + 覆蓋率門檻） |
| 部署 | 手動步驟 | `/athena:deploy`（7 道關卡協定） |
| 程式碼審查 | 手動 | `/athena:qa --review-only` |
| 策略規劃 | 手動 | `/athena:plan` |
| 完整開發循環 | 手動步驟 | `/athena:loop`（推進 epic pipeline） |

AI 代理自動化工作流程，但永遠不會取代理解。先不使用 Claude Code 開始，準備好加速時再加入。

---

## 疑難排解

```bash
# 重設資料庫（移除 Postgres volume，再重新套用 + reseed）
docker compose down -v
docker compose up -d
cd next-app
pnpm db:migrate   # 重新套用 Drizzle migration
pnpm db:seed      # 重新建立示範帳號

# 遇到型別錯誤？在 next-app/ 下執行型別檢查
pnpm typecheck
```

---

## 下一步

- **[第一個 Epic 實戰](first-epic-walkthrough.md)** — 一步步建立完整 Domain（無論是否使用 Claude Code 都適用）
- **[學習路徑](learning-path.md)** — 查看所有指南的推薦閱讀順序
