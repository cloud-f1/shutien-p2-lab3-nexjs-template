# 系統架構圖

> 四層架構 + 外部服務的全貌圖。適合新使用者快速理解系統組成。

---

```mermaid
graph TD
    subgraph 使用者層
        Browser["瀏覽器"]
        E2E["Playwright E2E 測試"]
    end

    subgraph 客戶端層["客戶端層（Client）"]
        React["React 18 + Vite + TypeScript"]
        Zustand["Zustand 狀態管理"]
        RQ["快取層（React Query 4 tiers）"]
        Axios["apiClient（Axios）"]
        TokenCache["tokenCache.ts（in-memory）"]
    end

    subgraph 伺服器層["伺服器層（Server）"]
        FastAPI["FastAPI + Uvicorn"]
        Auth["認證模組（JWT + OAuth）"]
        CoreAPI["核心端點（auth / users / health）"]
        DomainAPI["Domain 端點（Places, Portfolios …）"]
        Registry["Domain Registry（discover_domains）"]
        Middleware["中介層（CORS / Security / Logging / Correlation ID）"]
        Alembic["Alembic 遷移"]
    end

    subgraph 資料層["資料層（Data）"]
        PG["PostgreSQL"]
        SQLAlchemy["SQLAlchemy 2.x async"]
    end

    subgraph 外部服務
        Zeabur["Zeabur 部署平台"]
        OAuth["Google / GitHub OAuth"]
        Email["Resend / Mailgun 郵件"]
        Sentry["Sentry 錯誤追蹤"]
    end

    Browser -->|HTTPS| React
    E2E -->|HTTPS| React
    React --> Zustand
    React --> RQ
    RQ --> Axios
    Axios -->|"REST API + JWT Bearer"| FastAPI
    TokenCache -.->|存取 token| Axios

    FastAPI --> Middleware
    Middleware --> Auth
    Middleware --> CoreAPI
    Middleware --> DomainAPI
    Registry -->|動態註冊| DomainAPI
    CoreAPI --> SQLAlchemy
    DomainAPI --> SQLAlchemy
    Alembic --> PG
    SQLAlchemy -->|async SQL| PG

    Auth -->|OAuth redirect| OAuth
    Auth -->|寄送驗證信| Email
    FastAPI -->|錯誤回報| Sentry
    Zeabur -.->|部署| FastAPI
    Zeabur -.->|部署| React
```

## 各層職責

| 層級 | 說明 |
|------|------|
| **使用者層** | 瀏覽器或 E2E 測試透過 HTTPS 存取客戶端 |
| **客戶端層** | React SPA 負責 UI 渲染、狀態管理、快取策略與 token 儲存 |
| **伺服器層** | FastAPI 處理 REST API、認證、domain 路由註冊與中介層 |
| **資料層** | PostgreSQL 為核心資料庫，透過 SQLAlchemy async ORM 存取 |
| **外部服務** | Zeabur 部署、Google/GitHub OAuth、郵件服務、Sentry 監控 |

## 關鍵連線說明

- **Client to Server** — REST API + JWT Bearer token 認證
- **Server to DB** — async SQLAlchemy，非同步連線池
- **Token 儲存** — Access token 僅存於 `tokenCache.ts` in-memory（防 XSS）
- **Domain 註冊** — `discover_domains()` 啟動時自動掃描 `server/app/domains/` 子目錄
