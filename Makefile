# AI-Coding-Template — Root Makefile
# Usage: make go        (zero-config: prereqs → setup → db → migrate → dev)
#        make dev       (run server + client in parallel)
#        make setup     (first-time setup for new developers)
#        make test      (run all test suites)

.PHONY: go init new-site check-prereqs ensure-env ensure-db generate-types dev server client dev-docs local local-setup local-infra local-db local-env local-down setup setup-server setup-client setup-dev-docs test test-server test-client test-migrations verify-migrations guard-selftest lint flaky ci-all db db-stop docker-dev docker-prod docker-down docker-logs docker-ps doctor doctor-production doctor-deploy verify tutorial new-domain docker-clean db-backup deploy install-tools install-deploy-tools reset strip error-budget drift-check help

# ─── Zero-Config Startup ─────────────────────
# `make go` is the single-command happy path for first-time developers.
# It checks prerequisites, sets up deps, starts the DB, migrates, and launches dev.

go: check-prereqs ensure-env setup ensure-db migrate generate-types ## One command to rule them all
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  🚀 Ready! Open http://localhost:5173"
	@echo "     Getting started:  http://localhost:5173/getting-started"
	@echo "     API docs:         http://localhost:8080/docs"
	@echo ""
	@echo "  💡 First time? Visit /getting-started for an interactive tour."
	@echo "     Or run: make tutorial"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@$(MAKE) dev

# ─── Post-Clone Init ────────────────────────

new-project: ## Archive template epics to _archive/ and start fresh from E1 (preserves history as reference)
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  📦 make new-project — Archive template epics, start from E1"
	@echo ""
	@echo "  This preserves the template's epic history under"
	@echo "  docs/epics/_archive/<date>-from-template/ and resets"
	@echo "  EPIC_INDEX + context docs to blank templates."
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@bash scripts/template-reset.sh --archive
	@echo ""
	@echo "✅ Template epics archived. Your project's E1 is ready."
	@echo "   Next: /athena:spec E1 <your-first-feature>"

init: ## Post-clone setup: reset → customize → deps → DB → migrate (run once)
	@if [ -f .initialized ]; then \
		echo "⚠  Already initialized. Re-run will reset project."; \
		read -r -p "Continue? [y/N] " response; \
		if [ "$$response" != "y" ] && [ "$$response" != "Y" ]; then exit 0; fi; \
	fi
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  🏗  make init — Post-Clone Setup"
	@echo ""
	@echo "  This will:"
	@echo "    1. Reset template history (clean slate)"
	@echo "    2. Check prerequisites (node, pnpm, python, uv, docker)"
	@echo "    3. Launch Site Builder (name, DB, theme, branding)"
	@echo "    4. Install dependencies + start DB + migrate + generate types"
	@echo ""
	@echo "  Config saved to: .build-manifest.yaml"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@bash scripts/template-reset.sh --yes
	@echo "📦 Installing root dependencies..."
	@pnpm install
	@$(MAKE) check-prereqs
	@$(MAKE) new-site
	@$(MAKE) setup ensure-db migrate generate-types
	@touch .initialized
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  ✅ Init complete! Run 'make go' to start developing."
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

new-site: ## Launch interactive Site Builder CLI
	@pnpm run new-site

# ─── Prerequisites ──────────────────────────

check-prereqs: ## Validate dev tools (node, pnpm, python, uv, docker)
	@bash scripts/check-prereqs.sh

ensure-env: ## Auto-generate server/.env if missing (with random secrets)
	@bash scripts/generate-env.sh

ensure-db: ## Start PostgreSQL via Docker if not already running
	@if docker compose ps --status running 2>/dev/null | grep -q "db"; then \
		echo "✅ PostgreSQL already running."; \
	else \
		echo "🐘 Starting PostgreSQL via Docker..."; \
		docker compose up -d db --wait || { \
			echo "❌ PostgreSQL failed to start. Check 'docker compose logs db'."; \
			exit 1; \
		}; \
		echo "✅ PostgreSQL ready."; \
	fi

generate-types: ## Generate TypeScript types from OpenAPI spec
	cd client && pnpm generate:types
	@echo "✅ TypeScript types generated."

# ─── Development ──────────────────────────────

dev: ## Run server + client concurrently
	@echo "Starting server (localhost:8080) + client (localhost:5173)..."
	@trap 'kill 0' EXIT; \
		$(MAKE) server & \
		$(MAKE) client & \
		wait

server: ## Run FastAPI dev server
	cd server && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8080

client: ## Run Vite dev server
	cd client && pnpm dev

dev-docs: ## Run dev-docs site
	cd dev-docs && pnpm dev

# ─── Next.js App — Local Run (current stack) ─────────────────
# Run the Next.js app on the host (fast HMR) against Dockerized Postgres + Mailpit.
# First time:  make local-setup        Then every run:  make local
NEXT := next-app

local: local-env local-infra ## ⭐ Local dev — Docker infra + Next.js on http://localhost:3000
	@echo "▶ Next.js dev → http://localhost:3000  (Mailpit inbox: http://localhost:8025)"
	@cd $(NEXT) && pnpm dev

local-setup: local-env local-infra ## First-time local setup — install deps + migrate + seed demo data
	cd $(NEXT) && pnpm install
	@$(MAKE) local-db
	@echo "✅ Local setup complete. Run 'make local' to start the dev server."

local-infra: ## Start Postgres + Mailpit in Docker (infra only; waits for DB health)
	docker compose up -d --wait postgres mailpit
	@echo "✅ Postgres localhost:5432 · Mailpit UI http://localhost:8025"

local-db: local-env ## Apply migrations + seed demo data (idempotent; tolerates an already-migrated DB)
	@cd $(NEXT) && set -a && . ./.env.local && set +a && \
		if pnpm db:migrate > /tmp/athena-migrate.log 2>&1; then \
			cat /tmp/athena-migrate.log; \
		elif grep -qiE "already exists|no migrations" /tmp/athena-migrate.log; then \
			echo "⚠ db:migrate — schema already present on this DB, skipping"; \
		else \
			cat /tmp/athena-migrate.log; echo "❌ db:migrate failed (see above)"; exit 1; \
		fi && \
		pnpm db:seed

local-env: ## Generate next-app/.env.local for local dev (only if missing)
	@if [ -f $(NEXT)/.env.local ]; then \
		echo "✅ $(NEXT)/.env.local already present (leaving as-is)"; \
	else \
		printf '%s\n' \
			'NEXT_PUBLIC_APP_URL=http://localhost:3000' \
			'NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true' \
			"AUTH_SECRET=$$(openssl rand -base64 32)" \
			'AUTH_URL=http://localhost:3000' \
			'AUTH_TRUST_HOST=true' \
			'DATABASE_URL=postgresql://saas_user:saas_pass@localhost:5432/saas_dev' \
			'SMTP_HOST=localhost' \
			'SMTP_PORT=1025' \
			'SMTP_SECURE=false' \
			'EMAIL_FROM=noreply@saas-dev.local' \
			> $(NEXT)/.env.local; \
		echo "✅ Wrote $(NEXT)/.env.local (localhost Postgres + Mailpit + fresh AUTH_SECRET)"; \
	fi

local-down: ## Stop the local Docker infra (Postgres + Mailpit)
	docker compose down
	@echo "✅ Local infra stopped."

# ─── Setup (first-time) ──────────────────────

setup: setup-server setup-client setup-dev-docs ## Full first-time setup
	@echo "\n✅ Setup complete. Run 'make dev' to start."

setup-server: ## Setup Python venv + deps via uv
	cd server && uv sync
	@echo "✅ Server ready."

setup-client: ## Install client deps
	cd client && pnpm install
	@echo "✅ Client ready."

setup-dev-docs: ## Install dev-docs deps
	cd dev-docs && pnpm install
	@echo "✅ Dev-docs ready."

# ─── Database ─────────────────────────────────

db: ## Start local Postgres via Docker
	docker compose up -d db
	@echo "Postgres: localhost:5432"
	@echo "Tip: for Mailpit email UI run: docker compose --profile mailpit up -d"

db-stop: ## Stop Docker services
	docker compose down

migrate: ## Run Alembic migrations
	cd server && uv run alembic upgrade head

# ─── Docker Full-Stack ───────────────────────

docker-dev: ## Start full stack in dev mode (hot-reload)
	@echo "🐳 Starting dev stack (hot-reload)..."
	@echo ""
	@echo "  Server:   http://localhost:8080"
	@echo "  Client:   http://localhost:5173"
	@echo "  API docs: http://localhost:8080/docs"
	@echo ""
	docker compose up

docker-prod: ## Build & start production stack (nginx + optimized images)
	@echo "🐳 Building production stack..."
	@echo ""
	@echo "  Server:   http://localhost:8080"
	@echo "  Client:   http://localhost:3000"
	@echo "  API docs: http://localhost:8080/docs"
	@echo ""
	docker compose -f docker-compose.prod.yml up --build

docker-down: ## Stop all Docker services (dev + prod)
	@docker compose down 2>/dev/null || true
	@docker compose -f docker-compose.prod.yml down 2>/dev/null || true
	@echo "✅ All Docker services stopped."

docker-logs: ## Tail dev stack logs
	docker compose logs -f

docker-ps: ## Show running Docker containers
	@echo "── Dev stack ──"
	@docker compose ps 2>/dev/null || echo "  (not running)"
	@echo ""
	@echo "── Prod stack ──"
	@docker compose -f docker-compose.prod.yml ps 2>/dev/null || echo "  (not running)"

# ─── Testing ──────────────────────────────────

test: test-server test-client ## Run all tests

test-server: ## Run pytest with coverage
	cd server && uv run pytest --cov=app --cov-report=term-missing -q

test-client: ## Run vitest with coverage
	cd client && pnpm test:run -- --coverage

guard-selftest: ## E204 — fail-open canary: assert stop-verifier still BLOCKS on every epic-branch form
	@echo "🛡  stop-verifier fail-open canary..."
	@bash scripts/hooks/tests/test-stop-verifier-canary.sh
	@echo "🛡  blocking-rule fixture suites..."
	@for t in scripts/hooks/tests/test-rule-*.sh; do echo "--- $$t ---"; bash "$$t" || exit 1; done
	@echo "✅ Guard self-test passed — no fail-open detected."

test-migrations: ## Run migration smoke tests against real PostgreSQL
	@echo "🐘 Starting test PostgreSQL (port 5433)..."
	@docker compose --profile test up test-db -d --wait
	@echo "✅ Test DB ready. Running migration smoke tests..."
	cd server && TEST_DATABASE_URL=postgresql+asyncpg://test:test@localhost:5433/test_db \
		uv run pytest tests/test_migration_smoke.py -v
	@echo "🧹 Stopping test DB..."
	@docker compose --profile test stop test-db

verify-migrations: ## Standalone PG round-trip migration check (Docker, no compose)
	@bash scripts/verify-pg-migrations.sh

lint: ## Lint server + client
	cd server && uv run ruff check . && uv run ruff format --check .
	cd client && npx tsc --noEmit

flaky: ## Detect flaky tests by running suites 3x and diffing results
	@echo "🔍 Running flaky test detection (3 runs each)..."
	@FLAKY_DIR=$$(mktemp -d /tmp/flaky-XXXXXX); \
	trap "rm -rf $$FLAKY_DIR" EXIT; \
	echo "── Server (pytest) ──"; \
	for i in 1 2 3; do \
		echo "  Run $$i/3..."; \
		cd server && uv run pytest --tb=no -q 2>&1 \
			| grep -E '^(PASSED|FAILED|ERROR|tests/)' \
			| sort > "$$FLAKY_DIR/server-$$i.txt"; \
		cd ..; \
	done; \
	echo "── Client (vitest) ──"; \
	for i in 1 2 3; do \
		echo "  Run $$i/3..."; \
		cd client && pnpm test:run 2>&1 \
			| grep -E '^\s*(✓|×|✕|FAIL|PASS|❌|✅)' \
			| sort > "$$FLAKY_DIR/client-$$i.txt"; \
		cd ..; \
	done; \
	echo ""; \
	echo "── Results ──"; \
	FOUND_FLAKY=0; \
	for suite in server client; do \
		if ! diff -q "$$FLAKY_DIR/$$suite-1.txt" "$$FLAKY_DIR/$$suite-2.txt" >/dev/null 2>&1 || \
		   ! diff -q "$$FLAKY_DIR/$$suite-1.txt" "$$FLAKY_DIR/$$suite-3.txt" >/dev/null 2>&1; then \
			echo "⚠️  Flaky tests in $$suite:"; \
			diff "$$FLAKY_DIR/$$suite-1.txt" "$$FLAKY_DIR/$$suite-2.txt" 2>/dev/null || true; \
			diff "$$FLAKY_DIR/$$suite-1.txt" "$$FLAKY_DIR/$$suite-3.txt" 2>/dev/null || true; \
			FOUND_FLAKY=1; \
		fi; \
	done; \
	if [ "$$FOUND_FLAKY" = "0" ]; then \
		echo "✅ No flaky tests detected (3 runs consistent)."; \
	fi

ci-all: ## Run full CI locally: lint → test-server → test-client
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  🏗  CI-ALL: Starting local CI pipeline"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@STEP="lint"; \
	echo "── Step 1/3: lint ──"; \
	$(MAKE) lint && \
	STEP="test-server" && \
	echo "── Step 2/3: test-server ──" && \
	$(MAKE) test-server && \
	STEP="test-client" && \
	echo "── Step 3/3: test-client ──" && \
	$(MAKE) test-client && \
	echo "" && \
	echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" && \
	echo "  ✅ CI-ALL: PASSED" && \
	echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" || \
	{ echo ""; \
	  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; \
	  echo "  ❌ CI-ALL: FAILED at $$STEP"; \
	  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; \
	  exit 1; }

# ─── Diagnostics ─────────────────────────────────

error-budget: ## Check error budget from server logs
	@bash scripts/checks/check-error-budget.sh $(LOG)

doctor: ## Check environment health (DB, secrets, ports, tools)
	@bash scripts/doctor.sh

doctor-production: ## Production readiness check (secrets, email, DB, OAuth)
	@bash scripts/doctor-production.sh

doctor-deploy: ## Check deploy prerequisites for chosen platform
	@bash scripts/doctor-deploy.sh $(PLATFORM)

verify: ## Verify template placeholders are customized (post-clone check)
	@bash scripts/verify-customization.sh

# ─── Onboarding ──────────────────────────────────

tutorial: ## Interactive tutorial: build your first endpoint in 5 minutes
	@bash scripts/tutorial.sh

new-domain: ## Create a new domain module + migration (usage: make new-domain NAME=notes)
	@test -n "$(NAME)" || { echo "Usage: make new-domain NAME=<name>"; exit 1; }
	@bash scripts/new-domain.sh $(NAME)

# ─── Docker Operations ─────────────────────────

docker-clean: ## Prune Docker containers, images, and optionally volumes
	@bash scripts/docker-clean.sh

db-backup: ## Backup PostgreSQL to backups/ directory
	@bash scripts/db-backup.sh

# ─── Deploy ──────────────────────────────────────

PLATFORM ?=

deploy: ## Deploy to platform (PLATFORM=zeabur|cloudrun|local, or auto-detect)
	@if [ -n "$(PLATFORM)" ]; then \
		DEPLOY_PLATFORM="$(PLATFORM)"; \
	elif [ -f .deploy-platform ]; then \
		DEPLOY_PLATFORM=$$(cat .deploy-platform | tr -d '[:space:]'); \
		echo "🔧 Using saved platform: $$DEPLOY_PLATFORM (from .deploy-platform)"; \
	else \
		echo ""; \
		echo "Deploy platform:"; \
		echo "  1. Zeabur (recommended for beginners)"; \
		echo "  2. GCP Cloud Run"; \
		echo "  3. Local production (docker-compose.prod.yml)"; \
		echo ""; \
		read -r -p "Choice [1/2/3]: " choice; \
		case "$$choice" in \
			1) DEPLOY_PLATFORM=zeabur ;; \
			2) DEPLOY_PLATFORM=cloudrun ;; \
			3) DEPLOY_PLATFORM=local ;; \
			*) echo "❌ Invalid choice: $$choice"; exit 1 ;; \
		esac; \
		echo "$$DEPLOY_PLATFORM" > .deploy-platform; \
		echo "✅ Saved platform to .deploy-platform (override with PLATFORM=)"; \
	fi; \
	case "$$DEPLOY_PLATFORM" in \
		zeabur)   bash scripts/deploy-zeabur.sh $(ARGS) ;; \
		cloudrun) bash scripts/deploy-cloudrun.sh $(ARGS) ;; \
		local)    docker compose -f docker-compose.prod.yml up --build ;; \
		*) echo "❌ Unknown platform: $$DEPLOY_PLATFORM (expected: zeabur, cloudrun, local)"; exit 1 ;; \
	esac

# ─── Install Tools ───────────────────────────────

install-tools: ## Install all required dev tools (macOS — uses Homebrew)
	@echo "📦 Installing development tools..."
	@command -v brew >/dev/null 2>&1 || { echo "❌ Homebrew required: https://brew.sh"; exit 1; }
	brew install node pnpm pyenv uv docker || true
	@command -v pnpm >/dev/null 2>&1 || npm install -g pnpm
	@command -v uv >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh
	@echo ""
	@echo "✅ Tools installed. Run 'make go' to start."

install-deploy-tools: ## Install/verify the deploy toolchain (Zeabur plugin + CLI; checks gcloud/node/pnpm/docker)
	@bash scripts/install-deploy-tools.sh

# ─── Template Reset ──────────────────────────────

reset: ## Reset template to clean state (run once after cloning)
	@branch_count=$$(ls .git/refs/heads/ 2>/dev/null | wc -l | tr -d ' '); \
	if [ "$$branch_count" -gt 1 ]; then \
		echo "⚠️  Warning: Found $$branch_count local branches. This looks like an active project."; \
		echo "   The reset script is intended for freshly cloned templates."; \
		echo ""; \
	fi
	@bash scripts/template-reset.sh

# ─── Plugin Sync ─────────────────────────────────

drift-check: ## Check athena-core drift (dry-run sync; exits non-zero if diff detected)
	@echo "Checking athena-core drift..."
	@bash scripts/sync-to-plugin.sh
	@echo "Drift check complete."

# ─── Strip Optional Files ───────────────────────

strip: ## Strip optional template files (legal, landing, guides, etc.)
	@bash scripts/strip-to-core.sh

# ─── Help ─────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
