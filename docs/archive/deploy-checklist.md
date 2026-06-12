# Production Deploy Checklist

## Quick Deploy (CLI)

```bash
make deploy ARGS="--first-time"   # Full setup: project → env → services → domains
make deploy ARGS="--redeploy"     # Redeploy after code changes
make deploy ARGS="--status"       # Check deployment status
make deploy ARGS="--env-only"     # Update env vars only
```

## Manual Zeabur Setup (Dashboard)
- [ ] Create Zeabur project
- [ ] Add PostgreSQL addon (auto-generates `DATABASE_URL`)
- [ ] Add **server** service (Git source, `server/` root)
- [ ] Add **client** service (Git source, `/` root with `zbpack.json` in `client/`, or use CLI deploy)

## Server Environment Variables
| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | Auto-set by Zeabur PostgreSQL addon |
| `SECRET_KEY` | ✅ | `openssl rand -hex 32` — must NOT be default |
| `REFRESH_SECRET_KEY` | ✅ | Different from SECRET_KEY |
| `ENVIRONMENT` | ✅ | Set to `production` |
| `ALLOWED_ORIGINS_STR` | ✅ | Production client URL(s), comma-separated |
| `EMAIL_PROVIDER` | ✅ | `console` (dev), `mailgun`, or `zeabur` |
| `EMAIL_FROM` | ✅ | Verified sender address |
| `MAILGUN_API_KEY` | ⬜ | If EMAIL_PROVIDER=mailgun |
| `MAILGUN_DOMAIN` | ⬜ | If EMAIL_PROVIDER=mailgun |
| `GOOGLE_CLIENT_ID` | ⬜ | If using Google OAuth |
| `GOOGLE_CLIENT_SECRET` | ⬜ | If using Google OAuth |
| `SENTRY_DSN` | ⬜ | Optional — Sentry ingest URL |
| `APP_VERSION` | ⬜ | Optional — e.g., `1.0.0` |

## Client Environment Variables
| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_API_URL` | ✅ | Production API URL — baked at **build time** |
| `VITE_GOOGLE_CLIENT_ID` | ⬜ | For client-side OAuth redirect |
| `VITE_SENTRY_DSN` | ⬜ | Optional — Sentry browser DSN |

## Verification
- [ ] `GET /health` returns `{"status":"healthy","database":"connected"}`
- [ ] Registration + email verification works
- [ ] OAuth callback URLs point to production domain
- [ ] CORS allows production client origin
- [ ] Client loads and can authenticate
- [ ] Dashboard and all routes load correctly
