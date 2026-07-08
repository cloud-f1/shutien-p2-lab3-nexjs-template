# Manual Test Plan

> Human acceptance testing — versioned, checkbox-Markdown suites scoped to what
> automation **can't or shouldn't** cover. Companion: `../test-strategy.md` (the
> automated pyramid audit).

---

## 1. Why manual tests, given the automated pyramid?

The automated suite (unit / component / integration / e2e — see `../test-strategy.md`)
is thick at the base and now has a thin-but-real middle (E321). Manual testing is **not**
a substitute for filling automation gaps — it covers what automation structurally cannot:

| What | Automated? | Manual's job |
|---|---|---|
| Algorithm correctness (Zod validation, pricing math, usage aggregation) | ✅ unit | Don't re-test arithmetic by hand. |
| Server Action DB side-effects + RBAC guard | 🟡 integration (thin, growing) | Skip suites annotated 🤖 below — only verify the surrounding UX. |
| Component wiring (`onSuccess`, filter, disabled states) | 🟡 component (thin, growing) | Skip the wiring check; verify visual/copy correctness instead. |
| Multi-step user journey | ✅ e2e | Don't re-walk the happy path automation already walks. |
| Copy / i18n correctness, color states, RWD, dark mode | ❌ not automatable | **This is what manual testing is for.** |
| Time-dependent behavior (token expiry windows, "current month" boundaries) | ❌ e2e would be flaky by construction | **This is what manual testing is for.** |
| Cross-role UX "feel" (a viewer's read-only affordances, a demoted user's next request) | ❌ automation proves the guard fires, not that the UX communicates it well | **This is what manual testing is for.** |

**🤖 automation-covered** tags below point at the exact automated test file — treat that
sub-behavior as already proven; your job is the surrounding UX only.

---

## 2. Suite overview

P0 = release-blocking core · P1 = important · P2 = polish / edge cases

| # | Suite | Priority | Automation coverage | File |
|---|---|---|---|---|
| S1 | Auth + RBAC enforcement | **P0** | 🤖 partial — `test/int/rbac.int.test.ts` (guard + DB role); UI gate + live-role UX still manual | [s1-auth.md](./s1-auth.md) |
| S2 | Items CRUD + list/filter | **P0** | 🤖 partial — `test/int/items.int.test.ts` (DB writes) + `test/component/*.test.tsx` (form + filter wiring); UX/copy/visual still manual | [s2-items.md](./s2-items.md) |

> This scaffold ships 2 example suites (E321's reference pattern) covering the template's
> core auth + items domains. Extend with `s3-billing.md`, `s4-api-keys.md`, `s5-admin.md`,
> etc. as those surfaces grow beyond what their automated layer already proves — follow
> the format in §4 and keep the 🤖-coverage annotation honest (link the actual test file).

---

## 3. Test environment & seed data

Local: `docker compose up --build -d` (repo root) → http://localhost:3000, mailpit at
http://localhost:8025 (catches outbound email — password reset / verification links land
here, not a real inbox).

Seeded accounts (`pnpm db:seed`, or auto-seeded by the `migrate` compose service):

| Role | Email | Password |
|---|---|---|
| admin | `admin@example.com` | `Admin123!` |
| editor | `editor@example.com` | `Editor123!` |
| viewer | `viewer@example.com` | `Viewer123!` |

No per-suite setup beyond the seed is required — unlike a bespoke domain app, this
template's core suites (auth, items) are exercisable immediately after seeding.

---

## 4. Role × capability quick-reference (the RBAC judgment table)

Single source of truth: `next-app/lib/team-utils.ts` (`PERMISSION_MATRIX`), rendered
read-only in-app at **Dashboard → Admin → Permission Matrix**.

| Capability | admin | editor | viewer |
|---|:--:|:--:|:--:|
| View items | ✓ | ✓ | ✓ |
| Create / edit items | ✓ | ✓ | ✗ |
| Delete items | ✓ | ✓ | ✗ |
| Manage members & roles | ✓ | ✗ | ✗ |
| Manage billing | ✓ | ✗ | ✗ |
| View audit log | ✓ | ✗ | ✗ |

`requireEditor()` / `requireAdmin()` (`lib/permissions.ts`) re-read the role from the
**database** on every request rather than trusting the session's JWT snapshot — a role
change (e.g. an admin demoting someone) takes effect on that user's very next request,
not at their next login. That live-read behavior is exactly what
`test/int/rbac.int.test.ts` proves at the DB layer; S1 below verifies the **UX** of that
same behavior (what the demoted user actually sees).

---

## 5. Case format (shared by every suite)

```
### [S{n}-{nn}] Case title  〔Priority: P0/P1/P2〕〔Role: admin/editor/viewer/anonymous〕

- **Preconds**: … (seed account used, or a prior case's end state)
- **Steps**:
  1. …
  2. …
- **Expected**:
  - … (observable, binary — not "should work correctly")
- **Result**: ☐ Pass ☐ Fail   **Notes**: __________
```

A case is Fail if **any** expected-result bullet doesn't hold. Record the screen + repro
steps in Notes.

---

## 6. Execution & reporting

1. Run in priority order: P0 suites → P1 → P2.
2. Check off Pass/Fail per case as you go; write a clear repro for every Fail.
3. After a full pass, roll every Fail into `/athena:qa-report` (QA → Epic pipeline) — it
   groups failures by severity and proposes epics (human-gated before `EPIC_INDEX.md`).
4. Record each run's Pass/Fail tally in a **new, dated** file —
   `test-results-YYYY-MM-DD.md` (one file per run; never overwrite a prior run).
   Current: [test-results-2026-07-08.md](./test-results-2026-07-08.md) — initial scaffold run.
5. **Fail triage** — write the root-cause classification directly onto the case in its
   `sN-*.md` file (the roll-up file is a cross-suite summary only, not the source of
   truth):
   - **✅ Fixed, pending re-test** — confirmed real defect, fix merged (link the PR/epic).
     Checkbox **stays Fail** until a human re-walks the case — code review is not a
     substitute for re-running the manual step.
   - **⚪ Not a bug / working as designed** — re-check found the behavior was already
     correct (tester misread the UX, or the case was against a stale build). Checkbox may
     move to Pass immediately; keep the original note plus a dated review conclusion.
   - **🔧 Environment/data gap, not a code defect** — e.g. forgot to reseed. Note the
     tracking item; checkbox stays Fail until re-tested after the fix.

---

## 7. Known clarifications (read before writing new cases)

- **CRUD is modal-based, not page-redirect-based** (CLAUDE.md / E273). A successful
  create/edit closes the dialog and refreshes the list in place — there is no "you have
  been redirected" page to check. A validation or permission error renders **inline in
  the dialog** (`role="alert"`), the dialog stays open.
- **Item ownership is per-user, not team-shared.** `deleteItem`/`updateItem` scope their
  `WHERE` clause to `userId` — a different user's item is invisible to edit/delete even
  for another editor (see `test/int/items.int.test.ts`'s ownership-scoped-delete case).
  Admin does **not** bypass this ownership scope for items today — verify this hasn't
  silently changed (S2).
- **Login rate limiting** exists (`lib/rate-limit.ts`) — repeated failed logins from the
  same test run may trigger a cooldown; if S1's negative-login cases start failing
  unexpectedly, check whether you tripped the limiter rather than assuming a regression.

> Automated tests live in `next-app/` (`pnpm test` unit+component / `pnpm test:int`
> integration / `pnpm test:e2e` e2e). RBAC source of truth:
> `next-app/lib/permissions.ts` + `next-app/lib/team-utils.ts`.
