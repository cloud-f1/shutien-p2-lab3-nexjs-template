# E289 — HTTP Security Headers

## Problem

`next-app/next.config.ts` only sets `output: "standalone"` — no HTTP security
headers are applied. Without them the app is missing baseline browser protections:
clickjacking (X-Frame-Options), MIME sniffing (X-Content-Type-Options), transport
security (HSTS), and a Content Security Policy. Scanners such as securityheaders.com
will give this app an "F".

## Solution

1. Extract a well-commented `SECURITY_HEADERS` const into `lib/security-headers.ts`
   so it is importable, testable, and easy for forkers to customise.
2. Wire an async `headers()` function in `next.config.ts` that applies the list to
   all routes (`/(.*)`).
3. Ship a Vitest unit test (`lib/security-headers.test.ts`) that asserts every
   expected header name is present in the exported list.

### Headers applied

| Header | Value |
|--------|-------|
| Strict-Transport-Security | max-age=63072000; includeSubDomains; preload |
| X-Content-Type-Options | nosniff |
| X-Frame-Options | DENY |
| Referrer-Policy | strict-origin-when-cross-origin |
| X-DNS-Prefetch-Control | on |
| Permissions-Policy | camera=(), microphone=(), geolocation=() |
| Content-Security-Policy | (pragmatic — see comments in source) |

The CSP keeps `'unsafe-inline'` and `'unsafe-eval'` on `script-src` and
`style-src` so the app works out-of-the-box with Next.js inline hydration
scripts and Tailwind CSS. Forkers can tighten these progressively.

## Key Files

- `next-app/lib/security-headers.ts` — exported `SECURITY_HEADERS` const
- `next-app/lib/security-headers.test.ts` — unit test
- `next-app/next.config.ts` — async `headers()` wired here

## Acceptance Criteria

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (security-headers.test.ts included)
- [ ] `pnpm build` passes (validates next.config.ts at build time)
- [ ] All 7 header names are present in the exported const
- [ ] CSP does not break the app (no strict nonces required)

## Out of Scope

- Nonce-based CSP (requires middleware + streaming changes)
- Report-URI / report-to endpoint
- Per-route header overrides
- Feature-Policy (deprecated in favour of Permissions-Policy)
