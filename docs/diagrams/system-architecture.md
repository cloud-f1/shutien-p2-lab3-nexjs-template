# 系統架構圖

> 單一 Next.js App + 資料層 + 外部服務的全貌圖。適合新使用者快速理解系統組成。
> 沒有獨立的 server/client 拆分——整個應用就是 `next-app/` 這一個 Next.js 服務。

---

```mermaid
graph TD
    subgraph 使用者層
        Browser["瀏覽器"]
        E2E["Playwright E2E 測試"]
    end

    subgraph 應用層["Next.js App（next-app/）"]
        Edge["Edge 中介層（proxy.ts）<br/>路由守衛 / 重導"]
        RSC["Server Components<br/>app/（預設，直接讀資料）"]
        Client["Client Components<br/>'use client' + shadcn/ui + Tailwind v4"]
        Actions["Server Actions（actions/*.ts）<br/>'use server' 變更操作"]
        Routes["Route Handlers（app/api/**）<br/>auth / health / billing webhooks"]
        Auth["Auth.js v5（lib/auth.ts）<br/>Credentials + Google · JWT session"]
        RBAC["RBAC（lib/permissions.ts）<br/>從 DB 重讀 role"]
        Drizzle["Drizzle ORM（postgres-js）<br/>lib/schema/*"]
    end

    subgraph 資料層["資料層（Data）"]
        PG["PostgreSQL"]
    end

    subgraph 外部服務
        Zeabur["Zeabur / GCP Cloud Run 部署"]
        OAuth["Google OAuth"]
        Email["SMTP 郵件（驗證 / 邀請）"]
        Billing["Stripe / ECPay 金流"]
    end

    Browser -->|HTTPS| Edge
    E2E -->|HTTPS| Edge
    Edge --> RSC
    RSC --> Client
    Client -->|呼叫| Actions
    Browser -->|HTTP| Routes

    RSC --> Drizzle
    Actions --> RBAC
    Actions --> Drizzle
    Routes --> Auth
    Auth --> Drizzle
    RBAC --> Drizzle
    Drizzle -->|SQL| PG

    Auth -->|OAuth redirect| OAuth
    Routes -->|簽章驗證 webhook| Billing
    Actions -->|寄送驗證 / 邀請信| Email
    Zeabur -.->|部署單一服務| RSC
```

## 各層職責

| 層級 | 說明 |
|------|------|
| **使用者層** | 瀏覽器或 E2E 測試透過 HTTPS 存取 Next.js App |
| **應用層** | 單一 Next.js App：Server Components 預設負責讀資料與渲染；Client Components 只在需要瀏覽器能力時用 `'use client'`；Server Actions 處理變更；Route Handlers 提供少數 HTTP 端點；Auth.js + RBAC 處理認證授權 |
| **資料層** | PostgreSQL 為核心資料庫，透過 Drizzle ORM（postgres-js）存取 |
| **外部服務** | Zeabur / GCP Cloud Run 部署、Google OAuth、SMTP 郵件、Stripe/ECPay 金流 |

## 關鍵連線說明

- **Browser to App** — 先經 Edge 中介層 `proxy.ts` 做路由守衛，再進入 App Router
- **讀資料** — Server Components 直接透過 Drizzle 查 PostgreSQL，無 HTTP 來回
- **變更操作** — Client 直接呼叫 Server Action（`'use server'`），驗證 Zod 後寫 Drizzle，再 `revalidatePath`
- **認證** — Auth.js v5（Credentials + Google）採 **JWT session**；RBAC（`lib/permissions.ts`）從 DB 重讀 role
- **HTTP 端點** — 只有 Auth.js callback、health、billing webhook 需要 Route Handler
