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
make docker-prod
```

Once running, verify:

- Visit `http://localhost:3000` — you should see the landing page
- Visit `http://localhost:8080/health` — you should get `{"status": "ok"}`

If either check fails, fix the issue locally before deploying. Common problems:

- **Port conflict**: Another process is using port 3000 or 8080
- **Missing `.env`**: Run `make setup` to generate environment files
- **Database migration error**: Check `server/.env` has correct `DATABASE_URL`

Press `Ctrl+C` to stop the local production stack when done.

---

## Step 3: First Deploy

### Option A: Zeabur (Recommended for Beginners)

```bash
make deploy PLATFORM=zeabur ARGS="--first-time"
```

**What happens at each gate:**

1. **Pre-flight check** — verifies Docker is running, Zeabur CLI is authenticated
2. **Build check** — builds production Docker images locally
3. **Environment check** — confirms required env vars are set in Zeabur dashboard
4. **Deploy** — pushes to Zeabur and waits for healthy status
5. **Smoke test** — hits the `/health` endpoint to confirm the server is up
6. **Post-deploy** — runs database migrations if needed

**Where to find your app URL:**

1. Open [Zeabur Dashboard](https://dash.zeabur.com)
2. Select your project
3. Click the **server** service → **Domains** tab → copy the URL
4. Click the **client** service → **Domains** tab → copy the URL

**How to check logs:**

1. Zeabur Dashboard → select service → **Logs** tab
2. Or via CLI: `zeabur logs --service server`

**Setting environment variables:**

1. Zeabur Dashboard → select service → **Variables** tab
2. Required variables:
   - `DATABASE_URL` — auto-set if using Zeabur PostgreSQL add-on
   - `SECRET_KEY` — generate with `openssl rand -hex 32`
   - `REFRESH_SECRET_KEY` — generate with `openssl rand -hex 32`
   - `ALLOWED_ORIGINS` — your client URL (e.g., `https://your-app.zeabur.app`)
   - `VITE_API_URL` — your server URL (set on the **client** service, **before** building)

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

**Where to find service URLs:**

```bash
# List all Cloud Run services and their URLs
gcloud run services list --format="table(SERVICE,URL)"
```

Or visit the [Cloud Run Console](https://console.cloud.google.com/run).

**How to check logs:**

```bash
# Server logs
gcloud run logs read --service=server --limit=50

# Client logs
gcloud run logs read --service=client --limit=50

# Or use Cloud Logging in the GCP Console
```

**Setting environment variables:**

```bash
# Set env vars on the server service
gcloud run services update server \
  --set-env-vars="SECRET_KEY=$(openssl rand -hex 32)" \
  --set-env-vars="REFRESH_SECRET_KEY=$(openssl rand -hex 32)" \
  --set-env-vars="DATABASE_URL=postgresql+asyncpg://user:pass@host/db" \
  --set-env-vars="ALLOWED_ORIGINS=https://your-client-url.run.app"

# Set VITE_API_URL on the client service (requires rebuild)
gcloud run services update client \
  --set-env-vars="VITE_API_URL=https://your-server-url.run.app"
```

> **Important**: `VITE_API_URL` is baked at build time. If you change it, you must rebuild and redeploy the client.

---

## Step 4: Verify Your Deploy

After deploying, verify both services are running:

```bash
# Check server health
curl https://your-server-url/health
# Expected: {"status": "ok"}

# Check client
open https://your-client-url
# Expected: landing page loads correctly
```

**Verification checklist:**

- [ ] `/health` returns `{"status": "ok"}`
- [ ] Landing page loads with correct styling
- [ ] Sign-up flow works (creates a new user)
- [ ] Sign-in flow works (returns JWT tokens)
- [ ] API calls from client reach the server (no CORS errors in browser console)

---

## Step 5: Subsequent Deploys

After the first deploy, redeployments are simpler:

```bash
make deploy ARGS="--redeploy"
```

**What this does:**

1. Builds new Docker images
2. Pushes to your platform
3. Runs database migrations (if any new Alembic revisions)
4. Smoke-tests the `/health` endpoint

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
  --service=client \
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
| **VITE_API_URL wrong** | Client calls wrong API URL, network errors in browser console | Set `VITE_API_URL` on the client service **before** building, then rebuild |
| **Migration not run** | 500 errors on API calls, "relation does not exist" in logs | Check startup command includes `alembic upgrade head`, check logs for migration errors |
| **CORS error** | Browser blocks requests with "CORS policy" error | Set `ALLOWED_ORIGINS` on the server to match your client URL exactly (including `https://`) |
| **Cold start timeout** | First request after idle is very slow or times out | Cloud Run: set `--min-instances=1` to keep one instance warm (~$3/month extra) |
| **DB connection refused** | Server returns 500, logs show "connection refused" | Check `DATABASE_URL` format: `postgresql+asyncpg://user:pass@host:port/dbname` |
| **Build fails** | Deploy command errors during build step | Run `make docker-prod` locally first to catch build errors |
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
- **Service won't start**: Check `gcloud run logs read --service=server` for startup errors

---

## Next Steps

- Set up [CI/CD pipeline](ci-explained.md) for automated testing and deployment
- Read the [Deploy Decision Guide](deploy-guide.md) if you want to switch platforms
- Run `make doctor-production` to audit your production configuration
- Run `make verify` to check post-clone customization is complete
