# E169 — Auth Surface Migration to Unified Design System

> Phase 43 — Universal Design System Adoption | Size: M (5 SP) | Deps: E167

## Problem

Six auth pages all repeat the same centered-card layout, all bound to `AuthPages.css` (~400 lines):

| Page | Form fields |
|---|---|
| `SignInPage.tsx` | email + password + OAuth buttons |
| `SignUpPage.tsx` | email + password + display_name + OAuth buttons |
| `ForgotPasswordPage.tsx` | email |
| `ResetPasswordPage.tsx` | new password + confirm |
| `VerifyEmailPage.tsx` | (display-only — verification status + resend CTA) |
| `OAuthCallbackPage.tsx` | (display-only — loading/error states) |

Three components currently live as auth-only under `pages/auth/components/`:
- `FormBanner.tsx` — success/error inline alerts
- `PasswordField.tsx` — password input with visibility toggle
- `SocialButtons.tsx` — OAuth provider buttons

These are general-purpose. They belong in `components/ui/` so non-auth pages (e.g. settings) can use them.

## Solution

### New shell primitives

| Primitive | Purpose |
|---|---|
| `<AuthLayout>` | Centered card on a brand-tinted background. Replaces the bespoke `AuthPages.css` `.auth-shell` markup. |
| `<AuthCard>` | Card with logo + title + subtitle + form slot + footer link slot |
| `<DividerLabel>` | Horizontal rule with centered label ("or sign in with") |

### Promote existing auth components

Move into `components/ui/` (rename if needed for genericity) and add Preset slots:
- `FormBanner` → `<Banner>` (variants: `success` | `error` | `info` | `warning`)
- `PasswordField` → keep name, expose under `components/ui/`
- `SocialButtons` → keep name; `providers` prop already configurable

### Page migrations

Every auth page becomes:

```tsx
<AuthLayout>
  <AuthCard
    title={t("signin.title")}
    subtitle={t("signin.subtitle")}
    footer={<Link to="/signup">No account? Sign up</Link>}
  >
    {bannerState && <Banner variant={bannerState.variant}>{bannerState.message}</Banner>}
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField label="Email" htmlFor="email" error={errors.email?.message}>
        <input id="email" {...register("email")} className="form-input" />
      </FormField>
      <PasswordField {...register("password")} error={errors.password?.message} />
      <Button type="submit" variant="primary" loading={isPending}>Sign In</Button>
    </form>
    <DividerLabel>or sign in with</DividerLabel>
    <SocialButtons providers={["google", "github"]} />
  </AuthCard>
</AuthLayout>
```

The form-handler logic (react-hook-form + zod + `useAuth` mutations) stays untouched. Migration is layout-only.

## Key Files

| File | Action |
|---|---|
| `client/src/components/ui/{AuthLayout,AuthCard,DividerLabel,Banner,PasswordField,SocialButtons}.tsx` | New (or moved from `pages/auth/components/`) |
| `client/src/components/ui/preset.ts` | Edit — 5 new Preset slots; update both `defaultPreset` + `compactPreset` |
| `client/src/components/ui/index.ts` | Edit — barrel-export |
| `client/src/components/ui/__tests__/*.test.tsx` | New — co-located test per primitive |
| `client/src/pages/auth/{SignIn,SignUp,ForgotPassword,ResetPassword,VerifyEmail,OAuthCallback}Page.tsx` | Rewrite — compose primitives |
| `client/src/pages/auth/components/` | Delete — directory empties out, `FormBanner`/`PasswordField`/`SocialButtons` moved to `components/ui/` |
| `client/src/pages/auth/AuthPages.css` | Delete (deferred to E170 if any reference remains) |
| `docs/design/design.md` | Edit — auth primitives in § 4, "Auth page recipe" in § 5, update § 7 migration status |

## Implementation

1. **Promote without rewrite** — first, just `git mv` `FormBanner` / `PasswordField` / `SocialButtons` to `components/ui/`, fix imports, run tests. Verifies the move is non-breaking.
2. **Add the new primitives** (`AuthLayout`, `AuthCard`, `DividerLabel`, `Banner` rename of FormBanner). Preset slots + tests.
3. **Migrate `OAuthCallbackPage`** first — display-only, no form, lowest risk. Validates auth chrome.
4. **Migrate `VerifyEmailPage`** — also display-only.
5. **Migrate `ForgotPasswordPage`** — single field, low surface.
6. **Migrate `ResetPasswordPage`** — two fields with confirm matching.
7. **Migrate `SignInPage`** — production critical, full flow with OAuth.
8. **Migrate `SignUpPage`** — last; most fields.
9. **Run full client + e2e auth tests** after each migration. Existing tests are the contract — they MUST keep passing.
10. **Manual visual sweep** across 6 themes — sign in, OAuth, error banner, success banner.

## Acceptance Criteria

- [ ] 6 auth shell primitives shipped (`AuthLayout`, `AuthCard`, `DividerLabel`, `Banner`, `PasswordField`, `SocialButtons`)
- [ ] All 6 auth pages migrated; existing client + Playwright auth tests pass unchanged
- [ ] `pages/auth/components/` directory deleted (empty after promotion)
- [ ] `AuthPages.css` either deleted or queued for E170 with explicit grep evidence of remaining references
- [ ] `design.md` § 4 documents auth primitives; § 7 migration table shows auth ✅
- [ ] No regression in OAuth flow (manual: sign in via Google + GitHub)
- [ ] No regression in error handling (manual: bad credentials, expired reset link, expired verify token)
- [ ] All client tests pass; build green; Stop-verifier clean

## Alignment / Cross-Epic Hooks

- **Hard-depends on E167** — uses `<FormField>`, `<Button>`, `Preset` axis, theme tokens.
- **Pairs with E168** (public surface) — together complete the "every page on primitives" goal.
- **Risk-bounded by E161** — auth backend (unified `AuthResponse`, session store) was hardened in E161; this epic only changes layout, not the wire protocol.
- **Hands deletion to E170** — `AuthPages.css` removal happens after grep confirms zero references.

## Out of Scope

- **Magic-link / passkey flows** — separate epic if/when needed.
- **MFA / TOTP enrollment screens** — don't exist yet; build with primitives when needed.
- **Auth backend changes** — pure frontend layout migration.
- **OAuth-provider expansion** — `SocialButtons` API stays generic; adding Apple/Microsoft is a config tweak, not this epic.
- **Translation key reorganization** — keep existing i18n keys to minimize diff churn.
