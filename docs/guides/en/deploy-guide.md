# Deploy Decision Guide

> Choose the right platform **before** you deploy. This guide helps beginners pick between Zeabur, Cloud Run, or local production.

---

## Decision Flowchart

```
Do you need GCP specifically? (work/school/company requirement)
  |
  +-- YES --> Cloud Run
  |
  +-- NO --> Do you want the simplest possible deploy?
              |
              +-- YES --> Zeabur (recommended for first-timers)
              |
              +-- NO --> Do you want free compute tier + more control?
                          |
                          +-- YES --> Cloud Run (free tier, ~$7/mo DB or use Neon free)
                          |
                          +-- NO --> Zeabur
```

**TL;DR** — If you're not sure, start with **Zeabur**. You can always migrate later.

---

## Comparison Table

| Feature | Zeabur | Cloud Run | Local Production |
|---------|--------|-----------|------------------|
| **Complexity** | Low — GitHub login, 1-click deploy | Medium — gcloud CLI, Docker builds | Medium — docker-compose |
| **Monthly Cost** | ~$5–15 (Hobby plan) | ~$0–7 (free compute tier, DB extra) | $0 (your hardware) |
| **Cold Starts** | Minimal (always-on in paid plan) | Yes (0→1 scale, ~2-5s) | None |
| **Regions** | Limited (US/Asia) | 30+ GCP regions | N/A |
| **Database** | 1-click PostgreSQL add-on | Cloud SQL (~$7/mo) or Neon/Supabase (free) | Docker PostgreSQL |
| **Secrets Management** | Dashboard UI | Secret Manager or env vars | `.env` file |
| **Custom Domains** | Yes (free SSL) | Yes (free SSL via Cloud Run mapping) | Manual (nginx + certbot) |
| **CI/CD** | Auto-deploy on git push | Cloud Build or GitHub Actions | Manual |
| **Best For** | Side projects, MVPs, demos | Production apps, teams, compliance | Local testing only |

---

## Platform Details

### Zeabur (Recommended for First-Timers)

**What it is**: A PaaS that deploys from your GitHub repo with minimal configuration.

**Why choose it**:
- Sign in with GitHub — no cloud console to learn
- 1-click PostgreSQL — no database setup
- Auto-deploy on push — no CI/CD pipeline needed
- Built-in domain + free SSL

**Cost breakdown**:
- Hobby plan: ~$5/mo (includes small DB)
- Developer plan: ~$15/mo (more resources, custom domains)

**Getting started**:
```bash
# 1. Check prerequisites
make doctor-deploy PLATFORM=zeabur

# 2. Deploy
make deploy
```

### Cloud Run (More Control)

**What it is**: Google Cloud's serverless container platform. You push a Docker image, GCP runs it.

**Why choose it**:
- Free tier: 2 million requests/month, 180,000 vCPU-seconds
- 30+ regions worldwide
- Fine-grained scaling (0→N instances)
- IAM, VPC, audit logs for compliance

**Cost breakdown**:
- Compute: Free tier covers most hobby projects
- Database: Cloud SQL ~$7/mo (smallest instance) OR Neon/Supabase free tier
- Total: ~$0–7/mo for low-traffic apps

**Getting started**:
```bash
# 1. Check prerequisites
make doctor-deploy PLATFORM=cloudrun

# 2. Build and push (see Cloud Run deploy guide)
gcloud run deploy
```

### Local Production (Testing Only)

**What it is**: Run the production Docker stack on your own machine for testing.

**Why choose it**:
- Verify production builds work before deploying
- No cloud account needed
- Useful for demos on your local network

**Getting started**:
```bash
# Build and start production stack
make docker-prod
```

> **Warning**: Local production is for testing only. It lacks SSL, monitoring, backups, and automatic restarts.

---

## Which Should I Pick?

| If you are... | Pick |
|---------------|------|
| A student building a class project | **Zeabur** — simplest setup, affordable |
| A solo dev shipping an MVP | **Zeabur** — fast iteration, auto-deploy |
| A team needing compliance/audit logs | **Cloud Run** — IAM, VPC, audit trails |
| Deploying for a company on GCP | **Cloud Run** — matches existing infra |
| Testing production builds locally | **Local production** — no cloud needed |
| Not sure yet | **Zeabur** — easiest to start, migrate later |

---

## Prerequisites Check

Before deploying, verify your tools are ready:

```bash
# Check platform-specific prerequisites
make doctor-deploy PLATFORM=zeabur
make doctor-deploy PLATFORM=cloudrun
```

This runs the prerequisites checker which verifies CLI tools, authentication, and platform configuration for your chosen platform.

**Before your first production deploy**, also work through [`fork-security-setup.md`](fork-security-setup.md) — generate your secrets, run `make doctor-production`, and confirm you haven't weakened the inherited OWASP Top 10 defenses.

---

## Next Steps

1. Run `make doctor-deploy` with your chosen platform
2. Fix any issues flagged by the checker
3. Follow the platform-specific deploy instructions:
   - Zeabur: `make deploy`
   - Cloud Run: See GCP documentation for `gcloud run deploy`
   - Local: `make docker-prod`
