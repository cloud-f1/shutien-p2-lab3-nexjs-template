# Fork Security Setup

When you fork the @saas template, you must rotate all secrets before deploying to production.

## Required Rotations

### 1. AUTH_SECRET

```bash
# Generate a new secret
openssl rand -base64 32
```

Set in your deployment platform (Zeabur env vars).

### 2. Database Password

Change the PostgreSQL password in `DATABASE_URL` — never use the default dev password in production.

### 3. OAuth Credentials

Create new OAuth apps for your domain:
- Google: [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials
- GitHub: Settings → Developer settings → OAuth Apps

### 4. Billing Keys

- Stripe: use `sk_live_*` keys (not `sk_test_*`) in production
- ECPay: use production merchant ID + hash key

## Security Checklist

- [ ] `AUTH_SECRET` rotated and set in platform env vars
- [ ] `DATABASE_URL` uses a production-only DB user with minimal permissions
- [ ] OAuth credentials scoped to your domain
- [ ] Billing keys are production (not test) keys
- [ ] `NEXTAUTH_URL` is set to your exact production URL (no trailing slash)
- [ ] HTTPS enforced (Zeabur handles this automatically)
- [ ] No secrets committed to git (check `.gitignore`)

## OWASP Top 10 Mitigations

| Risk | Mitigation in @saas |
|------|---------------------|
| Injection | Drizzle ORM with parameterized queries |
| Broken Auth | NextAuth v5, stateless JWT, no custom auth code |
| Sensitive Data | Passwords hashed with bcrypt, tokens in-memory |
| RBAC failures | `requireRole()` checked server-side in every action |
| Security Misconfiguration | `zbpack.json` sets security headers at platform level |
| XSS | React escaping + CSP headers |
| CSRF | SameSite cookie + NextAuth CSRF protection |

See `docs/guides/en/fork-security-setup.md` for the full OWASP guide.
