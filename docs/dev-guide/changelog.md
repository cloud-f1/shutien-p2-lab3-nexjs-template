# Changelog

All notable changes to **AI App Template**, organized by version.

> **Stack note:** The current app is a single **Next.js 16** application under `next-app/`
> (App Router + React 19 + TypeScript + Tailwind v4 + shadcn/ui + Drizzle/Postgres + Auth.js v5).
> The original FastAPI (`server/`) + Vite (`client/`) two-service stack was **fully migrated to
> Next.js** (Phases 53–57) and removed. Entries below the `2.0.0` section are the pre-migration
> history, retained for the record — the technologies they mention (FastAPI, SQLAlchemy/Alembic,
> pytest, Pydantic, Vite, MSW, OpenAPI) no longer ship.

## 2.0.0 — Next.js migration (Phases 53–57)

The Vite SPA + FastAPI stack was fully migrated to a single Next.js app and hardened. Shipped to
`main` via PRs #1–#8.

### Features

- **Phase 53** — shared Zod validations, 3-tier RBAC, account settings, admin panel, Playwright
  e2e, Vitest unit suite.
- **Phase 54** — shadcn blocks UI (login-01 / signup-01 / sidebar-01 / dashboard-01) + Dockerized
  local run.
- **Phase 55** — 3-tier RBAC (admin/editor/viewer) + demo seed; consolidated `docker-compose`
  (+ Mailpit); `make local` worktree-parallel athena loop.
- **Phase 56** — shadcn blue preset + full 繁體中文 i18n + VitePress dev-docs + modular registry
  (`npx shadcn@latest add @saas/<module>`).
- **Phase 57** — audit-finding remediation + task-tiered model dispatch.

---

## 1.0.0 — 2026-03-15 (pre-migration: FastAPI + Vite)

### Bug Fixes

- rewrite as thin orchestrator with subagent delegation **(loop)** ([465bf9e](https://github.com/cloud-f1/ai-coding-template/commit/465bf9eda76572f634e75fde726a9ead9d8780ee))

### Chore

- 測試覆蓋率提升、vitest 優化、statusline 設計文件([1e44612](https://github.com/cloud-f1/ai-coding-template/commit/1e446121e158c201ecb9104a78fcdd1a5349c256))
- Dependency Security & Node 22 — fix vulns, migrate runtime, CI audit (#58) **(E38)** ([16afb31](https://github.com/cloud-f1/ai-coding-template/commit/16afb315cb79949a0d597ba9a5593ac8cd3a4285))

### Documentation

- 標記 Phase 16 完成，E41–E45 全部交付 (PRs #61–#65) (#66)([538ae9f](https://github.com/cloud-f1/ai-coding-template/commit/538ae9f46cac30647b73f75ba3dd3a15b38d7b97))
- 標記 Phase 14 完成，新增 Stripe API 版本鎖定與 upgrade-stripe 技能([1e7026d](https://github.com/cloud-f1/ai-coding-template/commit/1e7026d55cf34c69358661ae2a11c585bdff8413))
- 標記 Phase 12 完成，E32–E33 全部交付 (PRs #52–#53)([2fb9f17](https://github.com/cloud-f1/ai-coding-template/commit/2fb9f179edf55279bdfc27831353cc65c87368ec))
- 全面更新文件反映 E22–E31 通用模板轉型([9e2ac68](https://github.com/cloud-f1/ai-coding-template/commit/9e2ac68afabba40580b71a58a2b76e46e3595495))
- 更新 EPIC_INDEX 標記 E31 完成，Phase 8-11 全部交付([ed0cc4c](https://github.com/cloud-f1/ai-coding-template/commit/ed0cc4c7d2b153834958958bb496e8ec5ee29b59))
- Domain Agent Pattern — custom agent guide + templates (#50) **(E30)** ([4a853d0](https://github.com/cloud-f1/ai-coding-template/commit/4a853d07905e5a137c38851586ac8d3fdaab3b25))
- Example Domain Showcase — blog, CRM, todo worked examples (#48) **(E28)** ([5047721](https://github.com/cloud-f1/ai-coding-template/commit/504772166448b0e5c11bbf1cd9db3d26184018e7))
- Architecture Diagrams — 6 Mermaid diagrams for system overview (#47) **(E27)** ([7f8cb08](https://github.com/cloud-f1/ai-coding-template/commit/7f8cb088e0383ff52c70e122e7aa80e46c21c0b1))
- 更新 EPIC_INDEX 標記 E26 完成，Phase 9 交付([20a16ee](https://github.com/cloud-f1/ai-coding-template/commit/20a16ee18b8fb07e9a6286d8dab34a1c798ddd84))
- 更新 EPIC_INDEX 標記 E25 完成([1aa81e8](https://github.com/cloud-f1/ai-coding-template/commit/1aa81e8877145db341213c6f855c6880dbbadaec))
- 更新 EPIC_INDEX 標記 E24 完成([57d050a](https://github.com/cloud-f1/ai-coding-template/commit/57d050a99b94c82351fbb6e5239aa472e4c14f5c))
- 更新 EPIC_INDEX 標記 E23 完成，Phase 8 交付([2001099](https://github.com/cloud-f1/ai-coding-template/commit/20010990b7db8c29ffaabe981d907731609f0769))
- checkpoint session — Phase 5 done, Phase 6 approved([167263d](https://github.com/cloud-f1/ai-coding-template/commit/167263d97039dc5e21af26c68417ffaf82f6cc20))
- approve @strategist Cycle 1 — Phase 6 (E16-E20)([a9ef23f](https://github.com/cloud-f1/ai-coding-template/commit/a9ef23fec59d1710f99274bff810505c290dd3db))
- @strategist cycle 1 — auto analysis with 5 epic proposals([8d75f40](https://github.com/cloud-f1/ai-coding-template/commit/8d75f404c37115327a3886d18826671cf619462a))
- 更新 EPIC_INDEX 標記 Phase 5 完成 (E12-E15)([cbcbdcd](https://github.com/cloud-f1/ai-coding-template/commit/cbcbdcd10cb94fc8ad278969f5bcb32a9ec103ca))
- 更新 EPIC_INDEX 標記 E11 完成，全部里程碑交付([d72bd16](https://github.com/cloud-f1/ai-coding-template/commit/d72bd16b8110a235a3caa16ad7223cae7699e8ad))
- add full English section to README([910aecb](https://github.com/cloud-f1/ai-coding-template/commit/910aecbe25a715f0ee78ea7cd8054150dba1c224))

### Features

- Visual README & Onboarding Discovery — screenshots, getting-started links, cleanup fix (#68) **(E46)** ([1153e4d](https://github.com/cloud-f1/ai-coding-template/commit/1153e4d119bce4e4a4edaf0f45688679aa5d2263))
- Guided First-Run Experience — tutorial, getting-started page, domain wrapper (#65) **(E44)** ([4fc6aa1](https://github.com/cloud-f1/ai-coding-template/commit/4fc6aa12edac6de4a71f99490914529ac7623c3b))
- Bilingual Developer Docs — EN/ZH guide translations + directory restructure (#64) **(E43)** ([39ab128](https://github.com/cloud-f1/ai-coding-template/commit/39ab128557a850651e4b4f42656e044e28dec31c))
- README Rewrite for Beginners — 450→186 lines, progressive disclosure (#63) **(E42)** ([17eb104](https://github.com/cloud-f1/ai-coding-template/commit/17eb1049eb4fa9eba38861746697c93b0b1273ce))
- Env Validation & Smart Defaults — make doctor, generate-env, startup guards (#62) **(E45)** ([997e321](https://github.com/cloud-f1/ai-coding-template/commit/997e32177223d4846bafdc2152a646d53cd81bf9))
- Zero-Config Dev Startup — make go, prereq checker, Docker dev profile (#61) **(E41)** ([8d7516a](https://github.com/cloud-f1/ai-coding-template/commit/8d7516a98417e5efb93299bd835fad054180b6a4))
- Zeabur One-Click Template — Dockerfile, GHCR CI, template YAML (#60) **(E40)** ([39976e8](https://github.com/cloud-f1/ai-coding-template/commit/39976e84d38e05d9328a86dce03a45baa29c4e15))
- 1M Context Adaptation — SessionStart expansion, agent preloading, memory budget upgrade (#59) **(E39)** ([84a67d3](https://github.com/cloud-f1/ai-coding-template/commit/84a67d3db08dedbc39f3a346d5888260b39fdc05))
- i18n Framework — react-i18next + server message keys (#57) **(E37)** ([06de5b0](https://github.com/cloud-f1/ai-coding-template/commit/06de5b0ca51aa593e78184c81abca3e96e48b2ff))
- Stripe Billing Integration — checkout, portal, webhooks, feature gates (#56) **(E36)** ([74fce41](https://github.com/cloud-f1/ai-coding-template/commit/74fce41c75cd834443f08f9736b8b1a1cd4cafbc))
- RBAC & Team Scoping — roles, teams, ownership checks (#55) **(E35)** ([0c29b32](https://github.com/cloud-f1/ai-coding-template/commit/0c29b32e11540b5f0b093d910ee212f395e27f11))
- Template Hygiene — parameterize all domain remnants (#54) **(E34)** ([8c2aa83](https://github.com/cloud-f1/ai-coding-template/commit/8c2aa83e0bd425b422035ce1fc58c087c21d5eb6))
- System Learning & Validation — QA feedback loop, memory GC, smoke test (#53) **(E33)** ([b8049d3](https://github.com/cloud-f1/ai-coding-template/commit/b8049d3f1c35ee03e2e901187160e65e9f1443e7))
- Pipeline Friction Fixes — guard regex, session trim, stash-free merge, epic archive (#52) **(E32)** ([ed9a760](https://github.com/cloud-f1/ai-coding-template/commit/ed9a7608d13443cf38089fe1845350845acce66c))
- 新增 Phase 12 — E32 Pipeline Friction Fixes + E33 System Learning([007f5be](https://github.com/cloud-f1/ai-coding-template/commit/007f5be258bf8c93e848da9b527e8bc1f561a08f))
- GitHub Template Distribution — cleanup script, README, contributing (#51) **(E31)** ([c7597a2](https://github.com/cloud-f1/ai-coding-template/commit/c7597a20f2c17bbc52c71fea093d58fd31e8b8ee))
- CLAUDE.md + TECHSTACK.md Templating — domain-neutral scaffold (#49) **(E29)** ([161db4c](https://github.com/cloud-f1/ai-coding-template/commit/161db4c732846541514bfe0ad4d00b01813eba28))
- Interactive Onboarding CLI — --tutorial flag + checklist (#46) **(E26)** ([96cf7a0](https://github.com/cloud-f1/ai-coding-template/commit/96cf7a0fe206a3cf903498f4f38a93bf58c9b461))
- OpenAPI Spec Templates — copy-paste patterns + CRUD template (#45) **(E25)** ([ad7d0eb](https://github.com/cloud-f1/ai-coding-template/commit/ad7d0ebeeb29dcf05a7d6d863b81450bccd27c22))
- Quickstart Guide + First Epic Walkthrough (#44) **(E24)** ([6461b6e](https://github.com/cloud-f1/ai-coding-template/commit/6461b6ec4bcfe709679ff5397552fda2dde03eef))
- Starter Domain Generator — /athena:domain command + templates (#43) **(E23)** ([92ab9f0](https://github.com/cloud-f1/ai-coding-template/commit/92ab9f03e6785241fd8e1cbfe6e1d803bc1484c6))
- Clean Do-Separation — registry pattern for pluggable features (#42) **(E22)** ([ec31f9b](https://github.com/cloud-f1/ai-coding-template/commit/ec31f9b10135d752819364a79c12f1c404314007))
- Interactive Site Builder CLI — @clack/prompts wizard (#41) **(E21)** ([f5c2d94](https://github.com/cloud-f1/ai-coding-template/commit/f5c2d940d17222832bb61507a4310cfe3ff0bba6))
- Accessibility (WCAG 2.1 AA) — ARIA landmarks, skip-nav, focus management (#40) **(E20)** ([a6b46cd](https://github.com/cloud-f1/ai-coding-template/commit/a6b46cde14dee141de9a98b83c916b01be1382ab))
- Domain UI — Places & Portfolio pages with Recharts (#39) **(E18)** ([657eb0c](https://github.com/cloud-f1/ai-coding-template/commit/657eb0c7842722fe4aa17ab760f9f66889998f77))
- Session Cleanup & Observability — structured logging + correlation IDs (#38) **(E19)** ([4d764e9](https://github.com/cloud-f1/ai-coding-template/commit/4d764e9fc444149b1f14545073ac2a42acd333d5))
- Financial Data Integrity — Float to Numeric(12,2) migration (#37) **(E17)** ([9f97a8f](https://github.com/cloud-f1/ai-coding-template/commit/9f97a8fe02ced984ab427cd84d179d9c42178f9e))
- Security Hardening — rate limits, headers, audit logging (#36) **(E16)** ([6576056](https://github.com/cloud-f1/ai-coding-template/commit/6576056aec7fdbd1bfa11ef6d61d92c3df5d3f48))
- Phase 5 — Agent Evolution & Quality (#35) **(E12-E15)** ([fe4571f](https://github.com/cloud-f1/ai-coding-template/commit/fe4571faf5b91b6b4faffcedd1acd9ad7eb0866b))
- split openapi.yaml into domain-based modules (#34) **(E11)** ([cc92c9b](https://github.com/cloud-f1/ai-coding-template/commit/cc92c9b4f25959e607acef8cab884ec40565074d))
- Landing + SEO — theme preview, robots.txt, sitemap (#33) **(E10)** ([b601296](https://github.com/cloud-f1/ai-coding-template/commit/b6012969d5303e09ddf0a514b06777ae875e5fdf))
- Production Deploy — Sentry + config hardening (#32) **(E9)** ([a325eab](https://github.com/cloud-f1/ai-coding-template/commit/a325eaba69fd25aa3b7cb9e82e12a8e627e2d575))
- Portfolio System — CRUD + M2M membership + analytics (#31) **(E8)** ([25bcc69](https://github.com/cloud-f1/ai-coding-template/commit/25bcc6962c70d327476296eadef786b559a64459))
- Places CRUD + 空間查詢 — 6 端點 + Haversine nearby (#30) **(E7)** ([bb8a9e5](https://github.com/cloud-f1/ai-coding-template/commit/bb8a9e5597cd9eb2a26cb1cc3aa5241ca15c237e))
- Playwright E2E Auth Tests (#29) **(E6)** ([6aaf2a0](https://github.com/cloud-f1/ai-coding-template/commit/6aaf2a0d09e0da486ec5d4ceab3fb28519ffefe4))
- 伺服器端 Session 管理 — token 追蹤與裝置管理 (#28) **(E5)** ([1d6b6c9](https://github.com/cloud-f1/ai-coding-template/commit/1d6b6c9d4b39106b08585b7d9553cb10e95ddce5))
- Email + OAuth Live (#27) **(E4)** ([6e9e3bc](https://github.com/cloud-f1/ai-coding-template/commit/6e9e3bc72490d9277218f8a85ebe920de5d78b34))
- DashboardLayout + 元件提取 + HTML 藍圖 **(E3)** ([7c815e0](https://github.com/cloud-f1/ai-coding-template/commit/7c815e09d5656604d7faa6916cdd183a85de9809))
- 驗證 agent 指令 + 修復 Makefile lint target **(E2)** ([a6ed744](https://github.com/cloud-f1/ai-coding-template/commit/a6ed744d08ebed10e27c0895e0f4a39bc7c5e4cc))
- 主題系統 — 4 主題 + ThemeProvider + 設定頁選擇器 **(E1)** ([f11ebb8](https://github.com/cloud-f1/ai-coding-template/commit/f11ebb890c8e457fa9434778122130d1d975f68f))
- 導入 Epic 驅動開發流程與三個新 athena 指令([118503c](https://github.com/cloud-f1/ai-coding-template/commit/118503c41154d6f1a6d83531e3c7c6c364c8ae94))

### Other

- add GettingStartedPage tests to fix branch coverage gate (77% → 81%) (#67)([4106006](https://github.com/cloud-f1/ai-coding-template/commit/4106006e3cb7c46a1b7086e38a911bb500e1527d))

## 0.9.0 — 2026-03-09

### Bug Fixes

- remove PR coverage comment notifications **(ci)** ([0d2ba7c](https://github.com/cloud-f1/ai-coding-template/commit/0d2ba7ce8c827ba0dd6a05c49829a8e8b317c32d))
- regenerate types.ts to match openapi.yaml refresh token spec **(client)** ([298f8bf](https://github.com/cloud-f1/ai-coding-template/commit/298f8bf14b511c28cd84cf5a9b9926b9a340a14c))
- update DEVELOPER_DOCS deploy section to match 2-job CI **(docs)** ([fcc0c38](https://github.com/cloud-f1/ai-coding-template/commit/fcc0c38a741b437d71c206c490694988df25fcfb))
- add pull-requests write permission for coverage comments **(ci)** ([c34ee7e](https://github.com/cloud-f1/ai-coding-template/commit/c34ee7ecd2cbd80fe4de277df7b201e305b33604))

### Documentation

- update README description to Full-stack Coding Template([5b2af4e](https://github.com/cloud-f1/ai-coding-template/commit/5b2af4e18188b8188976fc657b49d1d942792223))
- add v0.9.0 tag and regenerate changelog([adfd8f1](https://github.com/cloud-f1/ai-coding-template/commit/adfd8f126115fc04ae2ceed573f6b307c0dbf9cc))
- update session activity timestamp([347399d](https://github.com/cloud-f1/ai-coding-template/commit/347399da603579c4a4353544fcf81ffdbf69a306))
- redesign README with badges, nav links, and Traditional Chinese([5345e7c](https://github.com/cloud-f1/ai-coding-template/commit/5345e7c8b65bd62c1c533ba5bd97e2232a3d6c0a))
- add pre-release checklist for manual deployment tasks([f17df1f](https://github.com/cloud-f1/ai-coding-template/commit/f17df1fca16e318056e60d03ffd03d3d9e6c768d))
- add v0.7.0 + v0.8.0 tags and regenerate changelog([77b11ff](https://github.com/cloud-f1/ai-coding-template/commit/77b11ff6eb8f7fd68b8e0c4d1e30a041d128361a))

### Features

- enhance skills, agents, and README for better triggering and accuracy([c43a472](https://github.com/cloud-f1/ai-coding-template/commit/c43a472a87a8f0a5b4dc3307b941ad4744be5533))
- add roadmap & checklist, remove GitHub OAuth (Google only)([82525fa](https://github.com/cloud-f1/ai-coding-template/commit/82525fab498971a9da25c37e7d62f1ef456a167f))
- pre-release security hardening, refresh tokens, 404 page([f7fb0d5](https://github.com/cloud-f1/ai-coding-template/commit/f7fb0d52fa48059170ef4627baeeecf3d95a2f9b))

### Other

- add smoke tests for DashboardPage, LandingPage, and SocialButtons **(client)** ([3e39e5e](https://github.com/cloud-f1/ai-coding-template/commit/3e39e5e64df3453e19a0c3ee3a5614f9427db662))

### Refactor

- merge 3 jobs into 2, stop running on every branch push **(ci)** ([fe62b0c](https://github.com/cloud-f1/ai-coding-template/commit/fe62b0cb3f47c06828c0628c6e6ff4c38ef2fe4e))

## 0.8.0 — 2026-03-08

### Bug Fixes

- TS type errors in TEST_USER, update DEVELOPER_DOCS for v0.7.0([c9c9958](https://github.com/cloud-f1/ai-coding-template/commit/c9c995872603a96dd8bbc41b7810e84f26124e39))
- CI pipeline errors and code review cleanup([bc160ee](https://github.com/cloud-f1/ai-coding-template/commit/bc160ee938b8a6c713e95b306f29d531663070f4))

### Features

- add CI pipeline, error boundary, E2E tests, and DX tooling([175cc5a](https://github.com/cloud-f1/ai-coding-template/commit/175cc5a17f048c2674416e65d76e4efbc91f5d8e))
- add service layer with Zod+OpenAPI type bridge and factory patterns **(client)** ([0f304a0](https://github.com/cloud-f1/ai-coding-template/commit/0f304a013f43f75660ff17bc344abbbc7dfe410c))

### Refactor

- extract extractApiDetail utility, code review fixes([814a9bd](https://github.com/cloud-f1/ai-coding-template/commit/814a9bd8cd3afe8e538b4daa6226263830189bbe))

## 0.7.0 — 2026-03-08

### Bug Fixes

- improve dev-docs contrast, align sidebar order, bump rate limit([4b7a24a](https://github.com/cloud-f1/ai-coding-template/commit/4b7a24a12620fa4af996aed02516e4450412a0db))

### Other

- add comprehensive unit test coverage for backend and frontend([541b089](https://github.com/cloud-f1/ai-coding-template/commit/541b089e7b1cd5c46cfe6783e1c47522f2fc8033))

## 0.6.0 — 2026-03-07

### Bug Fixes

- update stale auth-pages.html path references to design/ **(docs)** ([888298c](https://github.com/cloud-f1/ai-coding-template/commit/888298cf3f6980303b703153373a7d9ed0f9a291))
- correct pnpm workspace filter names in root package.json([05f97d6](https://github.com/cloud-f1/ai-coding-template/commit/05f97d6b52a7dd8dd3e9c5c4aec5bf6db9c38648))
- add favicon.ico to resolve browser 404 **(client)** ([656018d](https://github.com/cloud-f1/ai-coding-template/commit/656018d56fa8ab473709709cb54b2c1e1052a3f8))
- make Legal.css self-contained with all design tokens **(client)** ([1aa5b9f](https://github.com/cloud-f1/ai-coding-template/commit/1aa5b9ff16896163820a7f58e2e909e6a552394b))
- resolve 3 issues from code review([3285677](https://github.com/cloud-f1/ai-coding-template/commit/3285677b378156cceab36fabf84b327e43f5ba99))
- align HTML reference files with 8→6 agent consolidation **(docs)** ([9b3bd81](https://github.com/cloud-f1/ai-coding-template/commit/9b3bd81fd51d96a8609e80b7e6c2c6cebef2c94c))
- resolve Makefile merge conflict, add setup-dev-docs target([8d1c226](https://github.com/cloud-f1/ai-coding-template/commit/8d1c2261e0a902763e5d1d5885ab1adbbd1f57e6))
- code review fixes — NaN guard, a11y, stale refs **(dev-docs)** ([3e7d913](https://github.com/cloud-f1/ai-coding-template/commit/3e7d91364bf54772cae2276d9a1e6d0527f44815))
- align landing page with 8→6 agent consolidation **(dev-docs)** ([a7087c4](https://github.com/cloud-f1/ai-coding-template/commit/a7087c4394d3ad8726a893abf5b22995d6e2c5da))

### Chore

- add package-lock.json **(dev-docs)** ([ac8427c](https://github.com/cloud-f1/ai-coding-template/commit/ac8427caac88c1e255d7ef951846df39565bc700))

### Documentation

- sync inline changelog in DEVELOPER_DOCS with v0.5.0 and v0.6.0([907b44a](https://github.com/cloud-f1/ai-coding-template/commit/907b44a2d8f1de6e98332331cced5f482857322c))
- generate changelog for v0.6.0([e1a9d93](https://github.com/cloud-f1/ai-coding-template/commit/e1a9d93cb6e4da5dadb59fbff92809209076b141))
- update session-summary activity timestamps([9a84d93](https://github.com/cloud-f1/ai-coding-template/commit/9a84d9363cbfc03359c6d097aa8faedacd1bfa8c))
- 新增隱私權政策、服務條款頁面與 logo v2([c3bdab7](https://github.com/cloud-f1/ai-coding-template/commit/c3bdab7e6dc071c50ef3dcd19a58e30c20617a69))
- 同步先前未提交的文件修改（README、landing page、dev-guide）([c2d2cf8](https://github.com/cloud-f1/ai-coding-template/commit/c2d2cf82d676bb577c3eccd35fc665530a5e9780))
- update session summary and add auth pages reference([08dc3d9](https://github.com/cloud-f1/ai-coding-template/commit/08dc3d9e138a27e5bc6533c4d5f472a41cb43932))
- track generated HTML docs in repository([2128898](https://github.com/cloud-f1/ai-coding-template/commit/21288984ed20d89dfa169c7b3d515ee25f822290))

### Features

- add frontend a11y checks to QA agent and review skill **(agents)** ([6e5ab8a](https://github.com/cloud-f1/ai-coding-template/commit/6e5ab8afb8c94fb9efedb33dcf393684873cf88d))
- add full dashboard layout with protected route and CSS refactor **(client)** ([5b52a89](https://github.com/cloud-f1/ai-coding-template/commit/5b52a8903cf705b3f2c47a2767f89b5c5f253551))
- add privacy policy, terms of service pages with logo v2 and SEO **(client)** ([69ec26a](https://github.com/cloud-f1/ai-coding-template/commit/69ec26a4224731e3f7406bf5375b90c3d90d5336))
- add /pr command — pre-PR pipeline with 6 gates **(agent)** ([8e8c283](https://github.com/cloud-f1/ai-coding-template/commit/8e8c2835c013a137798a7b32032a67b8955638c2))
- migrate to pnpm workspace monorepo([8acb831](https://github.com/cloud-f1/ai-coding-template/commit/8acb831f64245b0d5769fac95bc2056ab6452a70))
- add build-web.sh for combined client + docs build **(scripts)** ([8cbb017](https://github.com/cloud-f1/ai-coding-template/commit/8cbb01701a5530ff0421530e9d457ed7656a3d42))
- build-time merge dev-docs into client at /docs **(docs)** ([9d01d10](https://github.com/cloud-f1/ai-coding-template/commit/9d01d109beb2536d5cd61604fca32fa6fbeeee03))
- 新增 dashboard v2 靜態頁面 **(docs)** ([d4270e7](https://github.com/cloud-f1/ai-coding-template/commit/d4270e738ffbe037f91e5f90cb03abe30611bc64))
- add dashboard, test accounts, full-screen auth, and nav links **(client)** ([46616a6](https://github.com/cloud-f1/ai-coding-template/commit/46616a6ed85482e176526ab5936457ad1544e30c))
- add auth pages with adapter pattern and code review fixes **(client)** ([7c44b63](https://github.com/cloud-f1/ai-coding-template/commit/7c44b63b0e85f1ef7f5ab142f827f35015a7a1ea))
- match docs site to dev-guide.html reference **(dev-docs)** ([9b18ef0](https://github.com/cloud-f1/ai-coding-template/commit/9b18ef0859aa495da98dc5cc2217c6057bd6a394))
- migrate auth to fastapi-users with stateless JWT([b1d3548](https://github.com/cloud-f1/ai-coding-template/commit/b1d35489c0355a3d0e5a82b2a83af6b809c30ede))
- migrate design system from purple/Syne to amber/Archivo **(ui)** ([0d81a8e](https://github.com/cloud-f1/ai-coding-template/commit/0d81a8e78e51c5f92b7e2ef5d25dc328bc9ddf93))
- add landing page, align design to dev-guide, fix hook path resolution([c87ec3f](https://github.com/cloud-f1/ai-coding-template/commit/c87ec3fa6192777c28dc81f36cb921b2e7fb4dcc))
- add Makefile, align client Vite to v7, harden hook exit validation([6c2f020](https://github.com/cloud-f1/ai-coding-template/commit/6c2f020ff13872520a769966b32d92ce8dab9a47))
- add Makefile, uv project, health router, fix config parsing **(server)** ([ba6c29c](https://github.com/cloud-f1/ai-coding-template/commit/ba6c29c366df0235df40628859b73dec1a6b137a))

### Other

- add GitHub Pages deployment for dev-docs **(docs)** ([2935ea5](https://github.com/cloud-f1/ai-coding-template/commit/2935ea5fc5eecb72196303f0c983300ab0b8c2b9))
- lazy-load MarkdownContent and LandingPage **(dev-docs)** ([83a155e](https://github.com/cloud-f1/ai-coding-template/commit/83a155e0faf87c957e97f8b2bdd132b6557b23e4))

### Refactor

- reorganize docs folder structure **(docs)** ([5b98704](https://github.com/cloud-f1/ai-coding-template/commit/5b98704e4da5960dbd8fb43dbe932d34175ef70c))
- optimize Docker setup for smaller images and faster builds([f5108ce](https://github.com/cloud-f1/ai-coding-template/commit/f5108ce6b33dc5199e9d2377e404d512cc11e065))
- mailhog→mailpit, downgrade memory-curator to sonnet, fix hook refs([ed06614](https://github.com/cloud-f1/ai-coding-template/commit/ed066148cb9e008e3adc1855fc2f3244b8868e9a))
- namespace commands under athena, merge review+test into qa([31f7163](https://github.com/cloud-f1/ai-coding-template/commit/31f7163c07409e8d19834b757280a56362255c3c))
- 拆分大型文件至子目錄，統一上下文控制 **(docs)** ([b0d272a](https://github.com/cloud-f1/ai-coding-template/commit/b0d272af29ed45e9c52681aabd8363de47e05792))

## 0.5.0 — 2026-03-06

### Documentation

- update dev-guide, dev-docs, and add auto-generated changelog([68f4517](https://github.com/cloud-f1/ai-coding-template/commit/68f4517b713ee22dd68577b460f7b401fda05a45))

### Features

- add Docker support with pnpm **(dev-docs)** ([5518654](https://github.com/cloud-f1/ai-coding-template/commit/5518654aeff6d56c97ead2229fc04820d62c27fd))
- add landing page with 7 sections, vitest setup, and tests **(dev-docs)** ([92f4ff8](https://github.com/cloud-f1/ai-coding-template/commit/92f4ff89ca62392ef68cf9f4202e75a6e5147f0f))

### Refactor

- consolidate agents 8→6, fix auth bugs, remove doc duplication([477346d](https://github.com/cloud-f1/ai-coding-template/commit/477346ddb25310de0168b80ad781579cd4122714))

## 0.4.0 — 2026-03-06

### Documentation

- add landing page content source (Markdown)([44eacee](https://github.com/cloud-f1/ai-coding-template/commit/44eacee30aa1d8ffafdce21fb70a890d870f6dd5))

### Refactor

- switch package manager from npm to pnpm **(client)** ([3d0cfab](https://github.com/cloud-f1/ai-coding-template/commit/3d0cfabc7fc8b984ac8e1938d633c6d8c9bc0f62))
- 拆分大型文件至子目錄，統一上下文控制 **(docs)** ([45f48aa](https://github.com/cloud-f1/ai-coding-template/commit/45f48aa3820326cad499812186fec2efbe417ee0))

## 0.3.0 — 2026-03-06

### Features

- standalone React + Vite documentation site **(dev-docs)** ([9be8774](https://github.com/cloud-f1/ai-coding-template/commit/9be8774c1bfbead6e26f11bfd4caffa8670f5b66))

## 0.2.0 — 2026-03-06

### Documentation

- 新增開發者文件 (Markdown + HTML)([0eec3ae](https://github.com/cloud-f1/ai-coding-template/commit/0eec3ae62e793d48b5a1028cdef4907c0a3bf6e7))

### Features

- env-var driven docker-compose with profile-based dev/prod switch([88bb163](https://github.com/cloud-f1/ai-coding-template/commit/88bb163f4f8e5ad36fb263b3312c6623ea1b1809))

## 0.1.0 — 2026-03-06

### Bug Fixes

- 修正 bash 3.2 相容性與 OpenAPI 3.1 nullable 語法 **(hooks)** ([c923f42](https://github.com/cloud-f1/ai-coding-template/commit/c923f4234448d09bfa5321a3b85ee060c242d87d))
- 修正 14 項 hook/agent/command/openapi 驗證問題 **(pipeline)** ([6eb7bb7](https://github.com/cloud-f1/ai-coding-template/commit/6eb7bb7a39a62b25316b58d69b9862e512c420e9))
- security hardening + code review auto-fixes([20aac8a](https://github.com/cloud-f1/ai-coding-template/commit/20aac8a971678b14a145c981cdb86ff4690948df))

### Chore

- update context docs timestamps([ee59f47](https://github.com/cloud-f1/ai-coding-template/commit/ee59f47ef1499f156bfeee962d4af0aaa49ac54a))
- gitignore Claude runtime artifacts([88c23e7](https://github.com/cloud-f1/ai-coding-template/commit/88c23e7054ebc3f4de35ee89e7182d8867eec16a))

### Features

- 更新 CLAUDE.md 與新增子目錄記憶控制文件 **(docs)** ([04184c3](https://github.com/cloud-f1/ai-coding-template/commit/04184c38d2ddc96f076ec16cde26ca427c4a8338))
- add rate limiting, mail service, session cleanup, fix Vite types([2d585a8](https://github.com/cloud-f1/ai-coding-template/commit/2d585a8cca83630729905925afef21244cb3366e))
- implement auth & identity core with full Pydantic/Zod compliance([0326341](https://github.com/cloud-f1/ai-coding-template/commit/032634154376cae7255be221239494a14231346b))

---

> See [roadmap.md](../roadmap.md) for the full product roadmap.
