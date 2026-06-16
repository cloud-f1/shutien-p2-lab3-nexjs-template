# Quickstart

> From clone to running dev server in as few as **2 commands**.

---

## Fastest Start: `make go`

```bash
git clone https://github.com/your-org/ai-coding-template.git
cd ai-coding-template
make go
```

`make go` automatically completes all of the following steps:

1. Checks prerequisites (Node >= 22, pnpm, Docker)
2. Installs all dependencies (pnpm install)
3. Generates `next-app/.env` (with auto-generated JWT/Auth.js secrets)
4. Starts PostgreSQL + Mailpit (Docker)
5. Runs database migrations (Drizzle)
6. Seeds the demo accounts
7. Starts the Next.js dev server

When complete:

- **App**: `http://localhost:3000` (Next.js dev server — open this and explore the landing page / dashboard)
- **Mailpit**: `http://localhost:8025` (Development email UI)

> **First time?** Open `http://localhost:3000` and explore the landing page and dashboard to get a feel for the template's features.

### Docker-Only Start (No Node Installation Required)

If you only have Docker, you can start the entire dev environment (Postgres + app + mailpit) with a single command:

```bash
docker compose up --build -d
```

This starts PostgreSQL + the Next.js app (with auto-migration and hot-reload) + Mailpit, without needing to install Node locally.

- **App**: `http://localhost:3000` (Next.js, hot-reload)
- **Mailpit**: `http://localhost:8025`

> **macOS Performance Tip**: Docker volume mounts can be slow on macOS. If hot-reload feels sluggish, consider using [mutagen](https://mutagen.io/) for acceleration.

---

> **Alternative: Interactive Site Builder**
>
> If you'd like to start with an interactive wizard (customise project name, theme, feature modules, etc.),
> run `pnpm new-site` after cloning. This is the CLI tool created in E21,
> which guides you through project initialisation. Run `make go` afterwards to start.
> See [E21 details](../../epics/EPIC_INDEX.md).

---

## Manual Setup (Advanced Users)

Below are the individual steps behind `make go`, for users who want more detail or custom configuration.

### Prerequisites

Make sure the following tools are installed on your system:

| Tool | Minimum Version | Purpose |
|------|-----------------|---------|
| Node.js | >= 22 | Next.js build and CLI tools |
| pnpm | >= 8 | Node package management |
| Docker | Latest | Database (PostgreSQL container) + full local stack |
| git | >= 2 | Version control |

> Run `make check-prereqs` to verify all tool versions at once.

### Installation

**macOS** (using Homebrew):

```bash
# Node.js (recommended via nvm for version management)
brew install nvm
nvm install 22
nvm use 22

# pnpm
npm install -g pnpm

# Docker
brew install --cask docker

# git (usually pre-installed on macOS)
brew install git
```

**Linux (Ubuntu/Debian)**:

```bash
# Node.js (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install 22
nvm use 22

# pnpm
npm install -g pnpm

# Docker
# See https://docs.docker.com/engine/install/

# git
sudo apt-get install git
```

### Verify Versions

```bash
node --version    # Should show v22.x.x or higher
pnpm --version    # Should show 8.x.x or higher
docker --version  # Should show a version number
git --version     # Should show 2.x.x or higher
```

---

### Step 1: Install Dependencies

The app lives in `next-app/`. Install its Node dependencies with pnpm.

```bash
# Install Node dependencies (run from next-app/)
cd next-app && pnpm install && cd ..
```

> `pnpm install` reads `next-app/package.json` and installs all dependencies
> (including dev dependencies) into `next-app/node_modules/`.

---

### Step 2: Database Setup

```bash
# Start PostgreSQL + Mailpit (Docker)
make db

# Or manually:
docker compose up -d db mailpit
```

> Default credentials are `saas_user` / `saas_pass`, database name `saas_dev`.
> Mailpit UI is at `http://localhost:8025`.

### Configure Environment Variables

```bash
# Auto-generate (with random secrets):
make ensure-env

# Or manually copy:
cp next-app/.env.example next-app/.env
# Then edit AUTH_SECRET (recommended: use openssl rand -hex 32)
```

---

### Step 3: Run Database Migrations

```bash
make migrate

# Or manually, from next-app/:
cd next-app && pnpm db:generate && pnpm db:migrate && cd ..
```

> `pnpm db:generate` creates Drizzle migration files from the schema, and
> `pnpm db:migrate` applies them to PostgreSQL.

---

### Step 4: Seed Demo Accounts

```bash
# From next-app/:
cd next-app && pnpm db:seed && cd ..
```

> **Seed Accounts**: After seeding, the system includes three built-in test accounts (3-tier RBAC):
>
> | Account | Password | Role |
> |---------|----------|------|
> | `admin@example.com` | `Admin123!` | Admin |
> | `editor@example.com` | `Editor123!` | Editor |
> | `viewer@example.com` | `Viewer123!` | Viewer |

---

### Step 5: Start Dev Server

```bash
make dev

# Or directly, from next-app/:
cd next-app && pnpm dev
```

This serves the entire app — UI, Server Actions, and Route Handlers (`app/api`) — on `http://localhost:3000`.

### Verification

| Service | URL | Expected Result |
|---------|-----|-----------------|
| App | `http://localhost:3000` | Landing Page + Dashboard + API routes |
| Mailpit | `http://localhost:8025` | Development email UI |

---

### Step 6: Run Tests

```bash
make test

# Or directly, from next-app/:
cd next-app && pnpm test
```

> **Coverage Gate**: This project requires test coverage of **>= 80%**. Falling below this threshold blocks deployment.
>
> View the coverage report:
>
> ```bash
> # From next-app/:
> cd next-app && pnpm test:coverage && cd ..
> ```
>
> **End-to-end tests** run with Playwright (seed the DB first):
>
> ```bash
> # From next-app/:
> cd next-app && pnpm db:seed && pnpm test:e2e && cd ..
> ```
>
> **Test Plan Template**: For a comprehensive testing strategy — including a risk matrix, RBAC compatibility matrix, and "when to stop testing" criteria — see [`docs/templates/test-plan-template.md`](../../templates/test-plan-template.md).

#### Test Layout

```
next-app/
  lib/**, actions/**   # Vitest unit tests — co-located *.test.ts(x)
                       #   (covers lib/validations, lib/is-admin, actions/)
  e2e/                 # Playwright e2e specs — *.spec.ts
```

**When to use which:**

| Type | Use when... | Example |
|------|------------|---------|
| Vitest unit (`*.test.ts(x)`) | Testing pure functions / Server Actions, no real browser | Password validator, `is-admin` RBAC check, action input parsing |
| Playwright e2e (`e2e/*.spec.ts`) | Testing full user flows end-to-end in a browser | Login + create resource + verify ownership, RBAC redirects |

> Run a subset: `pnpm test <path-or-pattern>` (Vitest) or `pnpm test:e2e <spec>` (Playwright).

---

## FAQ (Frequently Asked Questions)

### PostgreSQL Connection Failure

**Symptom**: `ConnectionRefusedError` or `could not connect to server`

**Solution**:

```bash
# Verify PostgreSQL is running
# macOS:
brew services list | grep postgresql

# Linux:
sudo systemctl status postgresql

# Verify the database exists
psql -l | grep saas_dev
```

If the database doesn't exist, run `createdb saas_dev` again.

### pnpm install Failure

**Symptom**: Permission errors or lockfile conflicts

**Solution**:

```bash
# Clear cache and reinstall (from next-app/)
cd next-app
pnpm store prune
rm -rf node_modules
pnpm install
cd ..
```

### Port Conflict

**Symptom**: `Address already in use`

**Solution**:

```bash
# Find the process occupying the port
lsof -i :3000  # the app
lsof -i :8025  # Mailpit
lsof -i :5432  # PostgreSQL

# Kill the process
kill -9 <PID>
```

Or change the startup port:

```bash
# Run the app on a different port (from next-app/)
cd next-app && pnpm dev -- -p 3001
# Or:
PORT=3001 pnpm dev
```

### Docker Compose Startup Issues

If you're using Docker to start PostgreSQL:

```bash
# Check container status
docker compose ps

# View logs
docker compose logs db

# Restart
docker compose down
docker compose up -d db
```

---

## Next Steps

Congratulations, you've successfully set up the development environment! Recommended next steps:

1. **Run `make verify`** — Check that all template placeholders are customized
2. **Open [`http://localhost:3000`](http://localhost:3000)** — Explore the landing page and dashboard
3. **[First Epic Walkthrough](first-epic-walkthrough.md)** — Step-by-step guide to building a custom domain
4. **[TECHSTACK.md](../../../TECHSTACK.md)** — Deep dive into the technical architecture
5. **[EPIC_INDEX.md](../../epics/EPIC_INDEX.md)** — View all Epic development progress
6. **[Learning Path](learning-path.md)** — See the full recommended reading order for all guides
