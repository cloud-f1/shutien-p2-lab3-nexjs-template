# Epic Details Archive — Phases 0–7 (E0–E21)

> Archived from EPIC_INDEX.md by E32. All epics in this file are ✅ Complete.
> For current epic details, see `docs/epics/EPIC_INDEX.md`.

---

### Phase 0 — Foundation Fix (ai-clock-work lesson)

**E0: GUID TypeDecorator** (S)
- Current `UUIDMixin` uses `String(36)` + `str(uuid.uuid4())` → returns `str` from DB
- fastapi-users' `SQLAlchemyBaseUserTableUUID` uses its own `GUID` → returns `uuid.UUID`
- Result: `user.id` is `uuid.UUID` but custom model `.id` is `str` → **joins/comparisons break**
- Fix: Define `GUID` TypeDecorator locally in `base.py` (avoid circular import)
- Also update: all FK columns → `GUID`, Pydantic → `uuid.UUID`, Zod → `z.string().uuid()`
- Test rule: JSON response values are strings, model values are `uuid.UUID` → use `str()` when comparing

### Phase 1 — Template Infrastructure (extract from ai-clock-work)

**E1: Theme System** (M)
- `themes.css`: 4 complete themes (indigo/navy/sage/dark) via CSS custom properties
- `ThemeProvider.tsx`: Zustand persist + `data-theme` attr + system preference detection
- `fonts.css`: font imports separated from globals
- Settings UI: theme picker in dashboard settings view
- Theme contract: standardized CSS variable API (users paste into AI → get new themes)

**E2: Agent Loop + Commands** (S)
- `/athena:loop`: epic orchestrator (already created — validate + test)
- `/athena:ship`: quick publish (already created — validate)
- `/athena:learn`: memory refresh (already created — validate)
- `Makefile`: task runner (`make dev`, `make test`, `make lint`, `make db`)
- Cache tier sync: align REALTIME values with ai-clock-work (5s vs 1min)

**E3: Layout + Blueprints** (M)
- `DashboardLayout.tsx`: generic sidebar + topbar + main content shell
- Page blueprints in `docs/blueprints/`: HTML wireframes for AI-assisted page generation
  - `admin-dashboard.html`, `data-list.html`, `detail-view.html`, `settings.html`
- `headless-ui.css`: base styles for Headless UI v2 drop-in
- Component variants: `StatCard`, `QuickActionCard` patterns

### Phase 2 — Auth Hardening

**E4: Email + OAuth Live** (M)
- Replace `_send_smtp()` console.log stub with real SMTP (resend or mailgun)
- Google OAuth: app creation, env vars, callback URL, test flow
- GitHub OAuth: optional second provider

**E5: Session Management** (L)
- `sessions` table: FK to User (GUID), refresh token hash, device info, expires_at
- `POST /auth/refresh`: validate + rotate + issue new pair
- `GET /users/me/sessions`: list active sessions
- `DELETE /users/me/sessions/{id}`: single-device logout
- Client: proactive refresh (decode exp, refresh 60s before expiry)

**E6: E2E Auth Tests** (M)
- Playwright test suite: register → verify email → login → dashboard → logout
- Password reset flow: forgot → check email → reset → login with new password
- OAuth flow: Google redirect → callback → dashboard
- Protected route: unauthenticated → redirect to `/signin`

### Phase 3 — Core Domain (customize per project)

**E7: Places CRUD + Map** (L)
- Place model: name, address, lat/lng (GUID PK), FK to User
- CRUD endpoints: `POST/GET/PATCH/DELETE /places`, `GET /places/nearby`
- PostGIS extension for spatial queries
- React map component (Mapbox GL JS or Leaflet)
- Service factory pattern: `createService("/places", placeSchema)`

**E8: Portfolio System** (L)
- Portfolio model: name, description, FK to User
- Place→Portfolio many-to-many relation
- Dashboard analytics: total value, allocation, performance
- Charts: Recharts (PieChart, BarChart, LineChart)

### Phase 4 — Ship

**E9: Production Deploy** (M)
- Zeabur: server + client services, PostgreSQL addon
- Env vars: all secrets, `VITE_API_URL`, database URL
- Migration on startup: `alembic upgrade head && uvicorn ...`
- Health check: `/health` endpoint, Zeabur probe config
- Sentry integration: error tracking both services

**E10: Landing + SEO** (M)
- Apply theme system to landing page (theme preview section)
- `<Seo>` component: per-route meta/title/canonical/OG
- Sitemap generation, robots.txt
- OG image: absolute URL (not relative)

### Phase 5 — Agent Evolution & Quality

**E12: Strategist Agent & DevOps Cycle** (S)
- @strategist agent: audit, research, comply, evolve modes
- `/athena:plan`: invoke @strategist, propose epics with human approval gate
- `/athena:cycle`: full state machine (PLAN → APPROVE → EXECUTE → REFLECT → COOLDOWN)
- `docs/context/strategy-log.md`: cycle state persistence

**E13: Self-Learning Enhancement** (S)
- Integrate REFLECTING phase from /athena:cycle into learn/promote pipeline
- `/athena:learn` reads strategy-log.md for cycle learnings
- `/athena:save` checkpoints @strategist state
- Close the feedback loop: cycle → reflect → learn → promote

**E14: CSS Architecture Hardening** (M)
- Extract shared button/form/card patterns to `src/styles/common/`
- Eliminate duplicated styles across AuthPages, Dashboard, Landing
- CSS architecture documentation
- Visual regression: all pages identical before/after

**E15: Test Plan & Quality Framework** (M)
- Test plan template for systematic test planning
- Test plans for Places CRUD (E7) and Portfolio System (E8)
- `--plan` flag on `/athena:qa` to generate test plan before execution

### Phase 6 — Security, Domain UI & Quality (@strategist Cycle 1)

**E16: Security Hardening** (M)
- Apply `@limiter.limit()` decorators to all endpoints (auth: 15/min, general: 200/min)
- Add security headers middleware: CSP, X-Frame-Options, HSTS, X-Content-Type-Options
- Add auth event audit logging: login success/failure, password reset, token refresh
- Add input length limits on unbounded Text fields (notes, description)

**E17: Financial Data Integrity** (S)
- Migrate `purchase_price` and `current_value` from `Float` to `Numeric(12,2)`
- Alembic migration for existing data
- Update Pydantic schemas to use `Decimal` type
- Add validation bounds (min: 0, max: reasonable limit)
- Update Zod schemas for client-side validation

**E18: Domain UI: Places & Portfolio Pages** (L)
- PlacesPage: list, detail, create/edit form views consuming `placesService`
- PortfolioPage: list, detail, analytics views consuming `portfoliosService`
- Install and integrate Recharts for portfolio analytics (PieChart, BarChart)
- Consider splitting: E18a (Places UI, ~10 SP) + E18b (Portfolio + Charts, ~11 SP)

**E19: Session Cleanup & Observability** (M)
- Background task or startup job to purge expired sessions
- Structured logging (JSON) across all endpoints with request correlation IDs
- Logger instances in auth, places, portfolios, sessions endpoints
- Log format compatible with Sentry breadcrumbs

**E20: Accessibility (WCAG 2.1 AA)** (M)
- Add ARIA landmarks (`role="main"`, `role="navigation"`, `role="banner"`)
- Add `aria-describedby` for form field error messages
- Add skip-navigation link
- Replace unicode icon characters with accessible alternatives (aria-label or sr-only text)
- Verify focus management on route transitions

### Infrastructure (can run anytime)

**E11: OpenAPI Split** (S)
- Split `docs/openapi.yaml` into domain-based modules (adapted from ai-clock-work EP41)
- Target: `docs/openapi/openapi.yaml` (entry file ~80 lines with $ref pointers)
- Domains: `paths/auth.yaml`, `paths/users.yaml`, `paths/social.yaml`, `paths/health.yaml`, `paths/sessions.yaml`
- Schemas: `schemas/common.yaml`, `schemas/auth.yaml`, `schemas/user.yaml`, `schemas/session.yaml`
- Toolchain: `@redocly/cli bundle` + update `openapi-typescript` generate script
- Zero functional change — pure structural refactor

### Phase 7 — Developer Experience

**E21: Interactive Site Builder CLI** (M)
- Node CLI with `@clack/prompts` for guided project bootstrapping
- Prerequisite checks (Node, pnpm, Python, uv, PostgreSQL, git)
- Interactive config: project name, theme, OAuth, domain features, deploy target
- File scaffolding with template variable replacement
- Domain feature removal (deselect Places/Portfolio)
- `.build-manifest.yaml` output with config + step timestamps
- Full spec: `docs/epics/e21-interactive-site-builder.md`
