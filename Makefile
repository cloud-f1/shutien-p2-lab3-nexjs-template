# AI App Template — Root Makefile (Next.js 16 single-app stack)
# Quick start:  make local-setup   (first time)  →  make local   (every run)
#               make help          (all targets)
#
# The app lives entirely in next-app/ (App Router + Drizzle + Auth.js). The old
# FastAPI server/ + Vite client/ stack was removed — there are no server/client
# targets, no Alembic, no pytest, no OpenAPI codegen.

NEXT := next-app

.PHONY: help go dev local local-setup local-infra local-db local-env local-down \
        dev-docs setup-dev-docs \
        migrate db-generate db-seed db-test-migrate db-studio db-backup \
        test test-coverage test-e2e lint typecheck ci-all smoke guard-selftest \
        docker-up docker-down docker-logs docker-ps docker-clean \
        doctor-deploy deploy install-tools install-deploy-tools \
        new-project init reset drift-check new-domain

.DEFAULT_GOAL := help

# ─── Zero-config happy path ──────────────────────────────────────────────
go: ## First-time: install + migrate + seed, then run the dev server
	@$(MAKE) local-setup
	@echo ""
	@echo "✅ Setup complete — starting the dev server…"
	@$(MAKE) local

# ─── Next.js local run (host HMR against Dockerized Postgres + Mailpit) ───
local: local-env local-infra ## ⭐ Local dev — Docker infra + Next.js on http://localhost:3000
	@echo "▶ Next.js dev → http://localhost:3000  (Mailpit inbox: http://localhost:8025)"
	@cd $(NEXT) && pnpm dev

dev: local ## Alias for `make local`

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

# ─── Dev-docs (VitePress site → Cloudflare Pages) ─────────────────────────
dev-docs: ## Run the dev-docs site locally
	cd dev-docs && pnpm dev

setup-dev-docs: ## Install dev-docs deps
	cd dev-docs && pnpm install
	@echo "✅ Dev-docs ready."

# ─── Database (Drizzle / drizzle-kit) ─────────────────────────────────────
migrate: ## Apply Drizzle migrations (next-app)
	cd $(NEXT) && pnpm db:migrate

db-generate: ## Generate a Drizzle migration from the schema (drizzle-kit generate)
	cd $(NEXT) && pnpm db:generate

db-seed: ## Seed demo data (dev-only; refuses NODE_ENV=production)
	cd $(NEXT) && pnpm db:seed

db-test-migrate: ## Apply ALL migrations to a throwaway DB + assert tables (fresh-DB gate)
	cd $(NEXT) && pnpm db:test-migrate

db-studio: ## Open Drizzle Studio
	cd $(NEXT) && pnpm db:studio

db-backup: ## Backup the local Postgres (Docker) to backups/
	@bash scripts/db-backup.sh

# ─── Testing & quality gates ──────────────────────────────────────────────
test: ## Run Vitest unit tests (next-app)
	cd $(NEXT) && pnpm test

test-coverage: ## Run Vitest with coverage (>=80% on the db-free layer)
	cd $(NEXT) && pnpm test:coverage

test-e2e: ## Run Playwright e2e (needs DB seeded + dev server)
	cd $(NEXT) && pnpm test:e2e

lint: ## ESLint the Next.js app
	cd $(NEXT) && pnpm lint

typecheck: ## tsc --noEmit (next-app)
	cd $(NEXT) && pnpm typecheck

ci-all: ## Full pre-merge gate: repo hygiene + typecheck + lint + unit (+ e2e with --e2e)
	@bash scripts/pre-merge-check.sh $(ARGS)

smoke: ## Full verification surface (build/test/e2e/registry/vitepress; --vrt for visual)
	@bash scripts/smoke.sh $(ARGS)

guard-selftest: ## Fail-open canary: assert stop-verifier still BLOCKS + run rule fixtures
	@echo "🛡  stop-verifier fail-open canary..."
	@bash scripts/hooks/tests/test-stop-verifier-canary.sh
	@echo "🛡  blocking-rule fixture suites..."
	@for t in scripts/hooks/tests/test-rule-*.sh; do echo "--- $$t ---"; bash "$$t" || exit 1; done
	@echo "✅ Guard self-test passed — no fail-open detected."

# ─── Docker full stack (postgres + mailpit + migrate + web) ───────────────
docker-up: ## Build & start the full stack in Docker → http://localhost:3000
	docker compose up --build -d
	@echo "✅ App http://localhost:3000 · Mailpit http://localhost:8025"

docker-down: ## Stop the Docker stack
	@docker compose down 2>/dev/null || true
	@echo "✅ Docker stack stopped."

docker-logs: ## Tail Docker stack logs
	docker compose logs -f

docker-ps: ## Show running containers
	@docker compose ps 2>/dev/null || echo "  (not running)"

docker-clean: ## Prune Docker containers, images, and optionally volumes
	@bash scripts/docker-clean.sh

# ─── Deploy ───────────────────────────────────────────────────────────────
doctor-deploy: ## Check deploy prerequisites for the chosen platform
	@bash scripts/doctor-deploy.sh $(PLATFORM)

deploy: ## How to deploy (Zeabur primary · GCP Cloud Run Road 2)
	@echo ""
	@echo "Deploy this Next.js app:"
	@echo "  • Use the \`deploy-config\` skill (interactive, both roads), or:"
	@echo "  • Zeabur (primary)     → bash deploy/deploy-zeabur.sh   ·  docs/guides/deployment-zeabur.md"
	@echo "  • GCP Cloud Run (Road 2) → docs/guides/deployment-gcp.md"
	@echo "  • Verify prereqs first → make doctor-deploy PLATFORM=zeabur|cloudrun"
	@echo ""

install-deploy-tools: ## Install/verify the deploy toolchain (Zeabur plugin + CLI; checks gcloud/node/pnpm/docker)
	@bash scripts/install-deploy-tools.sh

install-tools: ## Install required dev tools (macOS — Homebrew: node, pnpm, docker)
	@echo "📦 Installing development tools…"
	@command -v brew >/dev/null 2>&1 || { echo "❌ Homebrew required: https://brew.sh"; exit 1; }
	brew install node pnpm docker || true
	@command -v pnpm >/dev/null 2>&1 || npm install -g pnpm
	@echo "✅ Tools installed. Run 'make local-setup' to set up the app."

# ─── Template lifecycle ────────────────────────────────────────────────────
new-project: ## Archive template epics to _archive/ and start fresh from E1 (preserves history)
	@echo "📦 make new-project — archive template epics, start from E1"
	@bash scripts/template-reset.sh --archive
	@echo "✅ Template epics archived. Next: /athena:spec E1 <your-first-feature>"

init: ## Post-clone setup: reset template history → install + migrate + seed (run once)
	@if [ -f .initialized ]; then \
		echo "⚠  Already initialized. Re-run will reset project."; \
		read -r -p "Continue? [y/N] " response; \
		if [ "$$response" != "y" ] && [ "$$response" != "Y" ]; then exit 0; fi; \
	fi
	@bash scripts/template-reset.sh --yes
	@$(MAKE) local-setup
	@touch .initialized
	@echo "✅ Init complete! Run 'make local' to start developing."

reset: ## Reset template to clean state (run once after cloning)
	@branch_count=$$(ls .git/refs/heads/ 2>/dev/null | wc -l | tr -d ' '); \
	if [ "$$branch_count" -gt 1 ]; then \
		echo "⚠️  Found $$branch_count local branches — this looks like an active project."; \
		echo "   The reset script is intended for freshly cloned templates."; echo ""; \
	fi
	@bash scripts/template-reset.sh

new-domain: ## Scaffold a new domain — use the /athena:domain command (NAME=notes)
	@echo "Scaffold a domain with the Athena command:  /athena:domain NAME=$(or $(NAME),<name>)"
	@echo "  → Drizzle table (lib/schema/) + Zod (lib/validations/) + Server Actions (actions/)"
	@echo "    + dashboard page (app/(dashboard)/) + Vitest unit test, modeled on the items domain."

# ─── Plugin sync ───────────────────────────────────────────────────────────
drift-check: ## Check athena-core drift (dry-run sync; exits non-zero if diff detected)
	@echo "Checking athena-core drift…"
	@bash scripts/sync-to-plugin.sh
	@echo "Drift check complete."

# ─── Help ──────────────────────────────────────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
