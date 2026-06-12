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

1. Checks prerequisites (Node >= 22, pnpm, Python >= 3.12, uv, Docker)
2. Installs all dependencies (pnpm install + uv sync)
3. Generates `server/.env` (with auto-generated JWT secrets)
4. Starts PostgreSQL + Mailpit (Docker)
5. Runs database migrations
6. Generates TypeScript types
7. Starts frontend and backend dev servers

When complete:

- **Getting Started**: `http://localhost:5173/getting-started` (Interactive walkthrough — start here!)
- **Frontend**: `http://localhost:5173` (Vite dev server)
- **Backend API**: `http://localhost:8080/docs` (Swagger UI)
- **Mailpit**: `http://localhost:8025` (Development email UI)

> **First time?** Open `/getting-started` for a guided tour of the template's features, or run `make tutorial` for a 5-minute endpoint-building exercise.

### Docker-Only Start (No Node/Python Installation Required)

If you only have Docker, you can start the entire dev environment with a single command:

```bash
docker compose --profile dev up
```

This starts PostgreSQL + backend (with auto-migration) + frontend (with hot-reload), without needing to install Node or Python.

- **Frontend**: `http://localhost:5173` (Vite dev server, hot-reload)
- **Backend API**: `http://localhost:8080/docs`
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
| Node.js | >= 22 | Frontend build and CLI tools |
| pnpm | >= 8 | Node package management (workspace monorepo) |
| Python | >= 3.12 | Backend server |
| uv | Latest | Python package management (replaces pip) |
| Docker | Latest | Database (PostgreSQL container) |
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

# Python (recommended via pyenv for version management)
brew install pyenv
pyenv install 3.12
pyenv global 3.12

# uv — Python package manager
curl -LsSf https://astral.sh/uv/install.sh | sh

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

# Python (via pyenv)
curl https://pyenv.run | bash
pyenv install 3.12
pyenv global 3.12

# uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Docker
# See https://docs.docker.com/engine/install/

# git
sudo apt-get install git
```

### Verify Versions

```bash
node --version    # Should show v22.x.x or higher
pnpm --version    # Should show 8.x.x or higher
python --version  # Should show 3.12.x or higher
uv --version      # Should show a version number
docker --version  # Should show a version number
git --version     # Should show 2.x.x or higher
```

---

### Step 1: Install Dependencies

This project uses a **pnpm workspace monorepo** structure. The root `pnpm-workspace.yaml` manages the `client` and `dev-docs` sub-projects.

```bash
# Install Node dependencies (run from root — installs all workspace sub-projects)
pnpm install

# Install Python dependencies (enter the server directory)
cd server && uv sync && cd ..
```

> `uv sync` installs all dependencies (including dev dependencies) based on `pyproject.toml`
> and automatically creates a virtual environment at `server/.venv/`.

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
cp server/.env.example server/.env
# Then edit SECRET_KEY and REFRESH_SECRET_KEY (recommended: use openssl rand -hex 32)
```

---

### Step 3: Run Database Migrations

```bash
make migrate
```

> **Seed Accounts**: After migration, the system includes two built-in test accounts:
>
> | Account | Password | Role |
> |---------|----------|------|
> | `admin@test.com` | `Admin#Pass1` | Superuser |
> | `user@test.com` | `User#Pass1` | Regular user |

---

### Step 4: Generate TypeScript Types

```bash
make generate-types
```

---

### Step 5: Start Dev Server

```bash
make dev
```

Or start separately:

```bash
# Terminal 1 — Backend
cd server && uv run uvicorn app.main:app --reload

# Terminal 2 — Frontend
cd client && pnpm dev
```

### Verification

| Service | URL | Expected Result |
|---------|-----|-----------------|
| Frontend | `http://localhost:5173` | Landing Page |
| Backend API | `http://localhost:8080/health` | `{"status": "healthy"}` |
| Swagger UI | `http://localhost:8080/docs` | API documentation |
| Docker deployment | `http://localhost:3000` | Frontend (nginx) |

---

### Step 6: Run Tests

```bash
make test
```

> **Coverage Gate**: This project requires frontend and backend test coverage of **>= 80%**. Falling below this threshold blocks deployment.
>
> View coverage reports:
>
> ```bash
> # Backend
> cd server && uv run pytest --cov=app --cov-report=term-missing && cd ..
>
> # Frontend
> cd client && pnpm test:coverage && cd ..
> ```
>
> **Test Plan Template**: For a comprehensive testing strategy — including a risk matrix, RBAC compatibility matrix, and "when to stop testing" criteria — see [`docs/templates/test-plan-template.md`](../../templates/test-plan-template.md).

#### Server Test Directory Structure

```
server/tests/
  unit/            # Pure unit tests (no DB, no network)
  integration/     # Cross-domain, auth, DB flows
  contract/        # OpenAPI schema validation (E99)
  domains/         # Per-domain endpoint + schema tests
  services/        # Business logic tests
  regression/      # Bug regression tests
  guardrails/      # Security + permission boundary tests
  smoke/           # Critical-path quick tests
  conftest.py      # Shared fixtures
```

**When to use which directory:**

| Directory | Use when... | Example |
|-----------|------------|---------|
| `unit/` | Testing pure functions, no DB or network | Password validator, schema parsing |
| `integration/` | Testing cross-domain or auth flows end-to-end | Login + create resource + verify ownership |
| `contract/` | Validating API responses match OpenAPI spec | Response schema drift detection |
| `domains/<name>/` | Testing a single domain's endpoints + schemas | `POST /notes/` CRUD, pagination |
| `services/` | Testing business logic services in isolation | Billing calculation, notification dispatch |
| `regression/` | Preventing a specific bug from recurring | Fix for #42 — duplicate email race condition |
| `guardrails/` | Verifying security + permission boundaries | No PII in error responses, no tokens in URLs |
| `smoke/` | Quick critical-path validation for deploys | Health check, auth flow, DB connectivity |

> **Tip**: `make new-domain NAME=x` automatically creates `tests/domains/x/` with a test template. Existing `unit/` and `integration/` directories remain — the new structure is opt-in for domain-scoped tests.
>
> Run tests by directory: `cd server && uv run pytest tests/domains/billing/` to run only billing tests.

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
# Clear cache and reinstall
pnpm store prune
rm -rf node_modules client/node_modules dev-docs/node_modules
pnpm install
```

### Python Version Mismatch

**Symptom**: `pyproject.toml` requires `>=3.12` but system version is older

**Solution**:

```bash
# Install the correct version using pyenv
pyenv install 3.12
pyenv local 3.12

# Verify uv is using the correct Python
uv python list
```

### Port Conflict

**Symptom**: `Address already in use`

**Solution**:

```bash
# Find the process occupying the port
lsof -i :8000  # Backend
lsof -i :5173  # Frontend
lsof -i :5432  # PostgreSQL

# Kill the process
kill -9 <PID>
```

Or change the startup port:

```bash
# Use a different port for the backend
cd server && uv run uvicorn app.main:app --reload --port 8001

# Use a different port for the frontend
cd client && pnpm dev --port 3000
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
2. **Open [`/getting-started`](http://localhost:5173/getting-started)** — Interactive in-app walkthrough of the template
3. **Run `make tutorial`** — Build your first endpoint in 5 minutes
4. **[First Epic Walkthrough](first-epic-walkthrough.md)** — Step-by-step guide to building a custom domain
5. **[TECHSTACK.md](../../../TECHSTACK.md)** — Deep dive into the technical architecture
6. **[EPIC_INDEX.md](../../epics/EPIC_INDEX.md)** — View all Epic development progress
7. **[Learning Path](learning-path.md)** — See the full recommended reading order for all guides
