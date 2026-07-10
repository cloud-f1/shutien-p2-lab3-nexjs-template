---
name: user-guide-builder
description: >
  Build (or refresh) a screenshot-backed, domain-accurate end-user manual for this app
  and publish it as the VitePress dev-docs site. Use when the user asks to "write the user
  guide", "document every page/feature for users", "screenshot the app and explain each
  item", "make dev-docs user-facing", or audit docs for audience fit. Teaches the pipeline:
  audience-audit (split user docs from engineer docs) → boot the real app → Playwright
  logged-in tour for per-item screenshots → mine epics into a domain digest → grounded
  per-page writers → verify anchors → redeploy. Pairs with gh-cf-deploy (publish),
  alignment-audit (coverage), and the rebrand skill (identity).
user-invocable: true
---

# User-Guide Builder — screenshot-backed, domain-accurate end-user manual

A good user manual is **grounded in two sources at once**: the *running app* (what each
control actually is) and the *domain spec* (why it behaves that way). Screenshots without
the domain rules are a photo album; rules without screenshots are a spec. This skill wires
both into every page so the manual documents **every item (每個項次)** truthfully — not a
vague "recipe". (The dev-docs site `dev-docs/` is the documentation host; the user-facing
manual root is typically `/guide-zh/` or `/guide/` depending on your fork's language target.)

## 0. Audience audit first (don't document the wrong thing)

Before writing, split the published site into **user-facing** vs **engineer-facing**:

- Engineer content (`/docs/` getting-started/testing/deployment, `/api/` reference, Claude
  Code workflow guides) does NOT belong in an end-user manual. Keep it in the repo for
  maintainers but exclude it from the published build: VitePress `srcExclude: ['docs/**',
  'api/**','README.md']` in `.vitepress/config.mts`, and drop those entries from `nav` +
  `sidebar`. Repoint any hero/whitepaper links that pointed at the excluded pages.
- A page is user-facing only if a non-technical end user would act on it. When unsure, ask.
- **Redirect the removed paths, don't just 404 them.** A bookmarked or already-edge-cached
  `/docs/...` URL should land somewhere useful. Add `dev-docs/public/_redirects` (VitePress
  copies `public/` to the dist root where Cloudflare Pages reads it):
  ```
  /docs/*   /guide-zh/   301
  /api/*    /guide-zh/   301
  ```
  This is the durable fix for the edge-cache staleness in §7 — every uncached/post-expiry
  request gets a clean 301 to the manual instead of a 404 or a stale 200.

Note: by default the template's `dev-docs/` is **engineer-facing only**. The `srcExclude`
pattern above is commented out in `dev-docs/.vitepress/config.mts` — activate it only when
your fork pivots the site to end-user documentation.

## 1. Boot the real app (screenshots need live data)

```bash
docker compose up --build -d   # Next.js :3000 + PostgreSQL + Mailpit :8025
cd next-app && pnpm db:migrate && pnpm db:seed
```

Verify `:3000` responds and the seed printed the three demo logins:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `Admin123!` |
| Editor | `editor@example.com` | `Editor123!` |
| Viewer | `viewer@example.com` | `Viewer123!` |

**Gotchas:**
- Leftover containers from a prior session cause name conflicts — if `docker ps` shows the
  containers already **healthy**, skip `docker compose up` and just run `pnpm db:seed`.
- Migrate the dev DB to HEAD or new-column reads will return 500 (dev-DB-drift trap).
- This template uses **email+password login** (not badge/工牌). The login form has
  `input[name="email"]` and `input[name="password"]` — NOT `input[name="badge"]`.

## 2. Playwright logged-in tour → per-item screenshots

Use `scripts/mockup/tour-app.cjs` (the logged-in tour script — distinct from any static HTML
mockup scripts). It logs in via email+password, walks every page → every tab → every modal,
and writes PNGs to `dev-docs/public/screenshots/`.

Run: `node scripts/mockup/tour-app.cjs`

Note: `scripts/mockup/tour-app.cjs` is added in E303. If it doesn't exist yet, create a
minimal version that: logs in as `admin@example.com`, visits each dashboard route, captures
screenshots, and exits cleanly.

**To refresh the manual after a UI change**, use the guarded wrapper
`scripts/screenshot-refresh.sh [baseURL]` (E311): it checks the app is reachable at `/login`,
re-runs the tour, then prints the `git status` diff of `dev-docs/public/screenshots/` so you
review the visual change and commit intentionally. PNG re-encode noise makes byte-diffs
chatty — `git checkout -- <png>` the shots that didn't visually change. (Pixel-true VRT is the
follow-on, already wired via `pnpm test:vrt`.)

Practices baked in:
- **Warm the routes first** (`curl` each `/dashboard*` once) — the dev server compiles
  on first hit and a cold compile races `waitForSelector`. Then `waitForSelector` the login
  field with a generous timeout (10–15 seconds).
- **Capture role variants**: shoot the same surface as admin AND as the restricted role
  (viewer sees limited navigation) — `context.clearCookies()` between logins. Plus 2 mobile
  shots (390×844).
- **Every step in try/catch** with a ✓/✗ ledger so a missing element never silently drops a
  shot. Target ~one shot per major section/tab/modal, not one per button — per-item detail
  lives in the *prose*, anchored to the section screenshot.
- **VERIFY the PNGs** by reading a few with vision before writing docs around them — confirm
  they show real seeded content, not an empty/error/login state.

## 3. Mine epics → one shared domain digest

Spawn one agent to read feature epics (`docs/epics/`) and produce a tight
**values-and-rules** cheat-sheet to `docs/reference/guide-domain-digest.md`: every threshold,
enum, permission flag, and rule with its source cited inline. This is the single source the
page writers quote, so the manual's numbers are consistent and correct.

The RBAC matrix for this template (3 tiers):
- **Admin** — full access (create/edit/delete users, all settings, all data)
- **Editor** — create/edit content; cannot manage users or system settings
- **Viewer** — read-only access to content; no create/edit/delete

## 4. Grounded per-page writers (one agent per page, in parallel)

Dispatch one writer per manual page **in a single message** (parallel; each writes a
distinct file so no worktree isolation needed). Every writer prompt MUST require it to:

1. **Read** its screenshot PNG(s) with vision, the digest, the current page, and the actual
   component source for exact labels (don't invent control names).
2. Write **繁中 or your target language, task-oriented, for non-technical users** — no
   code/CLI. Embed the screenshot(s) `![alt](/screenshots/NN-name.png)`, use
   `::: tip/warning/info` containers.
3. Document **every visible item** (each card/button/field/filter/chip/column/toggle)
   = what it is · what it does · who can use it (role notes from the RBAC digest).
4. Add "為什麼" callouts from the digest, and **cross-link** to the concepts page for rules.

Keep tone/structure consistent by pasting this **house-style block** into every writer prompt:

> 繁體中文、口語、寫給非技術同仁（管理員／編輯員／檢視者），不是工程師 — 不要程式碼或
> 指令。嵌入截圖 `![說明](/screenshots/NN-name.png)`，善用 `::: tip / ::: warning / ::: info`。
> **逐項說明（每個項次）**：畫面上每個卡片／按鈕／欄位／篩選／標籤／欄位／燈號／切換 = 這是什麼 ·
> 做什麼 · 誰能用（角色限制引用權限矩陣）。加「為什麼這樣設計」的 callout，並交叉連結到領域概念頁。
> **不要**說資料過期或強調這是演示資料。只記錄畫面實際存在的控制項，不得杜撰。

Tell each writer the exact screenshot filenames available to it and the source component path —
agents that aren't handed the file list invent plausible-but-wrong control names.

## 5. The concepts page = the digest, humanized

One page (e.g. `concepts.md`) renders the digest into friendly prose + tables and owns the
**stable H2 anchors** every other page deep-links to. Give that writer the exact H2 titles
to use verbatim, because…

## 6. Verify cross-page anchors — automated (the gotcha)

VitePress fails the build on dead *page* links but does NOT validate cross-page **#fragment**
anchors — so a `concepts#wrong-anchor` link builds green and 404s the jump at runtime.

**Run the deterministic check (E311) instead of eyeballing it:**
```bash
node scripts/docs/anchor-check.cjs        # also wired into scripts/smoke.sh
```
It parses every `dev-docs/**/*.md`, resolves each `page#fragment` link's target headings
(VitePress slugify — lowercase latin, spaces→`-`, strip punctuation, keep CJK; honors explicit
`{#custom-id}` anchors), and also verifies referenced local image assets resolve under
`dev-docs/public/`. Exit non-zero = a dead anchor/asset. **Gotcha it catches:** a heading like
`## Account Actions (\`@saas/account\`)` slugifies to `account-actions-saasaccount` — so a
`#account-actions` link is dead; fix by adding an explicit `{#account-actions}` to the heading,
or point the link at the real slug. Run it before every deploy (smoke runs it for you).

## 7. Build + redeploy + verify

`cd dev-docs && pnpm build` (clean = no dead page links), then publish via the **gh-cf-deploy**
skill (Cloudflare Pages, env token — never `wrangler login`). If `gh-cf-deploy` is unavailable
(fresh fork), deploy dev-docs via `.github/workflows/deploy-dev-docs.yml` instead. Verify prod
200 + read a screenshot-heavy page's HTML to confirm `/screenshots/*.png` resolve (not a stale
edge cache).
Verify on the **fresh deployment hash URL** (`https://<hash>.<proj>.pages.dev`) — the prod
alias can return a cached 200 for a path the new build 404s. Cloudflare's `s-maxage` means a
removed/changed path can serve **stale from the edge** for up to its TTL, and `*.pages.dev` is
Cloudflare-managed — you cannot API-purge its edge cache. Don't chase a purge; rely on
checking the hash URL for ground truth plus the redirect + TTL expiry for everyone else. The
`_redirects` rule from §0 is what makes removed-path staleness harmless in the meantime (the
long tail 301s to the manual instead of a stale 200 or a 404).

## Reusable assets

| Asset | Path |
|---|---|
| logged-in tour (per-item screenshots) | `scripts/mockup/tour-app.cjs` |
| screenshot refresh (guarded wrapper) | `scripts/screenshot-refresh.sh` |
| anchor + asset integrity check | `scripts/docs/anchor-check.cjs` (also a `scripts/smoke.sh` gate) |
| domain digest (writers' single source) | `docs/reference/guide-domain-digest.md` |
| the manual itself | `dev-docs/guide-zh/` + `dev-docs/public/screenshots/` |
| publish | `gh-cf-deploy` skill → Cloudflare Pages |

## Checklist

- [ ] Audience audit: engineer docs `srcExclude`d (if pivoting to user-facing), nav/links repointed, `_redirects` added for removed paths
- [ ] App booted + seeded (`admin@example.com / Admin123!` etc.); routes warmed
- [ ] Tour run; ledger all ✓; PNGs vision-verified as real content; role + mobile variants
- [ ] Domain digest written from epics; RBAC matrix confirmed
- [ ] One grounded writer per page (parallel); every item documented; role notes; cross-links
- [ ] Concepts page owns stable anchors; `node scripts/docs/anchor-check.cjs` passes (all `page#anchor` refs + assets resolve)
- [ ] `pnpm build` clean → redeploy → prod 200 + screenshots render
