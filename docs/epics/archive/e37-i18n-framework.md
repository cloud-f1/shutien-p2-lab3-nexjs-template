# E37: i18n Framework (react-i18next + Server Messages)

> **Phase**: 13 | **Size**: M (13 SP) | **Priority**: P1
> **Depends on**: no deps
> **Source**: Strategy Cycle 2 — RESEARCH gap #4

---

## Problem Statement

The template is limited to English-only UI. Over 60% of SaaS products serve multi-language markets. Without i18n infrastructure, developers must retrofit translations later — a painful process that touches every component. Adding i18n from the start (even with just en/zh-TW) establishes the pattern for all future strings.

## Stories

### S1: Client i18n Setup
**As a** frontend developer,
**I want** `react-i18next` configured with namespace-per-page,
**So that** translations are code-split and easy to maintain.

**Acceptance Criteria:**
- [ ] `react-i18next` + `i18next-browser-languagedetector` installed
- [ ] Namespace-per-page: `common.json`, `auth.json`, `dashboard.json`, `landing.json`, `billing.json`
- [ ] Two locales shipped: `en`, `zh-TW`
- [ ] `client/src/locales/{lang}/{namespace}.json` file structure
- [ ] Lazy loading: only active namespace + common loaded per page
- [ ] `useTranslation('namespace')` pattern documented
- [ ] `errors.json` namespace for server error message keys

### S2: Language Switcher
**As a** user,
**I want** to switch languages from the settings page,
**So that** I can use the app in my preferred language.

**Acceptance Criteria:**
- [ ] Language selector in Dashboard Settings view (Appearance section, below theme picker)
- [ ] Persisted to localStorage via `i18next-browser-languagedetector` (survives refresh)
- [ ] Browser locale auto-detection on first visit (`navigator.language`)
- [ ] Language change applies immediately (no page reload)
- [ ] URL remains the same (no `/en/` prefix — single-domain approach)
- [ ] Only `en` and `zh-TW` shown as options (extensible array)
- [ ] ARIA label on language selector for accessibility

### S3: Server Error Message Keys
**As a** backend developer,
**I want** API error responses to use i18n message keys,
**So that** the client can display localized error messages.

**Acceptance Criteria:**
- [ ] `ErrorDetail` schema in OpenAPI updated with optional `message_key` field
- [ ] Error responses include `message_key` field (e.g., `"error.auth.invalid_credentials"`)
- [ ] Client maps `message_key` -> translated string via i18next `errors` namespace
- [ ] Fallback chain: `message_key` translation -> raw `detail` string -> generic error
- [ ] Existing error messages unchanged (backward compatible — `message_key` is nullable)
- [ ] Server error handler utility maps existing `detail` codes to `message_key` values

### S4: Translate Core Pages
**As a** user,
**I want** auth pages, dashboard, and landing page translated,
**So that** the app is usable in both English and Chinese.

**Acceptance Criteria:**
- [ ] Auth pages (SignIn, SignUp, ForgotPassword, ResetPassword, VerifyEmail): fully translated en + zh-TW
- [ ] Dashboard: sidebar nav, header, all view titles, settings labels — fully translated
- [ ] Landing page: hero, features, CTA, footer — fully translated
- [ ] Billing pages (PricingPage, BillingSettingsPage): fully translated
- [ ] Legal pages: remain English-only (legal text is language-specific)
- [ ] NotFoundPage: translated
- [ ] All hardcoded strings extracted to namespace JSON files

### S5: Tests
**Acceptance Criteria:**
- [ ] Translation key completeness check: script validates all keys in `en` exist in `zh-TW` and vice versa
- [ ] Language switcher test: changes locale, re-renders correctly
- [ ] Server error key test: API returns `message_key` field in error responses
- [ ] Error display test: client renders translated error when `message_key` is present
- [ ] Error fallback test: client falls back to `detail` string when no translation found
- [ ] Coverage >= 80% on new code

## Risk Notes

- Scope: only en + zh-TW shipped — adding more locales is a content task, not engineering
- Legal pages excluded from translation (each jurisdiction needs its own legal text)
- RTL languages not in scope (no Arabic/Hebrew layout support needed yet)
- Domain pages (places, portfolios) excluded — those are example/template content, not core UI

---

## Technical Design

### Architecture Decision: Namespace-per-Page

Instead of a single monolithic translation file, translations are split by page/feature namespace. This provides:
1. **Code-splitting**: only load translations for the current page
2. **Team scalability**: different developers can work on different namespaces without merge conflicts
3. **Pattern clarity**: new domains add their own namespace file, no central file grows unbounded

The `common` namespace holds shared strings (buttons, navigation, generic labels). The `errors` namespace maps server `message_key` values to localized strings.

### File Structure

```
client/src/
  i18n.ts                          # i18next init + config
  locales/
    en/
      common.json                  # Shared: buttons, nav, generic labels
      auth.json                    # SignIn, SignUp, ForgotPassword, ResetPassword, VerifyEmail
      dashboard.json               # Sidebar, header, all views, settings labels
      landing.json                 # Hero, features, CTA, footer
      billing.json                 # Pricing page, billing settings
      errors.json                  # Server error message_key translations
    zh-TW/
      common.json
      auth.json
      dashboard.json
      landing.json
      billing.json
      errors.json

server/app/core/
  i18n.py                          # message_key mapping utility
```

### i18n Configuration (`client/src/i18n.ts`)

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Static imports (no HTTP backend — JSON bundled at build time)
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enDashboard from './locales/en/dashboard.json';
import enLanding from './locales/en/landing.json';
import enBilling from './locales/en/billing.json';
import enErrors from './locales/en/errors.json';
import zhTWCommon from './locales/zh-TW/common.json';
import zhTWAuth from './locales/zh-TW/auth.json';
import zhTWDashboard from './locales/zh-TW/dashboard.json';
import zhTWLanding from './locales/zh-TW/landing.json';
import zhTWBilling from './locales/zh-TW/billing.json';
import zhTWErrors from './locales/zh-TW/errors.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh-TW', label: '繁體中文' },
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: enCommon, auth: enAuth, dashboard: enDashboard, landing: enLanding, billing: enBilling, errors: enErrors },
      'zh-TW': { common: zhTWCommon, auth: zhTWAuth, dashboard: zhTWDashboard, landing: zhTWLanding, billing: zhTWBilling, errors: zhTWErrors },
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'auth', 'dashboard', 'landing', 'billing', 'errors'],
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
  });

export default i18n;
```

**Key decisions:**
- **Static imports** (not `i18next-http-backend`): all JSON is bundled at build time. With only 2 locales and ~6 namespaces, the total size is negligible (~10-15KB gzipped). Eliminates runtime HTTP requests and loading spinners.
- **`i18next-browser-languagedetector`**: detects `navigator.language` on first visit, persists choice to `localStorage` key `i18nextLng`. No custom Zustand store needed.
- **`fallbackLng: 'en'`**: missing zh-TW keys gracefully fall back to English.
- **No URL prefix**: language is a user preference (localStorage), not a URL segment. Single-domain SaaS pattern.

### Namespace Key Convention

Flat dot-notation keys within each namespace file:

```json
// auth.json
{
  "signIn.title": "Sign In",
  "signIn.subtitle": "Welcome back",
  "signIn.emailLabel": "Email",
  "signIn.passwordLabel": "Password",
  "signIn.forgotPassword": "Forgot password?",
  "signIn.submit": "Sign In",
  "signIn.noAccount": "Don't have an account?",
  "signIn.signUpLink": "Sign up",
  "signUp.title": "Create Account",
  ...
}
```

**Why flat keys?** Avoids nested JSON complexity. i18next supports both, but flat keys are easier to search/grep and produce cleaner `t('auth:signIn.title')` calls.

### Component Integration Pattern

```typescript
// In a page component:
import { useTranslation } from 'react-i18next';

function SignInPage() {
  const { t } = useTranslation('auth');
  return <h1>{t('signIn.title')}</h1>;
}

// For shared components needing multiple namespaces:
function DashboardLayout() {
  const { t } = useTranslation('dashboard');
  const { t: tc } = useTranslation('common');
  return <button>{tc('buttons.save')}</button>;
}
```

### Language Switcher Design

Added to the **Appearance** section of Dashboard Settings (below the theme picker):

```typescript
// Inside SettingsView, after ThemePicker
function LanguagePicker() {
  const { i18n } = useTranslation();
  return (
    <div className="settings-row">
      <div>
        <div className="settings-label">{t('settings.language')}</div>
        <div className="settings-hint">{t('settings.languageHint')}</div>
      </div>
      <div className="theme-options" role="radiogroup" aria-label={t('settings.language')}>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            className={`settings-btn outline${i18n.language === lang.code ? ' active' : ''}`}
            onClick={() => i18n.changeLanguage(lang.code)}
            role="radio"
            aria-checked={i18n.language === lang.code}
          >
            {lang.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Why no Zustand store?** `i18next` already manages language state internally and persists via `localStorage`. Adding Zustand would duplicate state. Components re-render automatically via `useTranslation` hook's subscription to i18next events.

### Server Error Message Keys

#### OpenAPI Change (done)

`ErrorDetail` schema updated with optional `message_key` field:
```yaml
ErrorDetail:
  type: object
  required: [detail]
  properties:
    detail:
      type: string
      description: Machine-readable error code
    message_key:
      type: ['string', 'null']
      description: i18n translation key for client-side localized error display
      example: error.auth.invalid_credentials
```

#### Server-Side Mapping (`server/app/core/i18n.py`)

```python
# Maps existing detail codes to i18n message keys
ERROR_MESSAGE_KEYS: dict[str, str] = {
    # Auth
    "LOGIN_BAD_CREDENTIALS": "error.auth.invalid_credentials",
    "REGISTER_USER_ALREADY_EXISTS": "error.auth.user_already_exists",
    "INVALID_REFRESH_TOKEN": "error.auth.invalid_refresh_token",
    "RESET_PASSWORD_BAD_TOKEN": "error.auth.reset_bad_token",
    "VERIFY_USER_BAD_TOKEN": "error.auth.verify_bad_token",
    # Teams
    "TEAM_SLUG_EXISTS": "error.teams.slug_exists",
    "MEMBER_ALREADY_EXISTS": "error.teams.member_exists",
    # Billing
    "SUBSCRIPTION_ALREADY_ACTIVE": "error.billing.already_active",
    "NO_STRIPE_CUSTOMER": "error.billing.no_customer",
    "INVALID_WEBHOOK_SIGNATURE": "error.billing.invalid_signature",
    # Places
    "PLACE_ALREADY_IN_PORTFOLIO": "error.places.already_in_portfolio",
}

def get_message_key(detail: str) -> str | None:
    """Look up i18n message key for an error detail code."""
    return ERROR_MESSAGE_KEYS.get(detail)
```

**Integration approach**: modify the error response utility/exception handlers to include `message_key` alongside `detail`. The `message_key` is nullable — legacy endpoints or unknown codes return `null`.

#### Client-Side Error Translation

```typescript
// In error handling (e.g., Axios interceptor or mutation onError)
import i18n from '../i18n';

function getLocalizedError(error: ErrorDetail): string {
  if (error.message_key) {
    const translated = i18n.t(error.message_key, { ns: 'errors' });
    // i18n.t returns the key itself if no translation found
    if (translated !== error.message_key) {
      return translated;
    }
  }
  // Fallback: raw detail string
  return error.detail;
}
```

### Pages to Translate (Scope)

| Page | Namespace | Estimated Keys |
|------|-----------|---------------|
| SignInPage | `auth` | ~12 |
| SignUpPage | `auth` | ~10 |
| ForgotPasswordPage | `auth` | ~8 |
| ResetPasswordPage | `auth` | ~8 |
| VerifyEmailPage | `auth` | ~6 |
| LandingPage | `landing` | ~25 |
| DashboardPage (all views) | `dashboard` | ~60 |
| PricingPage | `billing` | ~15 |
| BillingSettingsPage | `billing` | ~10 |
| NotFoundPage | `common` | ~4 |
| Shared components (nav, buttons) | `common` | ~20 |
| Server errors | `errors` | ~12 |
| **Total** | | **~190 keys** |

**Excluded:**
- Legal pages (PrivacyPage, TermsPage) — jurisdiction-specific legal text
- Domain pages (PlacesPage, PortfoliosPage) — example/template content
- DashboardLayout structure — only labels, not layout

### Translation Key Completeness Script

```bash
# scripts/check-translations.sh
# Validates that en and zh-TW have identical key sets per namespace
for ns in common auth dashboard landing billing errors; do
  en_keys=$(jq -r 'keys[]' client/src/locales/en/$ns.json | sort)
  zh_keys=$(jq -r 'keys[]' client/src/locales/zh-TW/$ns.json | sort)
  diff <(echo "$en_keys") <(echo "$zh_keys") && echo "OK: $ns" || echo "MISMATCH: $ns"
done
```

This can also be a Vitest test for CI enforcement.

### Dependencies (npm)

```
react-i18next         ^15.0.0
i18next               ^24.0.0
i18next-browser-languagedetector  ^8.0.0
```

No server-side dependencies needed — `message_key` is a simple dict lookup.

### Migration Path for New Domains

When a developer adds a new domain (via `/athena:domain`):
1. Create `client/src/locales/en/{domain}.json` and `client/src/locales/zh-TW/{domain}.json`
2. Add namespace to `i18n.ts` resources and `ns` array
3. Use `useTranslation('{domain}')` in page components
4. Add domain error codes to `server/app/core/i18n.py` mapping

This pattern should be documented in the domain generator templates (`docs/templates/domain/`).

---

## QA Checklist (from qa-patterns.md)

### TypeScript / Zod
- [ ] `satisfies z.ZodType<ApiType>` on updated `ErrorDetail` Zod schema (add `message_key` field)
- [ ] Explicit return types on exported i18n utility functions

### CSS / Layout
- [ ] DashboardLayout comment block preserved when adding language picker to Settings
- [ ] Language picker uses existing `settings-btn` classes (no new CSS needed)
- [ ] No raw hex values in any new CSS

### Accessibility (WCAG 2.1 AA)
- [ ] Language selector: `role="radiogroup"` + `aria-label` on container
- [ ] Language buttons: `role="radio"` + `aria-checked` state
- [ ] Keyboard navigation works on language picker (focus, Enter/Space)
- [ ] `lang` attribute on `<html>` updated when language changes (for screen readers)

### Testing
- [ ] MSW handlers return `message_key` in error responses
- [ ] `userEvent` (not `fireEvent`) in all client tests
- [ ] Translation key completeness test (en vs zh-TW parity)
- [ ] Coverage >= 80% per module
- [ ] Tests mock i18n provider (wrap components in `I18nextProvider` with test instance)
