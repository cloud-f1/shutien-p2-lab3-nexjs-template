# 認證流程圖

> 本專案的認證系統基於 JWT + Refresh Token 輪替機制。
> 以下三張時序圖涵蓋登入、token 刷新與 OAuth 登入流程。

---

## 流程 A：登入 + Token 發行

```mermaid
sequenceDiagram
    actor 使用者
    participant Client as 客戶端應用
    participant Server as FastAPI Server
    participant DB as PostgreSQL

    使用者->>Client: 輸入 email / password
    Client->>Server: POST /auth/jwt/login<br/>（form-data, username = email）
    Server->>DB: 查詢使用者 + 驗證密碼
    alt 驗證失敗
        Server-->>Client: 400 LOGIN_BAD_CREDENTIALS
    else 驗證成功
        Server->>Server: 發行 access token（15 min）
        Server->>Server: 發行 refresh token（30 days）
        Server->>DB: 建立 Session（token_hash + device_info）
        Server-->>Client: { access_token, refresh_token }
        Client->>Client: access token → tokenCache.ts（in-memory）
        Client->>Client: refresh token → httpOnly cookie
    end
```

## 流程 B：Token 刷新（Refresh Rotation）

```mermaid
sequenceDiagram
    actor Client as 客戶端應用
    participant Server as FastAPI Server
    participant DB as PostgreSQL

    Client->>Client: 偵測 access token 即將過期
    Client->>Server: POST /auth/refresh<br/>（帶 refresh_token）
    Server->>Server: 驗證 refresh token 簽章
    Server->>DB: 查詢 Session（by token_hash）

    alt Session 不存在或已撤銷
        Server->>DB: 撤銷該使用者所有 Session（重播偵測）
        Server-->>Client: 401 INVALID_REFRESH_TOKEN
    else Session 有效
        Server->>Server: 發行新 access token
        Server->>Server: 發行新 refresh token
        Server->>DB: 更新 Session（新 token_hash + expires_at）
        Note over DB: 舊 refresh token 自動作廢
        Server-->>Client: { access_token, refresh_token }
        Client->>Client: 更新 tokenCache.ts + cookie
    end
```

## 流程 C：OAuth 登入（Google / GitHub）

```mermaid
sequenceDiagram
    actor 使用者
    participant Client as 客戶端應用
    participant Provider as OAuth Provider<br/>（Google / GitHub）
    participant Server as FastAPI Server
    participant DB as PostgreSQL

    使用者->>Client: 點擊 OAuth 登入按鈕
    Client->>Provider: redirect 至 OAuth authorize URL
    Provider->>使用者: 授權確認頁面
    使用者->>Provider: 同意授權
    Provider->>Client: callback 帶 authorization code
    Client->>Server: POST /auth/social/{provider}/callback
    Server->>Provider: 用 code 交換 access token
    Provider-->>Server: 回傳 user info
    Server->>DB: 查詢/建立使用者（同 email 自動關聯）
    Server->>Server: 發行 access + refresh tokens
    Server->>DB: 建立 Session
    Server-->>Client: { access_token, refresh_token }
```

## 安全設計說明

### 為什麼 access token 不存 localStorage？

- **XSS 防護** — localStorage 可被任何注入的 JavaScript 讀取
- `tokenCache.ts` 使用 in-memory 變數，頁面重整後 token 消失
- 配合 refresh token 的 httpOnly cookie，重新取得 access token

### Refresh Token 輪替的意義

- **單次使用** — 每次 refresh 都會發行新的 refresh token，舊的立即作廢
- **洩漏偵測** — 如果已撤銷的 token 被重複使用，server 會撤銷該使用者的所有 session
- **伺服端追蹤** — Session 表記錄 `token_hash`、`device_info`、`ip_address`

### OAuth 帳號合併

- 如果 OAuth provider 回傳的 email 與現有帳號相同，會自動關聯（不建立新帳號）
- 使用 `fastapi-users` 的 `SQLAlchemyBaseOAuthAccountTableUUID` 管理 OAuth 關係
