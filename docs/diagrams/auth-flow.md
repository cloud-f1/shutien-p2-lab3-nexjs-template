# 認證流程圖

> 本專案的認證系統基於 Auth.js v5（next-auth）+ **JWT session**。
> 以下三張時序圖涵蓋登入、受保護路由的存取，以及 OAuth 登入流程。

---

## 流程 A：登入（Credentials + JWT session）

```mermaid
sequenceDiagram
    actor 使用者
    participant Client as Client Component<br/>（/login 表單）
    participant NextAuth as Auth.js Handler<br/>app/api/auth/[...nextauth]
    participant DB as PostgreSQL（Drizzle）

    使用者->>Client: 輸入 email / password
    Client->>NextAuth: signIn("credentials", { email, password })
    NextAuth->>DB: getUserByEmail（查 users）
    NextAuth->>NextAuth: bcryptjs 比對 password_hash（lib/password.ts）
    alt 驗證失敗
        NextAuth-->>Client: null → 顯示錯誤
    else 驗證成功
        NextAuth->>NextAuth: 簽發 JWT（用 AUTH_SECRET）<br/>把 role 快照進 token
        NextAuth-->>Client: Set-Cookie（httpOnly session cookie）
        Client->>Client: router 導向 /dashboard
    end
```

## 流程 B：存取受保護路由 + RBAC

```mermaid
sequenceDiagram
    actor 使用者
    participant Edge as Edge 中介層（proxy.ts）
    participant RSC as Server Component<br/>app/(dashboard)/...
    participant Perm as RBAC（lib/permissions.ts）
    participant DB as PostgreSQL（Drizzle）

    使用者->>Edge: GET /dashboard/...（帶 session cookie）
    Edge->>Edge: auth()（輕量 config，無 DrizzleAdapter）
    alt 無有效 session
        Edge-->>使用者: redirect /login
    else 有 session
        Edge->>RSC: 放行
        RSC->>RSC: auth() → 取得 session（含 JWT 內的 role 快照）
        RSC->>Perm: requireAuth() / requireAdmin()
        Perm->>DB: getUserById → 重讀「即時 role」
        Note over Perm,DB: 不信任 JWT 內的 role 快照——<br/>降權後立即生效
        alt role 不符
            Perm-->>使用者: redirect /dashboard 或 /login
        else role 通過
            RSC->>DB: 以該使用者身分查詢資料
            RSC-->>使用者: 渲染頁面
        end
    end
```

## 流程 C：OAuth 登入（Google）

```mermaid
sequenceDiagram
    actor 使用者
    participant Client as Client Component
    participant NextAuth as Auth.js Handler<br/>app/api/auth/[...nextauth]
    participant Provider as Google OAuth
    participant DB as PostgreSQL（Drizzle）

    使用者->>Client: 點擊「以 Google 登入」
    Client->>NextAuth: signIn("google")
    NextAuth->>Provider: redirect 至 OAuth authorize URL
    Provider->>使用者: 授權確認頁面
    使用者->>Provider: 同意授權
    Provider->>NextAuth: callback 帶 authorization code
    NextAuth->>Provider: 用 code 交換 token + 取 user info
    NextAuth->>DB: DrizzleAdapter upsert users + accounts（同 email 自動關聯）
    NextAuth->>NextAuth: 簽發 JWT session
    NextAuth-->>Client: Set-Cookie（httpOnly）→ 導向 /dashboard
```

## 安全設計說明

### 為什麼採 JWT session 而非 DB session？

- Auth.js v5 的 **Credentials provider 需要 JWT session**——DrizzleAdapter 預設的
  DB session 在 Credentials 流程下不適用。
- `sessions` 等 adapter 資料表仍保留，供 OAuth 帳號關聯使用。
- session 存於 **httpOnly cookie**，JavaScript 讀不到，從結構上防 XSS 竊取——
  不需要把 token 存進任何前端 store。

### RBAC 為何要從 DB 重讀 role？

- role 在登入當下被「快照」進 JWT；若直接信任 JWT，降權要等使用者重新登入才生效。
- `lib/permissions.ts` 的 `requireAuth` / `requireAdmin` 每次都用 `getUserById`
  重讀**即時 role**——`setUserRole` 後下一個 request 立即生效。
- `lib/is-admin.ts` 提供 client-safe 的 `isAdmin` / `canEdit` 純布林，只用於
  條件式顯示 UI，**不可**當作安全邊界（Server Action 會再檢查一次）。

### AUTH_SECRET 的意義

- JWT session 用 `AUTH_SECRET` 簽章；缺少或輪替 `AUTH_SECRET` 會讓所有既有 session
  失效並導致登入失敗。設定一次後保持穩定。
