# S2 — Items CRUD + List/Filter

Priority: **P0**. Automation coverage: 🤖 `test/int/items.int.test.ts` proves the DB
side-effects (create → row exists → delete → row gone, ownership-scoped delete rejection,
blank-title validation). 🤖 `test/component/item-form.test.tsx` proves the modal's
`onSuccess`/error wiring and client-side validation in isolation (mocked action, no real
DB). 🤖 `test/component/data-table-filter.test.tsx` proves the shared `<DataTable>`
filter/row-count wiring with synthetic data. This suite verifies the same behaviors
**through the real UI, with real data, and everything automation doesn't reach**: visual
correctness, the modal opening/closing UX, and the JSON export's actual downloaded file.

---

### [S2-01] Create an item 〔Priority: P0〕〔Role: editor〕 🤖 partial

- **Preconds**: Logged in as `editor@example.com`. On Dashboard → Items.
- **Steps**:
  1. Click 「新增項目」.
  2. Type a title, e.g. "Manual Test Widget". Submit.
- **Expected**:
  - A modal dialog opens (not a page navigation) — confirms CLAUDE.md's CRUD-modal
    convention holds in the real UI, not just in the component test's mock.
  - On success the dialog **closes itself** and the new row appears in the list
    immediately — no manual refresh needed.
  - No error text is shown.
- **Result**: ☐ Pass ☐ Fail   **Notes**: __________

### [S2-02] Create with a blank title 〔Priority: P1〕〔Role: editor〕 🤖 partial

> 🤖 the validation-blocks-submit wiring itself is proven at
> `test/component/item-form.test.tsx`; this verifies the real dialog shows it legibly.

- **Preconds**: Logged in as `editor@example.com`. Create dialog open.
- **Steps**:
  1. Leave the title blank. Click submit.
- **Expected**:
  - An inline error appears under the field (something like "請輸入標題") — the dialog
    does NOT close, no network request appears to have fired (no new row on submit).
- **Result**: ☐ Pass ☐ Fail   **Notes**: __________

### [S2-03] Edit an item 〔Priority: P0〕〔Role: editor〕

- **Preconds**: At least one item exists (from S2-01). Logged in as `editor@example.com`.
- **Steps**:
  1. Click 編輯 on a row.
  2. Change the title. Submit.
- **Expected**:
  - The dialog pre-fills the current title (not blank).
  - On success the dialog closes and the row's title updates in place — same row, new text.
- **Result**: ☐ Pass ☐ Fail   **Notes**: __________

### [S2-04] Delete an item 〔Priority: P0〕〔Role: editor〕

- **Preconds**: At least one item exists.
- **Steps**:
  1. Click the delete action on a row.
- **Expected**:
  - A confirm dialog appears (per CLAUDE.md's `confirm-dialog.tsx` convention) — deletion
    is never a single accidental click.
  - After confirming, the row disappears from the list without a full page reload.
- **Result**: ☐ Pass ☐ Fail   **Notes**: __________

### [S2-05] Viewer cannot create/edit/delete 〔Priority: P0〕〔Role: viewer〕

> See also S1-06 (same guard, framed as an RBAC UX check). This case focuses on items
> specifically.

- **Preconds**: Logged in as `viewer@example.com`. On Dashboard → Items.
- **Steps**:
  1. Look at the toolbar and each row.
- **Expected**:
  - No 「新增項目」 button, no per-row edit/delete actions. The list itself is still
    visible (viewers can read) — this is a visibility/affordance check, not a
    guard-bypass attempt.
- **Result**: ☐ Pass ☐ Fail   **Notes**: __________

### [S2-06] Filter the items list 〔Priority: P1〕〔Role: any with items visible〕 🤖 partial

> 🤖 the filter/row-count mechanics are proven with synthetic data at
> `test/component/data-table-filter.test.tsx`. This verifies it with real seeded/created
> data and the real 搜尋項目… placeholder copy.

- **Preconds**: At least 2 items with distinguishable titles exist.
- **Steps**:
  1. Type a substring of one item's title into the 搜尋項目… box.
  2. Clear the box.
- **Expected**:
  - Only matching rows remain visible; the "共 N 筆" count updates to match.
  - Clearing the box restores every row.
  - Typing a string that matches nothing shows the empty-state message (「尚無資料。」 or
    similar), not a blank white area.
- **Result**: ☐ Pass ☐ Fail   **Notes**: __________

### [S2-07] Export items as JSON 〔Priority: P2〕〔Role: any〕

- **Preconds**: At least one item owned by the current user exists.
- **Steps**:
  1. Click 「匯出 JSON」.
  2. Open the downloaded file.
- **Expected**:
  - Button shows a transient "匯出中…" state while the export runs, then resets.
  - A file downloads (filename like `items-YYYY-MM-DD.json`).
  - The file's JSON contains exactly the current user's items (id/title/createdAt/updatedAt),
    not another user's data.
- **Result**: ☐ Pass ☐ Fail   **Notes**: __________

### [S2-08] Item ownership — an editor cannot see/edit another user's items 〔Priority: P0〕〔Role: editor〕

> 🤖 the ownership-scoped DB rejection (an editor's `deleteItem` on another user's row id
> returns an error, row untouched) is proven at `test/int/items.int.test.ts`. This
> verifies the list itself never surfaces another user's rows to begin with.

- **Preconds**: Two editor accounts, each with their own items (create a second test
  editor account if only the seed accounts exist).
- **Steps**:
  1. Log in as editor A, note their item titles.
  2. Log in as editor B.
- **Expected**:
  - Editor B's items list shows only editor B's own items — editor A's titles are not
    present anywhere in the list, count, or export.
- **Result**: ☐ Pass ☐ Fail   **Notes**: __________

### [S2-09] Visual — dark mode & responsive layout 〔Priority: P2〕〔Role: any〕

- **Preconds**: On Dashboard → Items with a few items present.
- **Steps**:
  1. Toggle dark mode (keyboard shortcut `d`, or the theme toggle).
  2. Resize the browser to a narrow (mobile-width) viewport.
- **Expected**:
  - Dark mode: text remains legible against its background everywhere on the page (table,
    dialog, buttons) — no white-on-white or black-on-black regions.
  - Narrow viewport: the table/toolbar reflow without horizontal overflow cutting off the
    delete/edit actions or the filter box.
- **Result**: ☐ Pass ☐ Fail   **Notes**: __________

### [S2-10] Pagination & page-size 〔Priority: P2〕〔Role: any〕

- **Preconds**: More items exist than the default page size (create enough test items, or
  lower expectations to whatever the seed provides — note actual count in Notes).
- **Steps**:
  1. Change 每頁 (rows-per-page) to a different value.
  2. Use the next/previous page controls.
- **Expected**:
  - Row-per-page selection changes how many rows render immediately (no reload needed).
  - Page controls disable correctly at the first/last page (previous disabled on page 1,
    next disabled on the last page).
- **Result**: ☐ Pass ☐ Fail   **Notes**: __________
