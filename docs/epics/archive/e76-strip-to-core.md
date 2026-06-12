# E76 — Strip-to-Core Script

> **Phase**: 23 | **Size**: M (13 SP) | **Priority**: P2
> **Depends on**: none
> **Branch**: `MH/feat/E76-strip-to-core`
> **Spec status**: COMPLETE

---

## Problem Statement

Experienced developers who clone the template often want only the auth system + dashboard shell, without legal pages, landing page, getting-started page, dev-docs, bilingual guides, SEO components, or the full 4-theme system. Currently, stripping requires manually identifying and removing 20+ files across server/, client/, and docs/. No automated path exists.

## Stories

### S1: Strip Script

**AC**:
- [ ] Create `scripts/strip-to-core.sh`
- [ ] Add `make strip` target to Makefile
- [ ] Interactive confirmation prompt before destructive operations
- [ ] Strip groups (all mandatory unless noted):
  1. **Legal pages** — remove files + routes + DashboardLayout links
  2. **Landing page** — remove files + route, redirect `/` to `/signin`
  3. **Getting-started page** — remove files + route + Makefile references
  4. **Dev-docs app** — remove directory + pnpm-workspace entry + build-web.sh references
  5. **Bilingual guides** — remove docs/guides/
  6. **Example domains** — remove docs/examples/
  7. **SEO component** — (optional, prompted separately) remove Seo.tsx + all `<Seo>` usage from remaining pages
  8. **Extra themes** — (optional, prompted separately) reduce themes.css to dark-only + simplify ThemeProvider
- [ ] Updates `App.tsx` — remove imports + routes for stripped pages
- [ ] Updates `pnpm-workspace.yaml` — remove `dev-docs` entry
- [ ] Creates `.stripped-manifest.json` recording what was removed and when
- [ ] Idempotent — safe to run on already-stripped repo (checks manifest + file existence)

#### Precise File Inventory

**Group 1 — Legal pages** (5 files + code edits):
```
DELETE:
  client/src/pages/legal/PrivacyPage.tsx
  client/src/pages/legal/TermsPage.tsx
  client/src/pages/legal/LegalLayout.tsx
  client/src/pages/legal/Legal.css
  client/src/pages/legal/__tests__/LegalPages.test.tsx
  client/src/pages/legal/                    (rmdir)

EDIT App.tsx:
  - Remove: import PrivacyPage from "./pages/legal/PrivacyPage";
  - Remove: import TermsPage from "./pages/legal/TermsPage";
  - Remove: <Route path="/privacy" element={<PrivacyPage />} />
  - Remove: <Route path="/terms" element={<TermsPage />} />

EDIT client/src/components/DashboardLayout.tsx:
  - Remove the Terms of Service link block (lines ~127-134)
  - Remove the Privacy Policy link block (lines ~136-143)
```

**Group 2 — Landing page** (4 files + code edits):
```
DELETE:
  client/src/pages/LandingPage.tsx
  client/src/pages/LandingPage.css
  client/src/pages/__tests__/LandingPage.test.tsx
  client/src/tests/a11y/accessibility.test.tsx  (has LandingPage-specific tests)

EDIT App.tsx:
  - Remove: import LandingPage from "./pages/LandingPage";
  - Change: <Route path="/" element={<LandingPage />} />
       To: <Route path="/" element={<Navigate to="/signin" replace />} />
  - Add: import { Navigate } from "react-router-dom";  (if not already imported)

NOTE: accessibility.test.tsx references LandingPage in 5 test blocks.
  Strategy: remove LandingPage-specific tests from the file, keep remaining
  tests (SkipNav, App integration, DashboardLayout, form aria, NotFoundPage).
  The LandingPage import, LandingPage icon tests, and ARIA landmark tests
  for LandingPage must be removed. Other tests stay.
```

**Group 3 — Getting-started page** (3 files + code edits):
```
DELETE:
  client/src/pages/getting-started/GettingStartedPage.tsx
  client/src/pages/getting-started/GettingStarted.css
  client/src/pages/getting-started/__tests__/GettingStartedPage.test.tsx
  client/src/pages/getting-started/          (rmdir)

EDIT App.tsx:
  - Remove: import GettingStartedPage from "./pages/getting-started/GettingStartedPage";
  - Remove: <Route path="/getting-started" element={<GettingStartedPage />} />

EDIT Makefile:
  - Remove "Getting started" echo line from `go` target
  - Remove "/getting-started" echo line from `go` target
```

**Group 4 — Dev-docs app** (entire directory + config edits):
```
DELETE:
  dev-docs/                                   (rm -rf)

EDIT pnpm-workspace.yaml:
  - Remove "  - dev-docs" line (result: only "  - client")

EDIT scripts/build-web.sh:
  - Remove dev-docs merge lines (mkdir + cp commands)
  - Or: delete the entire script if it only merges dev-docs

EDIT Makefile:
  - Remove `dev-docs:` target
  - Remove `setup-dev-docs:` target
  - Remove `setup-dev-docs` from `setup:` dependency list
```

**Group 5 — Bilingual guides** (12+ files):
```
DELETE:
  docs/guides/en/ci-explained.md
  docs/guides/en/custom-agents.md
  docs/guides/en/first-epic-walkthrough.md
  docs/guides/en/openapi-patterns.md
  docs/guides/en/quickstart.md
  docs/guides/en/without-claude-code.md
  docs/guides/zh-TW/ci-explained.md
  docs/guides/zh-TW/custom-agents.md
  docs/guides/zh-TW/first-epic-walkthrough.md
  docs/guides/zh-TW/openapi-patterns.md
  docs/guides/zh-TW/quickstart.md
  docs/guides/zh-TW/without-claude-code.md
  docs/guides/custom-agents.md
  docs/guides/first-epic-walkthrough.md
  docs/guides/openapi-patterns.md
  docs/guides/quickstart.md
  docs/guides/README.md
  docs/guides/                               (rm -rf)
```

**Group 6 — Example domains**:
```
DELETE:
  docs/examples/                             (rm -rf)
  (contains: blog/, crm/, domains/, todo/, README.md)
```

**Group 7 — SEO component** (optional, 1 file + edits across 8+ files):
```
DELETE:
  client/src/components/Seo.tsx

EDIT (remove <Seo .../> usage + import from each file):
  client/src/pages/dashboard/DashboardPage.tsx
  client/src/pages/auth/SignInPage.tsx
  client/src/pages/auth/SignUpPage.tsx
  client/src/pages/auth/ForgotPasswordPage.tsx
  client/src/pages/auth/ResetPasswordPage.tsx
  client/src/pages/auth/VerifyEmailPage.tsx
  client/src/pages/NotFoundPage.tsx
  (LandingPage, PrivacyPage, TermsPage, GettingStartedPage already deleted)
```

**Group 8 — Extra themes** (optional, edits to 2 files):
```
EDIT client/src/styles/themes.css:
  - Keep only :root/[data-theme="dark"] block (lines 10-79)
  - Remove [data-theme="indigo"] block (lines 82-139)
  - Remove [data-theme="navy"] block (lines 142-199)
  - Remove [data-theme="sage"] block (lines 202-259)

EDIT client/src/components/ThemeProvider.tsx:
  - Simplify Theme type to "dark" only (or "dark" | "system")
  - Remove indigo/navy/sage from VALID_THEMES set
  - Simplify THEME_OPTIONS to only dark (+ system if kept)
  - resolveTheme: system fallback becomes "dark" only
```

**Collateral — LogoMark.tsx**:
```
LogoMark is imported ONLY by LandingPage.tsx and LegalLayout.tsx.
After Groups 1+2 are stripped, LogoMark has zero consumers.
DELETE:
  client/src/components/LogoMark.tsx
```

#### Implementation Notes

1. **Confirmation prompt**: Use `read -p "Strip optional template files? This cannot be undone. [y/N] "` with default N.
2. **Optional groups (7, 8)**: Prompt separately: "Also strip SEO component? [y/N]" and "Also strip extra themes (keep dark only)? [y/N]".
3. **sed for code edits**: Use `sed -i` (with `''` on macOS) for removing import lines and route lines from App.tsx. Use marker comments or exact line matching.
4. **Idempotency**: Before each deletion, check `[ -f path ] || [ -d path ]`. Before each sed edit, check if the target line exists with `grep -q`. If `.stripped-manifest.json` exists and lists a group as already stripped, skip it.
5. **Manifest format**:
   ```json
   {
     "stripped_at": "2026-03-20T12:00:00Z",
     "version": "1.0",
     "groups": {
       "legal": { "stripped": true, "files_removed": 5 },
       "landing": { "stripped": true, "files_removed": 4 },
       "getting-started": { "stripped": true, "files_removed": 3 },
       "dev-docs": { "stripped": true, "files_removed": 1 },
       "guides": { "stripped": true, "files_removed": 18 },
       "examples": { "stripped": true, "files_removed": 5 },
       "seo": { "stripped": false, "reason": "user_declined" },
       "extra-themes": { "stripped": false, "reason": "user_declined" }
     }
   }
   ```
6. **App.tsx route for `/`**: After landing page removal, redirect to `/signin` using `<Navigate to="/signin" replace />`. This requires adding the `Navigate` import from react-router-dom.
7. **DashboardLayout links**: The dropdown menu in DashboardLayout.tsx contains `<Link>` elements to `/terms` and `/privacy`. These must be removed when legal pages are stripped — otherwise clicking them leads to a 404.
8. **accessibility.test.tsx**: This file mixes LandingPage tests with SkipNav, DashboardLayout, and form tests. The script should remove only the LandingPage-related sections (import + 3 describe blocks referencing LandingPage), not the entire file.
9. **Makefile `go` target**: References `/getting-started` in two echo lines. Remove both.
10. **build-web.sh**: References `dev-docs` for merging into client dist. After dev-docs removal, either remove the merge lines or delete the script entirely (it only installs + builds + merges dev-docs).
11. **pnpm-lock.yaml**: After removing `dev-docs` from workspace and running `pnpm install`, the lock file auto-updates. The script should run `pnpm install` after workspace changes.

### S2: Post-Strip Verification

**AC**:
- [ ] After stripping, runs `cd client && pnpm install` to update lockfile
- [ ] Runs `cd client && pnpm build` (i.e., `tsc && vite build`) to verify no broken imports
- [ ] Runs `cd client && pnpm test -- --run` to verify remaining tests pass
- [ ] Reports summary: groups stripped, files removed count, build status, test status
- [ ] On failure: prints which step failed, leaves `.stripped-manifest.json` with partial state

#### Verification Checklist
- No dangling imports (TypeScript compiler catches these)
- No routes pointing to deleted pages
- No broken test imports
- `pnpm-workspace.yaml` is valid YAML with at least `client` entry
- `themes.css` has at least the `:root` / `[data-theme="dark"]` block

## Risk Notes

- Must update route imports in App.tsx dynamically (not just delete files)
- Must update DashboardLayout.tsx dropdown links when legal pages are stripped
- Must handle accessibility.test.tsx surgically (only remove LandingPage tests)
- Build verification catches any missed import references
- The manifest allows future "restore" functionality if needed
- Does NOT touch server code (auth + API layer stays intact)
- `sed -i` behaves differently on macOS vs Linux — use `sed -i ''` on macOS, `sed -i` on Linux. Detect platform with `uname`.
- After pnpm-workspace.yaml change, must run `pnpm install` to reconcile lockfile
