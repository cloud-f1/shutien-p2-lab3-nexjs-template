# Deploy Your App — From Clone to Production

> Complete step-by-step guide to deploying your app on Zeabur or Cloud Run. Follow from top to bottom — no external docs needed.

---

## Step 0: Choose Your Platform

Not sure which platform to pick? Read the [Deploy Decision Guide](deploy-guide.md) first.

**TL;DR** — Pick **Zeabur** if you want the simplest path. Pick **Cloud Run** if you need GCP or want a free compute tier with more control.

---

## Step 1: Check Prerequisites

Run the prerequisites checker for your chosen platform:

```bash
# Zeabur
make doctor-deploy PLATFORM=zeabur

# Cloud Run
make doctor-deploy PLATFORM=cloudrun
```

Fix any issues flagged before continuing. Common prerequisites:

| Platform | Required Tools |
|----------|---------------|
| **Zeabur** | Docker, Zeabur CLI (`npm i -g zeabur`), GitHub account |
| **Cloud Run** | Docker, `gcloud` CLI (authenticated), GCP project with billing enabled |

---

## Step 2: Test Locally First

Before deploying to the cloud, verify the production build works on your machine:

```bash
docker compose up --build -d
```

Once running, verify:

- Visit `http://localhost:3000` — you should see the landing page (the app's homepage returns 200)
- Sign in with a demo account (e.g. `admin@example.com` / `Admin123!`) and confirm `/dashboard` loads

If either check fails, fix the issue locally before deploying. Common problems:

- **Port conflict**: Another process is using port 3000
- **Missing `.env`**: Run `make setup` to generate environment files
- **Database migration error**: Check `next-app/.env` has correct `DATABASE_URL`

Run `docker compose down` to stop the local production stack when done.

---

## Step 3: First Deploy

### Option A: Zeabur (Recommended for Beginners)

```bash
make deploy PLATFORM=zeabur ARGS="--first-time"
```

**What happens at each gate:**

1. **Pre-flight check** — verifies Docker is running, Zeabur CLI is authenticated
2. **Build check** — builds the production Docker image locally
3. **Environment check** — confirms required env vars are set in Zeabur dashboard
4. **Deploy** — pushes to Zeabur and waits for healthy status
5. **Smoke test** — loads the app homepage to confirm the app is up
6. **Post-deploy** — runs database migrations if needed

**Where to find your app URL:**

The app deploys as a **single Next.js service** (`next-app/` with a `zbpack.json`).

1. Open [Zeabur Dashboard](https://dash.zeabur.com)
2. Select your project
3. Click the **next-app** service → **Domains** tab → copy the URL

**How to check logs:**

1. Zeabur Dashboard → select the service → **Logs** tab
2. Or via CLI: `zeabur logs --service next-app`

**Setting environment variables:**

1. Zeabur Dashboard → select the service → **Variables** tab
2. Required variables:
   - `DATABASE_URL` — auto-set if using Zeabur PostgreSQL add-on (plain `postgresql://user:pass@host:port/db`)
   - `AUTH_SECRET` — Auth.js v5 session/JWT signing key; generate with `openssl rand -hex 32` (or `npx auth secret`)
   - `NEXT_PUBLIC_*` — any public, build-time vars your app needs (baked in **before** building)

### Option B: Cloud Run

```bash
make deploy PLATFORM=cloudrun ARGS="--first-time"
```

**Database choice:**

| Option | Cost | Setup |
|--------|------|-------|
| **Cloud SQL** | ~$7/month (smallest instance) | `gcloud sql instances create ...` — managed, automatic backups |
| **Neon** (free tier) | $0 | Sign up at [neon.tech](https://neon.tech), copy connection string |
| **Supabase** (free tier) | $0 | Sign up at [supabase.com](https://supabase.com), copy connection string |

For free-tier databases (Neon/Supabase), set `DATABASE_URL` as a Cloud Run environment variable pointing to the external database.

The app deploys as a **single container image** — one Cloud Run service (here named `next-app`).

**Where to find your service URL:**

```bash
# List all Cloud Run services and their URLs
gcloud run services list --format="table(SERVICE,URL)"
```

Or visit the [Cloud Run Console](https://console.cloud.google.com/run).

**How to check logs:**

```bash
# App logs
gcloud run logs read --service=next-app --limit=50

# Or use Cloud Logging in the GCP Console
```

**Setting environment variables:**

```bash
# Set env vars on the app service
gcloud run services update next-app \
  --set-env-vars="AUTH_SECRET=$(openssl rand -hex 32)" \
  --set-env-vars="DATABASE_URL=postgresql://user:pass@host/db"

# NEXT_PUBLIC_* vars are baked at build time — pass them when you build the image
```

> **Important**: `NEXT_PUBLIC_*` vars are baked at build time. If you change one, you must rebuild and redeploy the image.

---

## Step 4: Verify Your Deploy

After deploying, verify the app is running:

```bash
# Check the app responds
open https://your-app-url
# Expected: landing page loads correctly
```

**Verification checklist:**

- [ ] Landing page loads with correct styling (homepage returns 200)
- [ ] Sign-up flow works (creates a new user)
- [ ] Sign-in flow works (Auth.js v5 establishes a JWT session)
- [ ] An authenticated page (e.g. `/dashboard`) loads after signing in
- [ ] Demo logins work: `admin@example.com / Admin123!`, `editor@example.com / Editor123!`, `viewer@example.com / Viewer123!`

---

## Step 5: Subsequent Deploys

After the first deploy, redeployments are simpler:

```bash
make deploy ARGS="--redeploy"
```

**What this does:**

1. Builds a new Docker image
2. Pushes to your platform
3. Runs Drizzle migrations if there are new ones (`pnpm db:generate` then `pnpm db:migrate`, from `next-app/`)
4. Smoke-tests the app homepage

**For Zeabur users**: If you enabled auto-deploy, simply `git push` to trigger a new deployment.

**For Cloud Run users**: You can also set up continuous deployment via Cloud Build or GitHub Actions.

---

## Step 6: Custom Domain (Optional)

### Zeabur

1. Zeabur Dashboard → select service → **Domains** tab
2. Click **Add Custom Domain**
3. Add a CNAME record at your DNS provider pointing to the Zeabur domain
4. SSL certificate is provisioned automatically

### Cloud Run

```bash
# Map a custom domain
gcloud run domain-mappings create \
  --service=next-app \
  --domain=your-domain.com \
  --region=your-region

# Follow the DNS instructions printed by the command
# SSL certificate is provisioned automatically (may take a few minutes)
```

---

## Troubleshooting

### Common Issues

| Problem | Symptom | Fix |
|---------|---------|-----|
| **NEXT_PUBLIC_* wrong** | Wrong value baked into the client bundle | Set the `NEXT_PUBLIC_*` var **before** building, then rebuild — these are baked at build time |
| **Migration not run** | 500 errors, "relation does not exist" in logs | Run `pnpm db:migrate` (from `next-app/`); check logs for migration errors |
| **CORS error** | Browser blocks a request with "CORS policy" error | Generally N/A — the app is a single same-origin Next.js service talking to its own Server Actions / Route Handlers. If you see this, it's from a third-party call, not client↔server |
| **Cold start timeout** | First request after idle is very slow or times out | Cloud Run: set `--min-instances=1` to keep one instance warm (~$3/month extra) |
| **DB connection refused** | App returns 500, logs show "connection refused" | Check `DATABASE_URL` format: `postgresql://user:pass@host:port/dbname` (Drizzle / postgres-js — no `+asyncpg`) |
| **Build fails** | Deploy command errors during build step | Run `docker compose up --build -d` locally first to catch build errors |
| **SSL not working** | Browser shows "not secure" warning | Wait 5-10 minutes for certificate provisioning; check DNS records are correct |
| **Out of memory** | Service crashes or restarts frequently | Increase memory limit: Zeabur dashboard or `gcloud run services update --memory=512Mi` |

### Platform-Specific Issues

**Zeabur:**

- **"Service not found"**: Make sure you linked the correct GitHub repo in the Zeabur dashboard
- **Environment variable not taking effect**: Redeploy after changing variables (click "Redeploy" button)
- **Database connection fails**: Use the connection string from the Zeabur PostgreSQL add-on, not a custom one

**Cloud Run:**

- **"Permission denied"**: Run `gcloud auth login` and ensure your account has the Cloud Run Admin role
- **"Billing not enabled"**: Enable billing at [GCP Console](https://console.cloud.google.com/billing)
- **Image push fails**: Run `gcloud auth configure-docker` to set up Docker authentication for GCR/Artifact Registry
- **Service won't start**: Check `gcloud run logs read --service=next-app` for startup errors

---

## Next Steps

- Read the [Deploy Decision Guide](deploy-guide.md) if you want to switch platforms
- Run `make doctor-production` to audit your production configuration
- Run `make verify` to check post-clone customization is complete
