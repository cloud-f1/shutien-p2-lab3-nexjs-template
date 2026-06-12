# E174 — Modal + Drawer + Toast Primitives

> Phase 44 — Design System Completion & Validation | Size: M (5 SP) | Deps: E167

## Problem

Three overlay patterns are currently hand-rolled or missing:

1. **Modal dialogs** — `SettingsView` already has a delete-account confirmation built as inline `{showDeleteModal && <div>…</div>}` with custom CSS classes (`settings-modal`, `settings-modal-overlay`, `settings-modal-actions`). No focus trap, no escape-to-close, no scroll lock. Future flows (delete project, revoke API key) will need the same chrome.
2. **Drawers / side panels** — `<DataTable>` filters can grow beyond the toolbar (multi-select facets, date ranges). A right-side drawer is the standard escape hatch. Doesn't exist yet.
3. **Toasts / notifications** — auth flows want "Email verified ✓" / "Password reset link sent" feedback that auto-dismisses. Today they use `<Banner>` (E169) inline in the form, which works but doesn't notify users who navigate away mid-flow.

All three are explicitly deferred in design.md § 11 ("build when 2+ pages need it"). With E173's form expansion adding the delete-account confirm and SettingsView about to ship, the threshold is met.

## Solution

Three primitives, each with a focused API.

### `<Modal>`

```tsx
<Modal
  open={showDelete}
  onClose={() => setShowDelete(false)}
  title="Delete account?"
  description="This action is permanent."
  size="sm"      // sm | md | lg
>
  <FormField label='Type "DELETE" to confirm' htmlFor="confirm" error={…}>
    <TextInput id="confirm" {…} />
  </FormField>
  <Modal.Actions>
    <Button variant="secondary" onClick={onClose}>Cancel</Button>
    <Button variant="danger" disabled={!confirmed}>Delete forever</Button>
  </Modal.Actions>
</Modal>
```

Built on a portal (`createPortal` to `document.body`). Uses `<dialog>` element where supported, falls back to focus-trap pattern. ESC-to-close, click-outside-to-close, scroll-lock on `<body>`, restore focus to trigger on close.

### `<Drawer>`

Same shape as `<Modal>` but slides from a `side` prop (`"right"` default, `"left"` / `"bottom"` optional). Use cases: filter panels, settings sub-screens, detail-view side panels.

### `<Toast>` + `<ToastProvider>` + `useToast()`

```tsx
// app boot
<ToastProvider>
  <App />
</ToastProvider>

// anywhere
const { push } = useToast();
push({ variant: "success", message: "Email verified" });
push({ variant: "error", message: "Network error", action: { label: "Retry", onClick: retry } });
```

Toasts stack in a fixed corner (configurable via Preset). Auto-dismiss after `duration` (default 4s, infinite if `duration: null`). Keyboard-accessible: focus moves to toast on push, ESC dismisses.

## Key Files

| File | Action |
|---|---|
| `client/src/components/ui/{Modal,Drawer,Toast,ToastProvider}.tsx` | New |
| `client/src/components/ui/useToast.ts` | New — hook + context |
| `client/src/components/ui/preset.ts` | Edit — 3 new Preset slots (modal, drawer, toast) |
| `client/src/components/ui/index.ts` | Edit — barrel export |
| `client/src/components/ui/__tests__/Modal.test.tsx` | New — open/close, ESC, click-outside, focus restore |
| `client/src/components/ui/__tests__/Drawer.test.tsx` | New — slide direction, dismiss patterns |
| `client/src/components/ui/__tests__/Toast.test.tsx` | New — push, auto-dismiss, action click |
| `client/src/main.tsx` | Edit — wrap `<App />` in `<ToastProvider>` |
| `client/src/pages/dashboard/views/SettingsView.tsx` | Edit — replace bespoke delete-account modal markup with `<Modal>` |
| `client/src/pages/auth/SignInPage.tsx` (etc.) | Edit — emit success/error toasts via `useToast()` instead of local Banner where appropriate |
| `docs/design/design.md` | Edit — § 4 entries; § 5 "Modal recipe", "Drawer recipe", "Toast recipe" |

## Implementation

1. Build `<Modal>` first using native `<dialog>` (Chrome/Firefox/Safari all support); add focus-trap fallback for browsers without it.
2. Build `<Drawer>` — same dismiss patterns, different transform animation. Share open/close logic via small internal hook.
3. Build `<ToastProvider>` + `useToast()` — Zustand store for the toast queue, portal for the stack.
4. Migrate `SettingsView` delete-account flow to `<Modal>`. Verify keyboard navigation (Tab loops within modal, ESC closes, focus returns to "Delete account" button).
5. Wire `useToast()` into one auth flow as proof — e.g. `ForgotPasswordPage` shows "Reset link sent ✓" toast on success.
6. Manual a11y check: NVDA / VoiceOver announces modal title on open, toast message on push.

## Acceptance Criteria

- [ ] `<Modal>`, `<Drawer>`, `<Toast>` shipped with full test coverage (open/close, dismiss patterns, focus management)
- [ ] `<ToastProvider>` mounted at app root; `useToast().push()` works from anywhere
- [ ] `SettingsView` delete-account modal migrated; bespoke modal CSS deleted
- [ ] At least one auth flow uses `useToast()` for success feedback
- [ ] Focus trap: Tab stays within modal/drawer; restored to trigger element on close
- [ ] ESC-to-close on Modal + Drawer; click-outside-to-close behavior matches design.md § 5 spec
- [ ] Scroll lock on `<body>` while modal/drawer open; lock released on close
- [ ] Auto-dismiss timer for toasts; clearable on hover (pause), restart on leave
- [ ] All client tests pass; build green
- [ ] design.md § 4 + § 5 documented; § 11 future-extensions row crossed off

## Alignment / Cross-Epic Hooks

- **Hard-depends on E167** — uses Preset, theme tokens, `<Button>`.
- **Pairs with E173** — `<Modal>` wraps the `<TextInput>` delete-account confirmation.
- **Pairs with E177** — a11y audit must include modal/drawer focus management + screen-reader announcements.
- **Enables E170 cleanup** — bespoke `.settings-modal-*` rules in legacy CSS become deletable.

## Out of Scope

- **Sheet primitive** (mobile bottom-sheet variant) — `<Drawer side="bottom">` covers this for V1.
- **Persistent notifications** (banner across full app) — different pattern; not toast.
- **Toast positioning per-toast** — all toasts stack in one corner. Per-toast position is a complexity sink.
- **Modal stacking** (modal opens another modal) — discouraged UX; not supported in V1.
- **Loading toasts** with progress indicators — defer; the auth flows don't need progress, just success/error.
