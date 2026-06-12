<div id="1-architecture-overview" class="section-tag">AI-Coding-Template — Developer Documentation</div>

> **Language Note**: This document is currently in Traditional Chinese. An English version is planned.
> For English developer guides, see [`docs/guides/en/`](https://github.com/cloud-f1/ai-coding-template/tree/main/docs/guides/en).
>
> **語言備註**：本文件目前為繁體中文。英文版開發者指南請參閱 [`docs/guides/en/`](https://github.com/cloud-f1/ai-coding-template/tree/main/docs/guides/en)。

# Full-Stack Investment <br><span style="color:var(--accent2)">Tracker Architecture</span>

<p class="hero-sub">
React 18 + FastAPI + PostgreSQL，採用 Spec-Driven Development (SDD) + Test-Driven Development (TDD)。所有類型從 OpenAPI 合約自動生成，確保前後端零漂移。
</p>

<div class="hero-cards">
  <div class="hero-card">
    <span class="hc-icon">⚡</span>
    <div class="hc-title">OpenAPI First</div>
    <div class="hc-desc">所有 TypeScript 類型從 openapi.yaml 自動生成，永遠不會有 schema 不一致的問題</div>
  </div>
  <div class="hero-card">
    <span class="hc-icon">🧠</span>
    <div class="hc-title">Self-Learning AI</div>
    <div class="hc-desc">9 個 AI agents 自動寫 spec、review、測試、部署，支援並行管線，經驗傳承給下一個專案</div>
  </div>
  <div class="hero-card">
    <span class="hc-icon">🔒</span>
    <div class="hc-title">Security First</div>
    <div class="hc-desc">fastapi-users stateless JWT、httpOnly cookie、pwdlib argon2、rate limiting</div>
  </div>
</div>

### 系統架構

<div class="arch-diagram">
  <div style="display:grid;grid-template-columns:1fr 60px 1fr 60px 1fr;gap:0;align-items:center;">
    <div class="arch-box client">
      <div class="ab-title">Client</div>
      <div class="ab-sub">React 18 + Vite<br>TypeScript 5.x<br>Zustand + React Query</div>
    </div>
    <div style="text-align:center;color:var(--text3);font-family:'IBM Plex Mono',monospace;font-size:11px;">
      HTTPS<br>Bearer JWT<br>──────→
    </div>
    <div class="arch-box api">
      <div class="ab-title">FastAPI Server</div>
      <div class="ab-sub">Python 3.12<br>fastapi-users v15<br>Pydantic v2</div>
    </div>
    <div style="text-align:center;color:var(--text3);font-family:'IBM Plex Mono',monospace;font-size:11px;">
      SQLAlchemy<br>async<br>──────→
    </div>
    <div class="arch-box db">
      <div class="ab-title">PostgreSQL</div>
      <div class="ab-sub">+ PostGIS (Track 2)<br>Alembic migrations<br>UUID PKs</div>
    </div>
  </div>
</div>

<div class="callout info">
  <span class="callout-icon">📌</span>
  <p><strong>設計原則：</strong>Backend 是 auth state 的唯一權威。React 透過 openapi.yaml 定義的 typed REST contract 溝通。任何前端框架（React Native、Next.js）都可以直接對接，無需修改後端。</p>
</div>

---

## 2. Project Structure

```
ai-coding-template/
│
├── CLAUDE.md                    ← Claude Code session identity (<200 lines)
├── TECHSTACK.md                 ← Upload this file to restore any Claude session
│
├── docs/
│   ├── openapi.yaml             ← API contract — single source of truth for ALL types
│   ├── specs/                   ← Feature implementation plans (@spec-writer outputs)
│   └── context/                 ← Agent memory write-backs (session resumption)
│       ├── session-summary.md
│       ├── decisions.md
│       └── [agent]-log.md × 7
│
├── server/                      ← FastAPI (Python 3.12)
│   ├── alembic/
│   │   ├── env.py               ← Async Alembic runner
│   │   └── versions/            ← Migration files (001_*, 002_*, ...)
│   ├── app/
│   │   ├── api/v1/endpoints/
│   │   │   ├── auth.py          ← fastapi-users auth routers (register, login, verify, reset)
│   │   │   ├── social.py        ← OAuth2 redirect + callback (Google, GitHub)
│   │   │   ├── users.py         ← GET|PATCH /users/me
│   │   │   └── health.py        ← liveness/readiness probe
│   │   ├── core/
│   │   │   ├── auth.py          ← FastAPIUsers instance, auth_backend, current_active_user
│   │   │   ├── config.py        ← pydantic-settings (.env loader)
│   │   │   └── limiter.py       ← slowapi rate limiter
│   │   ├── db/
│   │   │   └── session.py       ← AsyncSession + get_db + get_user_db
│   │   ├── models/
│   │   │   ├── base.py          ← DeclarativeBase
│   │   │   └── user.py          ← User (SQLAlchemyBaseUserTableUUID) + OAuthAccount
│   │   ├── schemas/
│   │   │   ├── auth.py          ← Health, error response schemas
│   │   │   └── user.py          ← UserRead, UserCreate, UserUpdate (extend fastapi-users)
│   │   ├── services/
│   │   │   ├── mail_service.py  ← SMTP email sender
│   │   │   └── user_manager.py  ← UserManager with email hooks
│   │   └── main.py              ← FastAPI entry + middleware + routers
│   ├── tests/
│   │   ├── conftest.py          ← Shared fixtures (db, client, override deps)
│   │   ├── unit/
│   │   └── integration/
│   ├── pyproject.toml           ← pytest + ruff + mypy config
│   ├── requirements.txt
│   ├── Dockerfile
│   └── zbpack.json              ← Zeabur build config
│
├── client/                      ← React 18 + TypeScript + Vite
│   └── src/
│       ├── api/
│       │   ├── auth.ts          ← Typed auth API functions
│       │   └── client.ts        ← Axios instance with interceptors
│       ├── cacheConfig.ts       ← 4-tier staleTime definitions
│       ├── schemas/
│       │   └── auth.ts          ← Zod validation schemas
│       ├── store/
│       │   └── authStore.ts     ← Zustand auth state
│       ├── pages/               ← LoginPage, RegisterPage, LandingPage
│       └── tests/
│           └── setup.ts         ← Vitest + MSW setup
│
├── dev-docs/                    ← Developer Documentation site (React + Vite)
│
└── .claude/
    ├── agents/                  ← 9 AI subagents
    ├── commands/athena/         ← Slash commands (/athena:spec /athena:qa ...)
    └── settings.json            ← Hooks: SessionStart, PreToolUse, SubagentStop
```

---

## 3. Quick Start

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Python | 3.12+ | `pyenv install 3.12` |
| Node.js | 22+ | `nvm install 22` |
| pnpm | 9+ | `npm i -g pnpm` |
| Docker | 24+ | [docs.docker.com](https://docs.docker.com/get-docker/) |
| Claude Code | latest | `npm i -g @anthropic-ai/claude-code` |

### Docker Quick Start (Recommended)

```bash
# 1. Copy local env template
cp .env.local .env

# 2. Start all services (db, mailpit, server, client, dev-docs)
docker compose up --build
```

| Service | URL |
|---|---|
| Client | http://localhost:3000 |
| Server | http://localhost:8080 |
| Dev Docs | http://localhost:4000 |
| Mailpit | http://localhost:8025 |
| PostgreSQL | localhost:5432 |

> Dev-only services (db, mailpit) use `profiles: [local]`. Setting `COMPOSE_PROFILES=local` in `.env` activates them. In production, that variable is absent so only server and client start.

### Server (Manual)

```bash
cd server

# 建立虛擬環境
python -m venv .venv && source .venv/bin/activate

# 安裝依賴（使用 uv）
uv pip install -r requirements.txt

# 環境變數
cp .env.example .env
# 填入：DATABASE_URL, SECRET_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

# 執行 migration
alembic upgrade head

# 啟動 dev server (port 8080)
uvicorn app.main:app --reload
```

### Client (Manual)

```bash
cd client

pnpm install

# 環境變數
cp .env.example .env.local
# 填入：VITE_API_URL=http://localhost:8080

# ⚠️ 先生成 TypeScript types（每次 openapi.yaml 更新後都要做）
npx openapi-typescript ../docs/openapi.yaml --output src/api/types.ts

# 啟動 dev server (port 5173)
pnpm run dev
```

<div class="callout warn">
  <span class="callout-icon">⚠️</span>
  <p><strong>重要順序：</strong>永遠先更新 <code>docs/openapi.yaml</code>，再跑 <code>openapi-typescript</code>，再寫 client 或 server 代碼。</p>
</div>

---

## 4. Frontend — React 18

### 4.1 Tech Stack

| Layer | Package | Version | 用途 |
|---|---|---|---|
| Language | `TypeScript` | 5.x | Types 從 openapi.yaml 自動生成，zero drift |
| Build | `Vite` | 5.x | 毫秒級 HMR，生產 bundle 優化 |
| Framework | `React` | 18.x | Concurrent features, Suspense |
| HTTP | `axios` | 1.7 | Request/response interceptors for JWT |
| Global State | `zustand` | 4.x | 只存 user identity，不存 token |
| Server State | `@tanstack/react-query` | 5.x | 4-tier cache，自動 background sync |
| Forms | `react-hook-form + zod` | — | Schema-validated forms |
| Routing | `react-router-dom` | 6.x | Client-side navigation，protected routes |
| Testing | `vitest` | 2.x | Jest-compatible，Vite-native |
| Testing | `@testing-library/react` | 16.x | Component rendering + queries |
| Testing | `@testing-library/user-event` | 14.x | 真實瀏覽器事件模擬（非 fireEvent） |
| Testing | `msw` | 2.x | Network-level API mocking |

**Zustand vs React Query 分工：**
- Zustand → 誰在登入（user identity）
- React Query → API 資料快取（server state）
- Access token → in-memory variable（任何 store 都不存）

### 4.2 Auth Flow & Token Strategy

#### Token 設計

| Token | TTL | 存放位置 | 說明 |
|---|---|---|---|
| Access Token (JWT HS256) | 15 分鐘 | In-memory variable | 每次 API 請求附上 |

<div class="callout danger">
  <span class="callout-icon">🚨</span>
  <p><strong>絕對禁止：</strong>Access token 絕對不能存入 <code>localStorage</code>。XSS 可直接讀取。只存 module-level 變數，頁面重整就清空，這是刻意的設計。</p>
</div>

> **Stateless JWT：** 本專案使用 fastapi-users 的 stateless JWT 策略。沒有 server-side sessions，沒有 refresh token。Token 過期後用戶需重新登入。

#### Login Flow

```
① User 輸入 email + password
② React → POST /auth/jwt/login (form-data: username=email, password=...)
③ FastAPI (fastapi-users) → 驗證 → 回傳 { access_token, token_type }
④ React: store token in memory → Zustand user store 更新 → 導向 dashboard
```

#### Social Login Flow（Google）

```
① User 點擊 "Login with Google"
② React → GET /auth/social/google/authorize
③ FastAPI 轉址至 Google Consent Screen（OAuth2）
④ Google → GET /auth/social/google/callback?code=...
⑤ FastAPI: exchange code → validate → upsert user in DB
⑥ FastAPI 回傳 { access_token, token_type }
⑦ React: store token in memory → Zustand user store 更新 → 導向 dashboard
```

### 4.3 4-Tier Cache Strategy

所有 React Query hooks 必須使用 `cacheConfig.ts` 中定義的 tier。**永遠不要** inline hardcode `staleTime`。

```typescript
// cacheConfig.ts
export const STATIC       = { staleTime: 60 * 60_000,  gcTime: 2  * 60 * 60_000 }; // 1hr
export const SEMI_DYNAMIC = { staleTime: 15 * 60_000,  gcTime: 30 * 60_000 };        // 15min
export const SECURITY     = { staleTime:  5 * 60_000,  gcTime: 10 * 60_000 };        // 5min
export const REALTIME     = { staleTime:  1 * 60_000,  gcTime:  5 * 60_000,          // 1min
                               refetchInterval: 60_000 };
```

| Tier | staleTime | 適用資料 |
|---|---|---|
| `STATIC` | 1 小時 | User profile、地點資訊、系統設定 |
| `SEMI_DYNAMIC` | 15 分鐘 | Holdings、Watchlists、Portfolio 摘要 |
| `SECURITY` | 5 分鐘 | Auth state、Permissions |
| `REALTIME` | 1 分鐘 | 股票價格、Exchange rates、Live data |

```typescript
// hooks/useHoldings.ts — 正確做法
import { SEMI_DYNAMIC } from '@/cacheConfig';

export function useHoldings() {
  return useQuery({
    queryKey: ['holdings'],
    queryFn: () => api.holdings.list(),
    ...SEMI_DYNAMIC,
  });
}

// ⚠️ mutation 之後永遠要配 invalidation（用 onSettled，非 onSuccess）
export function useAddHolding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.holdings.create,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['holdings'] });
    },
  });
}
```

### 4.4 API Client & Interceptors

```typescript
// api/client.ts
import axios from 'axios';

const apiClient = axios.create({ baseURL: import.meta.env.VITE_API_URL });

// Request: attach token from in-memory store
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken(); // module-level variable
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response: handle 401 → redirect to login
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      clearAccessToken();
      window.location.href = '/login';
    }
    throw error;
  }
);
```

### 4.5 Testing (Vitest + MSW)

**MSW** 在 network 層攔截，測試行為最接近真實；**`userEvent`** 模擬真實瀏覽器事件，`fireEvent` 不模擬 focus/blur/keyboard。

```typescript
// ✅ 正確做法
import { userEvent } from '@testing-library/user-event'; // NOT fireEvent
import { http, HttpResponse } from 'msw';

it('submits credentials and stores token', async () => {
  const user = userEvent.setup(); // real browser event simulation

  server.use(
    http.post('/auth/jwt/login', () =>
      HttpResponse.json({ access_token: 'mock.jwt', token_type: 'bearer' })
    )
  );

  render(<LoginForm />);
  await user.type(screen.getByLabelText('Email'), 'test@example.com');
  await user.type(screen.getByLabelText('Password'), 'hunter2');
  await user.click(screen.getByRole('button', { name: 'Login' }));

  expect(screen.getByText('Welcome back!')).toBeInTheDocument();
});
```

```bash
# 執行 client tests
cd client
pnpm run test:run          # 一次跑完（82 tests across 17 files）
pnpm run test              # watch mode
pnpm run test:coverage     # coverage report (gate: ≥ 80%, v8 provider)
pnpm run test:e2e          # Playwright E2E tests（11 tests, chromium）
```

**ErrorBoundary** — 包裹所有 routes，捕獲 React render 錯誤後顯示 styled fallback UI，dev mode 顯示錯誤詳情。

**E2E Tests (Playwright)** — `client/e2e/auth-flow.spec.ts` 涵蓋頁面載入、導航流程、auth 互動、法律頁面。配置在 `playwright.config.ts`，dev server 自動啟動。

### 4.6 Service Layer Pattern

所有 API 呼叫都經過三層架構：**Zod Schema → Service Factory → Hook Factory**。每一層都有明確職責。

#### Service Factory

`createService` 自動產生標準 CRUD 操作，每個回應都經過 Zod 驗證。

```typescript
// api/services/createService.ts
import { createService } from './createService';
import { placeSchema } from '../../schemas/places';

// 一行建立完整 CRUD service
const placesService = createService('/api/v1/places', placeSchema);

// 自動包含：list (分頁), listAll, getById, create, update, remove
// 每個回應都會經過 Zod parse — runtime 就能抓到 schema drift
```

#### Hook Factory

`useServiceQuery` 和 `useServiceMutation` 封裝了 React Query 的常見模式。

```typescript
// hooks/usePlaces.ts
import { useServiceQuery, useServiceMutation } from './useService';
import { CACHE_TIERS } from '../cacheConfig';

export const usePlaces = (params?) =>
  useServiceQuery(['places', params], () => svc.list(params), CACHE_TIERS.STANDARD);

export const useCreatePlace = () =>
  useServiceMutation(svc.create, { invalidateKeys: [['places']] });
// invalidation 在 onSettled 觸發（非 onSuccess），確保 error 時也更新快取
```

#### `satisfies` Bridge（OpenAPI ↔ Zod 編譯期防漂移）

```typescript
// schemas/auth.ts
import type { components } from '../api/types'; // openapi-typescript 自動生成
type ApiUserRead = components['schemas']['UserRead'];

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  // ...
}) satisfies z.ZodType<ApiUserRead>;
// ↑ 如果 Zod 和 OpenAPI 定義不同步，TypeScript 編譯就會報錯
```

#### 新增 Domain 標準流程

```
1. openapi.yaml    加入新的 paths + schemas
2. generate:types  pnpm generate:types → 更新 src/api/types.ts
3. schema          src/schemas/{domain}.ts + satisfies bridge
4. service         src/api/services/{domain}.ts（用 createService）
5. hooks           src/hooks/use{Domain}.ts（用 useServiceQuery/Mutation）
6. MSW handlers    src/tests/helpers/ 用 createCrudHandlers() 自動生成
7. tests           3 層測試：schema → service → hook
```

<div class="callout info">
  <span class="callout-icon">💡</span>
  <p><strong>Auth 是特例：</strong>Auth 使用 adapter pattern（<code>api/auth.ts</code>），因為 login 用 form-data、register 有 auto-login。其他所有 domain 都使用 <code>createService</code> factory。</p>
</div>

---

## 5. Backend — FastAPI

### 5.1 Tech Stack

| Layer | Package | Version | 用途 |
|---|---|---|---|
| Framework | `FastAPI` | 0.115 | Async REST + OpenAPI 自動文件 |
| Language | `Python` | 3.12 | Type hints + asyncio |
| Auth | `fastapi-users` | 15.x | Users, JWT, OAuth, password reset, email verification |
| OAuth | `httpx-oauth` | — | Google + GitHub OAuth providers |
| Validation | `Pydantic v2` | 2.x | Request/Response schema |
| Password | `pwdlib[argon2]` | — | Via fastapi-users (不是 bcrypt/passlib) |
| ORM | `SQLAlchemy 2.x` | 2.x | Async sessions + `Mapped[type]` syntax |
| Migrations | `Alembic` | — | `--autogenerate` 偵測 schema diff |
| Settings | `pydantic-settings` | — | Typed env vars from `.env` |
| Rate Limit | `slowapi` | — | 5 req/min on auth routes |
| Testing | `pytest + pytest-asyncio` | — | `asyncio_mode=auto` |
| Pkg Mgmt | `uv` | — | 取代 pip，更快的套件管理 |

<div class="callout danger">
  <span class="callout-icon">🚨</span>
  <p><strong>禁用套件：</strong><code>python-jose</code> 自 2022 後未維護，有已知漏洞。<code>passlib</code> 自 2023 後未維護。這兩個套件<strong>絕對禁用</strong>。fastapi-users 使用 <code>pwdlib</code> 處理密碼雜湊。</p>
</div>

### 5.2 API Endpoints

#### Auth Routes (`/auth`)

| Method | Path | Auth | 說明 |
|---|---|---|---|
| `POST` | `/auth/jwt/login` | — | Email + password 登入 (form-data, `username`=email) |
| `POST` | `/auth/jwt/logout` | Bearer | 登出 → 204 |
| `POST` | `/auth/register` | — | 建立帳號，回傳 user |
| `POST` | `/auth/forgot-password` | — | 寄重設連結（**永遠回 202**） |
| `POST` | `/auth/reset-password` | — | 用 token 設定新密碼 |
| `POST` | `/auth/request-verify-token` | — | 寄 email 驗證連結 |
| `POST` | `/auth/verify` | — | 確認 email token |
| `GET` | `/auth/social/google/authorize` | — | OAuth2 redirect |
| `GET` | `/auth/social/google/callback` | — | OAuth2 callback → JWT |

#### User Routes (`/users`)

| Method | Path | Auth | 說明 |
|---|---|---|---|
| `GET` | `/users/me` | Bearer | 取得目前登入 user |
| `PATCH` | `/users/me` | Bearer | 更新 profile |

#### Error Codes

| HTTP | Code | 說明 |
|---|---|---|
| 400 | `REGISTER_USER_ALREADY_EXISTS` | Email 已被註冊 |
| 400 | `REGISTER_INVALID_PASSWORD` | 密碼不符規則 |
| 400 | `LOGIN_BAD_CREDENTIALS` | 帳號或密碼錯誤 |
| 400 | `LOGIN_USER_NOT_VERIFIED` | 帳號未驗證 email |
| 401 | Unauthorized | JWT 無效或過期 |
| 429 | Rate Limited | 超過 auth route 請求限制 |

### 5.3 Database Design

#### Core Tables (fastapi-users managed)

```
user
  id              UUID v4  PK  (SQLAlchemyBaseUserTableUUID)
  email           VARCHAR(320) UNIQUE NOT NULL
  hashed_password VARCHAR NULLABLE  ← NULL = social-only account
  is_active       BOOLEAN DEFAULT TRUE
  is_superuser    BOOLEAN DEFAULT FALSE
  is_verified     BOOLEAN DEFAULT FALSE
  display_name    VARCHAR(100) NULLABLE  ← custom field
  avatar_url      TEXT NULLABLE          ← custom field

oauth_account
  id              UUID v4 PK  (SQLAlchemyBaseOAuthAccountTableUUID)
  user_id         UUID FK → user.id
  oauth_name      VARCHAR(100)   ← 'google', 'github'
  access_token    VARCHAR(1024)
  expires_at      INTEGER NULLABLE
  refresh_token   VARCHAR(1024) NULLABLE
  account_id      VARCHAR(320)
  account_email   VARCHAR(320)
```

#### SQLAlchemy 2.x 寫法

```python
# 永遠用 Mapped[type] = mapped_column(...) 語法
# User 繼承 fastapi-users 的 base class，只加 custom fields
class User(SQLAlchemyBaseUserTableUUID, Base):
    display_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    oauth_accounts: Mapped[list[OAuthAccount]] = relationship("OAuthAccount", lazy="joined")
```

#### Key Decisions

| 決策 | 選擇 | 原因 |
|---|---|---|
| Auth framework | fastapi-users v15 | 完整的 user lifecycle，免寫自訂 auth code |
| Primary Key | UUID v4 (CHAR(36)) | 防止 sequential enumeration，SQLite 相容 |
| Password hash | pwdlib + argon2 | fastapi-users 預設，比 bcrypt 更安全 |
| OAuth eager load | `lazy="joined"` | 避免 N+1 queries |
| Migrations | Alembic `--autogenerate` | 自動偵測 ORM 與 DB schema 的差異 |

```bash
# Migration 常用指令
alembic upgrade head                    # 跑到最新
alembic revision --autogenerate -m "add places table"  # 生成新 migration
alembic downgrade -1                    # 回退一版
alembic current                         # 目前版本
```

### 5.4 Security Architecture

| 威脅 | 防禦方式 |
|---|---|
| XSS token 竊取 | Access token in-memory only，絕不存 localStorage |
| Email enumeration | `forgot-password` 永遠回 202，不論帳號是否存在 |
| 暴力破解 | `slowapi` 15 req/min on auth routes → 429 + `Retry-After` header |
| Sequential ID 枚舉 | UUID v4 primary keys |
| 未授權存取 | 所有 protected routes 必須用 `current_active_user` dependency |
| 密碼儲存 | pwdlib argon2 hash（fastapi-users 管理） |

### 5.5 Testing (pytest)

```toml
# pyproject.toml — 這個設定讓所有 async test 不需要 decorator
[tool.pytest.ini_options]
asyncio_mode = "auto"   # no @pytest.mark.asyncio needed
testpaths = ["tests"]
addopts = "--strict-markers -q"
```

```python
# tests/conftest.py — 共用 fixtures
# ⚠️ 必須 override 三個 dependencies: get_db, get_user_db, get_user_manager
@pytest.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSession(test_engine) as session:
        yield session

@pytest.fixture
async def verified_user(db) -> User:
    return await create_test_user(db, is_verified=True)
```

<div class="callout warn">
  <span class="callout-icon">⚠️</span>
  <p><strong>Test 設定重點：</strong>conftest 必須 override <code>get_db</code>、<code>get_user_db</code>、和 <code>get_user_manager</code> 三個 dependencies。Coverage 設定需要 <code>concurrency = ["greenlet", "thread"]</code> 才能正確計算 async SQLAlchemy。</p>
</div>

```bash
cd server
uv run python -m pytest                                        # 全部（76 tests）
uv run python -m pytest tests/unit/                            # 只跑 unit tests
uv run python -m pytest --cov=app --cov-report=term-missing    # 含 coverage
uv run python -m pytest tests/integration/test_auth_login.py -v  # 單一檔案
uv run python -m pytest -k "test_register"                     # filter

# Coverage gate: ≥ 80%（低於此值 CI 和 /athena:deploy 被 block）
```

---

## 6. OpenAPI — Shared Contract

`docs/openapi.yaml` 是前後端唯一的 schema 來源。TypeScript types 從這裡自動生成，永遠不會有 schema 不一致的問題。

```bash
# 每次 openapi.yaml 更新後執行
cd client && pnpm generate:types   # → src/api/types.ts（自動生成，不要手動編輯）

# Lint 檢查（@spec-writer 和 /athena:deploy 都會跑這個）
npx @redocly/cli lint docs/openapi.yaml
```

**三層型別安全流程：**

```
openapi.yaml ──(openapi-typescript)──▸ src/api/types.ts（編譯期型別）
                                            │
                                      ┌─────┴─────┐
                                      ▼           ▼
                           src/schemas/*.ts    TypeScript
                           (Zod + satisfies)   型別檢查
                                      │
                                      ▼
                           src/api/services/*.ts
                           (Runtime Zod 驗證)
```

Zod schema 使用 `satisfies z.ZodType<ApiType>` 橋接生成的型別，**編譯期**就能抓到 openapi.yaml 和 client schema 的不一致。

```yaml
# docs/openapi.yaml — 結構範例
openapi: "3.1.0"
info:
  title: AI-Coding-Template API
  version: "1.0.0"

paths:
  /auth/register:
    post:
      operationId: register
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RegisterRequest'
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
```

<div class="callout info">
  <span class="callout-icon">💡</span>
  <p><strong>openapi.yaml 目前狀態：</strong>17 paths, 9 schemas — 完整涵蓋所有已實作的 endpoints。每次新增 endpoint 前必須先更新 spec。</p>
</div>

---

## 7. Development Workflow — SDD + TDD

每個 feature 嚴格按照這個順序：

```
1. SPEC     更新 docs/openapi.yaml（先改 spec，不可以先寫 code）
            ↓
2. GENERATE pnpm generate:types → 更新 client/src/api/types.ts
            ↓
3. SCHEMA   建 Zod schema + satisfies bridge（編譯期防漂移）
            ↓
4. SERVICE  用 createService() factory 或自訂 API function
            ↓
5. RED      寫失敗測試（pytest + vitest）— 確認測試真的會 FAIL
            ↓
6. GREEN    寫最少代碼讓測試通過 — 不要 gold-plate
            ↓
7. REFACTOR 在測試全綠的狀態下清理代碼
            ↓
8. REVIEW   /athena:qa → @qa 安全 + 架構審查
            ↓
9. COMMIT   git commit -m "feat(auth): add register endpoint"
```

### Claude Code 快速指令

```bash
# 序列模式（一次一個 Epic）
/athena:loop                     # 推進當前 Epic 一步
/loop 2m /athena:loop auto       # 每 2 分鐘自動推進（auto-pilot）

# 並行模式（多個 Epic 同時執行）
/athena:batch --phase 25 --dry-run   # 預覽執行計畫
/athena:batch --phase 25             # 啟動（最多 4 個並行 worktree agent）
/athena:batch --phase 25 --tier A    # 只跑 Tier A epic（依分類篩選）

# 開發指令
/athena:spec "feature name"      # @spec-writer 設計 openapi.yaml + implementation plan
/athena:implement feature-name   # TDD 實作（自動 RED → GREEN → REFACTOR）
/athena:qa                       # @qa 安全 + 架構審查 + 全套測試 + coverage gate
/athena:qa --review-only         # @reviewer 唯讀 code review（安全、架構、a11y）
/athena:pr                       # Pre-PR pipeline
/athena:deploy staging           # @deployer 6 gates 全過才部署
/athena:dba lint                 # 資料庫遷移檢查、修復、產生遷移檔
/athena:dashboard                # 唯讀管線儀表板 — 從審計日誌顯示進度

# 狀態管理
/athena:save                     # 所有 agents checkpoint 到 docs/context/
/athena:load                     # 載入 context，恢復狀態
/athena:plan                     # @strategist 策略分析 → 提案 → 人工批准
/athena:promote                  # @memory-curator 把經驗提升到 template memory

# 工具
./scripts/epic-graph.sh --status         # 查看各 Phase 進度
./scripts/epic-graph.sh --phase N --classify  # 依賴圖 + 層級分類
jq 'select(.exit != 0)' .claude/audit.jsonl   # 查詢失敗命令
```

---

## 8. Environment Variables

### Server (`server/.env`)

| Variable | Example | Required |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@localhost/saas_dev` | ✅ |
| `SECRET_KEY` | `openssl rand -hex 32` | ✅ |
| `GOOGLE_CLIENT_ID` | `xxx.apps.googleusercontent.com` | OAuth |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxx` | OAuth |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | ✅ |
| `DEBUG` | `true` (dev) / `false` (prod) | ✅ |
| `SMTP_HOST` | `smtp.resend.com` | Email 功能 |
| `SMTP_USER` | `resend` | Email 功能 |
| `SMTP_PASSWORD` | `re_xxx` | Email 功能 |
| `SMTP_FROM` | `noreply@yourdomain.com` | Email 功能 |

### Client (`client/.env.local`)

| Variable | Example | Note |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8080` | Baked at **build time**，不是 runtime |

<div class="callout warn">
  <span class="callout-icon">⚠️</span>
  <p><strong>VITE_API_URL 注意：</strong>這個值在 build time 就打包進 JS bundle，不是 runtime 讀取。Production 部署前必須在 Zeabur 設定好，再觸發 rebuild。</p>
</div>

---

## 9. Deployment — Zeabur

### Pre-deploy Gates（全部通過才能 deploy）

```bash
cd server && pytest --cov=app --cov-fail-under=80 -q     # ✅ ≥ 80%
cd client && pnpm run test:run -- --coverage               # ✅ ≥ 80%
npx @redocly/cli lint docs/openapi.yaml                   # ✅ valid
cd client && pnpm run typecheck                            # ✅ no errors
git status --porcelain                                    # ✅ clean
git branch --show-current                                 # ✅ = main
```

### Deploy Flow

```bash
# 1. 推送觸發 GitHub Actions CI（.github/workflows/ci.yml）
#    2 個平行 jobs：backend, frontend
#    - backend: uv sync + pytest --cov=app --cov-fail-under=80
#    - frontend: pnpm install + type gen check + pnpm test:coverage
#    PR 會自動貼上 coverage comment（sticky-pull-request-comment）
git push origin main

# 2. Zeabur 自動 deploy（webhook from GitHub Actions）

# Server startup command:
# alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8080

# 3. Health check（等 30s 讓 Zeabur 啟動）
sleep 30 && curl --fail https://your-server.zeabur.app/health
```

### Zeabur 設定

```json
// server/zbpack.json
{
  "build_command": "pip install -r requirements.txt",
  "start_command": "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8080"
}
```

```json
// client/zbpack.json
{
  "build_command": "pnpm run build",
  "output_dir": "dist"
}
```

### Rollback

```bash
# 優先：git revert（保留歷史）
git revert HEAD && git push origin main
```

---

## 10. AI Agent Team

9 個 AI subagents，在 Claude Code 中以獨立 context window 執行。支援序列（loop）與並行（batch）兩種開發模式。

| Agent | Model | 觸發方式 | 職責 |
|---|---|---|---|
| `@spec-writer` | claude-opus | `/athena:spec` | OpenAPI-first feature spec，不寫 code |
| `@qa` | claude-sonnet | `/athena:qa` | 安全 + 架構 + TDD 三層審查，pytest + vitest，強制 80% gate |
| `@reviewer` | claude-sonnet | `/athena:qa --review-only` | 唯讀 code review — 安全審計、架構一致性、a11y 檢查。不能修改檔案或執行測試，結果寫入 `review-findings.md` |
| `@best-practice` | claude-opus | 架構問題自動委派 | 深度架構建議，記錄 Decision Log |
| `@debugger` | claude-sonnet | error 時自動委派 | 5 phase 根因分析，自動重試 + 12 種已知失敗模式比對，3 次失敗 escalate |
| `@deployer` | claude-sonnet | `/athena:deploy` | 6 gates + Zeabur + health check |
| `@memory-curator` | claude-sonnet | `/athena:promote` | 自學引擎，提升經驗到 template tier |
| `@strategist` | claude-opus | `/athena:plan` | 策略分析、Epic 提案（需人工批准） |
| `@orchestrator` | claude-opus | `/athena:batch` | 並行 Epic 協調 — 依賴圖、波次調度、衝突偵測、失敗重試 |

### 開發模式

**序列模式**：`/athena:loop` 一次推進一個 Epic 一步。搭配 `/loop 2m /athena:loop auto` 可自動執行。

**並行模式**：`/athena:batch --phase N` 解析依賴圖，將 Epic 分成波次，每波次最多 4 個 worktree agent 同時執行。每波次結束後執行整合測試閘門（E91），確保合併後無回歸。吞吐量提升約 4 倍。

### 觀測性

| 工具 | 用途 |
|------|------|
| Webhook | 設定 `$AI_CODING_WEBHOOK_URL` 接收 Slack/Discord/n8n 通知 |
| JSONL 審計日誌 | `.claude/audit.jsonl` — `jq` 查詢失敗命令、按 agent/epic 篩選 |
| 依賴圖 | `./scripts/epic-graph.sh --phase N --classify` — 波次 + 層級 |
| Stop Verifier | 8 條規則自動檢查（localStorage、fireEvent、OpenAPI 漂移、console.log 等） |
| PR 自動化 | `pr-created.sh` — 自動標籤、指派 reviewer、Epic context comment |
| 管線儀表板 | `/athena:dashboard` — 從審計日誌 + 協調資料顯示唯讀進度報告 |

### Code Review 層級

```
🔴 Critical（merge 前必修）
   - 使用 fastapi-users 標準 routers，不自寫 auth code
   - Access token 只在 in-memory variable
   - Protected routes 有 current_active_user dependency
   - 無 hardcoded secrets
   - 禁用 python-jose 和 passlib

🟡 Warning（應修改）
   - openapi.yaml 是否先改？
   - React Query cache tier 是否正確？
   - Model 有變動的話有 Alembic migration？
   - Test conftest override 三個 dependencies？

🟢 Suggestion（建議改進）
   - 命名清晰度
   - 重複邏輯提取
   - TypeScript 嚴謹度
```

### Debugger 自動重試與失敗模式比對（E88）

`@debugger` 支援自動重試機制，搭配 `post-bash-failure-inject.sh` hook 進行已知模式比對：

1. **失敗偵測**：hook 偵測到 test/build 指令的非零 exit code 後，自動注入已知模式比對結果
2. **重試流程**：收到 retry metadata（前次錯誤輸出 + 已知模式 + 重試次數），優先套用已知修復
3. **熔斷機制**：同一錯誤模式連續出現兩次，自動停止重試並 escalate 到人工介入

**12 種已知失敗模式：**

| 分類 | 數量 | 範例 |
|------|------|------|
| Server 端 | 9 | JWT library 混用、asyncio loop、Alembic drift、bcrypt import、Pydantic v2 語法、module not found、port conflict、passlib deprecation、GUID type |
| Client 端 | 7 | Stale UI、MSW handler 遺漏、tokenCache null、fireEvent（禁用）、localStorage（禁用）、React Query cache tier、import path 錯誤 |

### PR 自動化 Hook（E90）

`pr-created.sh` hook 在 `gh pr create` 執行後自動觸發（非阻塞，always exit 0）：

| 功能 | 說明 |
|------|------|
| **Auto-Label** | 自動加 `phase:N`、`epic:E{n}`、`size:S\|M\|L`、`agent:batch\|loop` 標籤 |
| **Auto-Assign Reviewer** | 根據變更檔案自動指派：`server/` → `$PR_REVIEWER_BACKEND`，`client/` → `$PR_REVIEWER_FRONTEND` |
| **Epic Context Comment** | 在 PR 加上 markdown 表格（Epic ID、名稱、Phase、Size、依賴關係） |

優雅降級：缺少 `gh` CLI、環境變數未設定、API 錯誤時靜默跳過。

### Post-Wave 整合測試閘門（E91）

`/athena:batch` 每個波次完成後，在進入下一波次前執行整合測試：

```
Wave N agents complete
    ↓
Merge all wave branches → main
    ↓
Run full server test suite (pytest --cov)
    ↓
Run full client test suite (vitest --coverage)
    ↓
Coverage ≥ 80%? → YES → proceed to Wave N+1
                → NO  → halt pipeline, report regression suspect
```

- **回歸偵測**：比較合併前後測試結果，識別導致失敗的 epic branch
- **可跳過**：`--skip-integration-test` flag 可略過（僅限信任場景）

---

## 11. Memory System

本專案使用兩層記憶系統，讓每個 session 都能快速恢復 context，並且讓學到的經驗可以傳承給下一個專案。

### 恢復 Context 的三種方式

**Option A — Claude Code（自動）**
SessionStart hook 自動載入 `docs/context/session-summary.md` + `~/.claude/template-memory/NEW_PROJECT_PRIMER.md`，什麼都不用做。

**Option B — 任何 Claude 介面**
上傳 `TECHSTACK.md` → 架構、決策、目前狀態全部恢復。

**Option C — 隨時 checkpoint**
說 `"update your document"` → 任何 agent 立即寫回 `docs/context/` 對應的檔案。

### Agent → 文件對照

| Agent | 寫回的文件 |
|---|---|
| All agents | `docs/context/session-summary.md` |
| `@spec-writer` | `docs/context/spec-log.md` |
| `@qa` | `docs/context/review-log.md` `docs/context/test-status.md` |
| `@reviewer` | `docs/context/review-findings.md` |
| `@best-practice` | `docs/context/decisions.md` |
| `@debugger` | `docs/context/debug-log.md` |
| `@deployer` | `docs/context/deploy-log.md` |
| `@orchestrator` | `docs/context/orchestration-log.md` |
| `@memory-curator` | `~/.claude/template-memory/*.md` |

### Self-Learning：讓下一個專案繼承智慧

```bash
/athena:promote
```

<div class="callout success">
  <span class="callout-icon">🧠</span>
  <p><code>@memory-curator</code> 讀取所有 <code>docs/context/</code> 的 write-back，提取標記為 <code>[GENERALIZABLE]</code> 的項目，提升到 <code>~/.claude/template-memory/</code>。下一個使用本 template 的專案，Day 1 就會自動載入這些累積的智慧。</p>
</div>

---

## 12. Track Roadmap

| Track | 領域 | 狀態 | 主要內容 |
|---|---|---|---|
| **Track 1** | Auth & Identity Core | 🟡 In Progress | users, JWT, Google OAuth, React auth UI |
| **Track 2** | Place Intelligence | ⬜ Planned | PostGIS, places table, map API, React Map, scoring |
| **Track 3** | Investment Portfolio | ⬜ Planned | holdings, analytics, React dashboards, charts |

Track 2 和 Track 3 都共用 Track 1 的 JWT middleware 作為 shared dependency，只新增 Alembic migrations 和 FastAPI routers，不修改 auth core。

### 目前下一步（Track 1）

```bash
# Step 1
/athena:spec "auth register endpoint"
# → @spec-writer 設計 POST /auth/register
# → 建立 RegisterRequest + UserResponse schemas in openapi.yaml

# Step 2
/athena:implement auth-register
# → 先寫 test_register.py（RED — 確認失敗）
# → 再寫 register endpoint（GREEN）
# → @qa 自動審查 fastapi-users 用法

# Step 3
# 繼續：login → verify → forgot-password → social login → users/me

# Step 4
/deploy staging
# → @deployer 確認 6 gates → Zeabur deploy → health check
```

---

## 13. Changelog

> Auto-generated by `git-cliff`. Run `./scripts/changelog.sh` to regenerate.

### v1.2.0 — Pipeline Automation & Observability (Phase 26)

- **feat(E88):** Debugger Auto-Retry — `post-bash-failure-inject.sh` hook，12 種已知失敗模式自動比對 + 熔斷機制
- **feat(E89):** @reviewer Agent — 從 @qa 拆分出唯讀 code reviewer，專責安全審計、架構一致性、a11y 檢查
- **feat(E90):** PR Automation Hooks — `pr-created.sh` 自動標籤、指派 reviewer、Epic context comment
- **feat(E91):** Post-Wave Integration Test Gate — 波次合併後自動跑完整測試，回歸偵測 + 熔斷
- **feat(E92):** `/athena:dashboard` — 唯讀管線儀表板，從審計日誌 + 協調資料視覺化進度
- **feat(E93):** `/athena:dba` — 資料庫遷移助手（inspect、lint、diagnose、generate）

### v1.1.0 — Parallel Pipeline & Orchestration (Phase 25)

- **feat(E82):** Webhook + JSONL Audit Log — `task-completed.sh` webhook 通知 + `.claude/audit.jsonl` 全指令記錄
- **feat(E83):** Epic Dependency Graph — `scripts/epic-graph.sh` 依賴圖解析、波次分類、Mermaid 輸出
- **feat(E84):** @orchestrator Agent — 並行 Epic 協調、依賴圖波次調度、衝突偵測、失敗重試
- **feat(E85):** `/athena:batch` — 並行 Epic 執行引擎，worktree 隔離，最多 4 個同時 agent
- **feat(E86):** Stop Verifier Hook — 8 條規則自動檢查 changed files，違規時 block completion
- **feat(E87):** Session Context Injection — `session-start.sh` 自動注入分支、session summary、active phase

### v1.0.0 — Beginner DX & 1.0 Milestone (Phase 12–16)

- **feat(E32):** Pipeline Friction Fixes — guard regex、session trim、stash-free merge
- **feat(E33):** System Learning & Validation — QA feedback loop、memory GC、smoke test
- **feat(E34):** Template Hygiene — parameterize all domain remnants
- **feat(E35):** RBAC & Team Scoping — roles, teams, ownership checks
- **feat(E36):** Stripe Billing Integration — checkout, portal, webhooks, feature gates
- **feat(E37):** i18n Framework — react-i18next + server message keys
- **chore(E38):** Dependency Security & Node 22 — fix vulns, migrate runtime
- **feat(E39):** 1M Context Adaptation — SessionStart expansion, agent preloading
- **feat(E40):** Zeabur One-Click Template — Dockerfile, GHCR CI, template YAML
- **feat(E41):** Zero-Config Dev Startup — `make go`, prereq checker, Docker dev profile
- **feat(E42):** README Rewrite for Beginners — 450→186 lines, progressive disclosure
- **feat(E43):** Bilingual Developer Docs — EN/ZH guide translations
- **feat(E44):** Guided First-Run Experience — tutorial, getting-started page
- **feat(E45):** Env Validation & Smart Defaults — `make doctor`, generate-env, startup guards
- **feat(E46):** Visual README & Onboarding Discovery — screenshots, getting-started links

### v0.12.0 — Universal Template Transformation (Phase 8–11)

- **feat(E22):** Domain Registry — auto-discovery pattern, modular domain dirs
- **feat(E23):** Domain Generator — `/athena:domain <name>` 一鍵生成新領域模組
- **feat(E24):** 快速上手指南 + 第一個 Epic 教學（繁中）
- **docs(E25):** OpenAPI Spec Templates — CRUD / 分頁 / 巢狀資源模板
- **feat(E26):** Interactive Onboarding CLI — `--tutorial` 引導開發模式
- **docs(E27):** 5 組 Mermaid 架構圖（系統、pipeline、agent、auth、domain）
- **docs(E28):** Example Domain Showcase — blog / CRM / todo 完整參考範例
- **refactor(E29):** CLAUDE.md + TECHSTACK.md 模板化（`{{PROJECT_DISPLAY}}` 變數）
- **docs(E30):** Domain Agent Pattern — 自訂 Agent 指南 + 模板
- **feat(E31):** GitHub Template Distribution — cleanup script、README、CONTRIBUTING

### v0.11.0 — Interactive Site Builder CLI (Phase 7)

- **feat(E21):** Interactive Site Builder CLI with @clack/prompts
- **feat:** `pnpm new-site` 互動式建站：prerequisite checks、config wizard、file scaffolding

### v0.10.0 — Quality & Accessibility (Phase 5–6)

- **feat(E16):** Security Hardening — rate limiting decorators, security headers, audit logging
- **feat(E17):** Financial Data Integrity — Float→Numeric(12,2), Decimal schemas
- **feat(E18):** Domain UI — PlacesPage + PortfoliosPage with Recharts analytics
- **feat(E19):** Session Cleanup & Observability — background purge, JSON logging, correlation IDs
- **feat(E20):** Accessibility (WCAG 2.1 AA) — SkipNav, focus management, ARIA landmarks

### v0.9.0 — Domain CRUD & Deploy (Phase 2–4)

- **feat(E4–E6):** Domain CRUD endpoints, service layer factory
- **feat(E7–E8):** Theme system (4 themes), SEO components
- **feat(E9):** Zeabur deployment, zbpack configs
- **feat(E10–E11):** CI/CD, infrastructure hardening

### v0.8.0 — CI Pipeline, Error Boundary & E2E

- **feat:** GitHub Actions CI — 3 parallel jobs, coverage gates (≥80%), PR coverage comments
- **feat:** ErrorBoundary 包裹所有 routes，styled fallback UI
- **feat:** Playwright E2E test suite（11 tests, auth flows + navigation）
- **feat:** Token refresh deduplication in Axios interceptor
- **feat:** Husky + lint-staged pre-commit hooks（ruff for Python）
- **feat:** PostGIS extension prep（`ensure_extensions()` helper）
- **feat:** Vitest coverage config with v8 provider + 80% thresholds
- **refactor:** extractApiDetail utility, code review fixes
- **fix:** CI pipeline errors, TS type errors in TEST_USER

### v0.7.0 — Test Coverage

- **test:** 158 total tests（82 client + 76 server）across unit + integration suites
- **feat:** VerifyEmailPage（`/verify-email?token=...`）
- **fix:** dev-docs contrast, sidebar order, rate limit bump

### v0.6.0 — Athena Namespace & Docker Optimization

- **refactor:** Namespace all commands under `/athena:*` (spec, implement, qa, pr, deploy, load, save, promote)
- **refactor:** Merge `/review` + `/test` into `/athena:qa` with `--review-only` / `--test-only` flags
- **refactor:** MailHog → Mailpit (actively maintained drop-in replacement)
- **refactor:** Docker — add .dockerignore, gzip + cache headers in nginx, server healthcheck, remove db-test
- **refactor:** Downgrade `@memory-curator` from opus to sonnet (cost reduction)
- **refactor:** Reorganize docs/ folder structure (design/, techstack/)

### v0.5.0 — Dashboard & Auth UI

- **feat(client):** Full dashboard layout with 7 views, sidebar, protected route
- **feat(client):** Auth pages (SignIn, SignUp, ForgotPassword, ResetPassword) with adapter pattern
- **feat(client):** Privacy policy, terms of service pages with SEO
- **feat(agents):** Frontend a11y checks added to QA agent and review skill
- **feat:** /pr command — pre-PR pipeline with 6 gates

### v0.4.0 — pnpm & Content Restructure

- **refactor(client):** Switch package manager from npm to pnpm
- **refactor(docs):** Split large files into subdirectories for context control
- **docs:** Add landing page content source (Markdown)

### v0.3.0 — Dev Docs Site

- **feat(dev-docs):** Standalone React + Vite documentation site with dark/light mode, scroll spy sidebar, progress bar, responsive layout

### v0.2.0 — Docker & Developer Experience

- **feat:** Env-var driven docker-compose with profile-based dev/prod switch
- **docs:** Developer documentation (Markdown + HTML)

### v0.1.0 — Auth & Identity Core

- **feat:** fastapi-users migration with stateless JWT, OAuth support
- **feat:** Rate limiting (5/min), mail service
- **feat:** CLAUDE.md + subdirectory memory control files
- **fix:** 14 hook/agent/command/openapi validation fixes
