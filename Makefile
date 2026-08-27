# AI App Template — Root Makefile (Next.js 16 single-app stack)
# Quick start:  make local-setup   (first time)  →  make local   (every run)
#               make help          (all targets)
#
# The app lives entirely in next-app/ (App Router + Drizzle + Auth.js). The old
# FastAPI server/ + Vite client/ stack was removed — there are no server/client
# targets, no Alembic, no pytest, no OpenAPI codegen.

NEXT := next-app

.PHONY: help go dev local local-setup local-infra local-db local-env local-down \
        dev-docs setup-dev-docs dev-docs-preview dev-docs-build dev-docs-deploy \
        migrate db-generate db-seed db-test-migrate db-studio db-backup \
        test test-coverage test-e2e lint typecheck ci-all verify smoke guard-selftest hook-test \
        docker-up docker-down docker-logs docker-ps docker-clean \
        doctor-deploy deploy install-tools install-deploy-tools \
        image deploy-zeabur deploy-gcp db-migrate-prod \
        new-project init reset drift-check new-domain \
        staleness-check screenshot-refresh

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

dev-docs-preview: ## Run the dev-docs site locally with hot-reload (http://localhost:5173)
	cd dev-docs && pnpm dev

dev-docs-build: ## Install deps and build the dev-docs VitePress site
	cd dev-docs && pnpm install && pnpm build
	@echo "✅ Dev-docs built → dev-docs/.vitepress/dist/"

dev-docs-deploy: dev-docs-build ## Build + deploy dev-docs to Cloudflare Pages (requires CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)
	@test -n "$$CLOUDFLARE_API_TOKEN" || { echo "❌ CLOUDFLARE_API_TOKEN not set"; exit 1; }
	@test -n "$$CLOUDFLARE_ACCOUNT_ID" || { echo "❌ CLOUDFLARE_ACCOUNT_ID not set"; exit 1; }
	npx wrangler pages deploy dev-docs/.vitepress/dist \
		--project-name ai-coding-nexjs-template-docs \
		--branch main \
		--commit-dirty=true
	@echo "✅ Dev-docs deployed to Cloudflare Pages."

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

verify: ## One umbrella gate: staleness + pre-merge (typecheck·lint·unit) + orphan-export report + integration tests + dev-docs build
	@bash scripts/staleness-check.sh
	@bash scripts/memory/check-promotion-staleness.sh
	@bash scripts/pre-merge-check.sh $(ARGS)
	@echo "▶ check:orphans (non-strict — reports the known orphans, does not fail the gate)…" && pnpm --dir next-app check:orphans || true
	@echo "▶ test:int (gracefully skips if no reachable Postgres)…" && pnpm --dir next-app test:int
	@echo "▶ dev-docs build…" && cd dev-docs && pnpm install --frozen-lockfile --prefer-offline >/dev/null 2>&1 && pnpm build >/dev/null && echo "  ✓ dev-docs build clean"
	@echo "✅ make verify passed — identity + code + docs all green"

smoke: ## Full verification surface (build/test/e2e/registry/vitepress; --vrt for visual)
	@bash scripts/smoke.sh $(ARGS)

guard-selftest: ## Fail-open canary + full hook regression suite (all scripts/hooks/tests/test-*.sh)
	@echo "🛡  stop-verifier fail-open canary..."
	@bash scripts/hooks/tests/test-stop-verifier-canary.sh
	@$(MAKE) hook-test
	@echo "✅ Guard self-test passed — no fail-open detected."

hook-test: ## Run every scripts/hooks/tests/test-*.sh (not just the canary + rule fixtures)
	@echo "🛡  full hook regression suite..."
	@for t in scripts/hooks/tests/test-*.sh; do \
		case "$$t" in \
			*test-stop-verifier-canary.sh) continue ;; \
		esac; \
		echo "--- $$t ---"; \
		bash "$$t" || exit 1; \
	done

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
	@echo "  • Zeabur (primary)     → make deploy-zeabur (or bash deploy/deploy-zeabur.sh)  ·  docs/guides/deployment-zeabur.md"
	@echo "  • GCP Cloud Run (Road 2) → make image / make deploy-gcp   ·  docs/guides/deployment-gcp.md"
	@echo "  • Verify prereqs first → make doctor-deploy PLATFORM=zeabur|cloudrun"
	@echo "  • Run \`make verify\` before shipping — umbrella gate: staleness + typecheck/lint/unit + check:orphans + test:int + dev-docs build."
	@echo ""

install-deploy-tools: ## Install/verify the deploy toolchain (Zeabur plugin + CLI; checks gcloud/node/pnpm/docker)
	@bash scripts/install-deploy-tools.sh

# ─── One-command ship (Road 2 — GCP Cloud Run + Cloud SQL) ────────────────
# Deploy-time vars come from deploy/.env.deploy (copy from .env.deploy.example).
# Image tag derives from the git short SHA so every build is traceable.
DEPLOY_ENV   := deploy/.env.deploy
GIT_SHA      := $(shell git rev-parse --short HEAD 2>/dev/null || echo nogit)
IMAGE_TAG    ?= $(GIT_SHA)

image: ## Build the next-app runtime image for linux/amd64, tagged from the git short SHA
	@set -a; [ -f $(DEPLOY_ENV) ] && . ./$(DEPLOY_ENV) || true; set +a; \
	tag="$${IMAGE_TAG:-$(IMAGE_TAG)}"; \
	echo "▶ docker buildx build linux/amd64 → next-app:$$tag"; \
	docker buildx build --platform linux/amd64 \
		--build-arg NEXT_PUBLIC_APP_URL="$${NEXT_PUBLIC_APP_URL:-http://localhost:3000}" \
		-t "next-app:$$tag" -t "next-app:latest" \
		--load \
		$(NEXT)
	@echo "✅ Built next-app:$(IMAGE_TAG) (linux/amd64). Push it with make deploy-gcp (or your own registry push)."

deploy-zeabur: ## Ship to Zeabur (Road 1, primary): preflight build → deploy via zeabur CLI → migrate prod DB
	@command -v zeabur >/dev/null 2>&1 || { echo "❌ Zeabur CLI not found → make install-deploy-tools"; exit 1; }
	@echo "▶ Preflight: production build (catches what typecheck/test miss)…"
	cd $(NEXT) && pnpm build
	@echo "▶ Deploying the Next.js service to Zeabur…"
	@# The Zeabur CLI builds from source server-side (zbpack.json / Dockerfile) — it
	@# is the supported one-command path. deploy/deploy-zeabur.sh wraps the full
	@# gated flow (project/env/domain/migrate); use --redeploy for code-only pushes.
	@bash deploy/deploy-zeabur.sh --redeploy
	@echo "▶ Applying Drizzle migrations against the deployed DB (via zeabur exec)…"
	@set -a; [ -f $(DEPLOY_ENV) ] && . ./$(DEPLOY_ENV) || true; set +a; \
	zeabur exec --service "$${ZEABUR_SERVICE:-web}" -- pnpm db:migrate \
		&& echo "✅ Migrations applied on Zeabur." \
		|| { echo "⚠ Auto-migrate failed — run once the build is live:"; \
		     echo "    zeabur exec --service $${ZEABUR_SERVICE:-web} -- pnpm db:migrate"; }
	@echo "✅ deploy-zeabur complete. Status: bash deploy/deploy-zeabur.sh --status"

deploy-gcp: ## Ship to GCP: build → push (Artifact Registry) → Cloud Run deploy → migrate (Cloud Run Job)
	@command -v gcloud >/dev/null 2>&1 || { echo "❌ gcloud not found → make install-deploy-tools"; exit 1; }
	@test -f $(DEPLOY_ENV) || { echo "❌ Missing $(DEPLOY_ENV) → cp deploy/.env.deploy.example $(DEPLOY_ENV) and fill it in"; exit 1; }
	@set -a; . ./$(DEPLOY_ENV); set +a; \
	: "$${GCP_PROJECT_ID:?set GCP_PROJECT_ID in $(DEPLOY_ENV)}"; \
	: "$${GCP_REGION:?set GCP_REGION in $(DEPLOY_ENV)}"; \
	: "$${GCP_AR_REPO:?set GCP_AR_REPO in $(DEPLOY_ENV)}"; \
	: "$${GCP_SERVICE_NAME:?set GCP_SERVICE_NAME in $(DEPLOY_ENV)}"; \
	: "$${GCP_SQL_INSTANCE:?set GCP_SQL_INSTANCE in $(DEPLOY_ENV)}"; \
	tag="$${IMAGE_TAG:-$(IMAGE_TAG)}"; \
	registry="$${GCP_REGION}-docker.pkg.dev/$${GCP_PROJECT_ID}/$${GCP_AR_REPO}"; \
	image="$$registry/$${GCP_IMAGE_NAME:-next-app}:$$tag"; \
	migrate_image="$$registry/$${GCP_IMAGE_NAME:-next-app}-migrate:$$tag"; \
	sql_conn="$${GCP_PROJECT_ID}:$${GCP_REGION}:$${GCP_SQL_INSTANCE}"; \
	echo "▶ Auth Docker → Artifact Registry ($${GCP_REGION}-docker.pkg.dev)"; \
	gcloud auth configure-docker "$${GCP_REGION}-docker.pkg.dev" --quiet; \
	echo "▶ Build + push runtime image: $$image"; \
	docker buildx build --platform linux/amd64 \
		--build-arg NEXT_PUBLIC_APP_URL="$${NEXT_PUBLIC_APP_URL:-https://$${GCP_SERVICE_NAME}.a.run.app}" \
		-t "$$image" --push $(NEXT); \
	echo "▶ Build + push migrate image (builder stage — has drizzle-kit + tsx): $$migrate_image"; \
	docker buildx build --platform linux/amd64 --target builder \
		-t "$$migrate_image" --push $(NEXT); \
	echo "▶ Deploy Cloud Run service: $${GCP_SERVICE_NAME}"; \
	gcloud run deploy "$${GCP_SERVICE_NAME}" \
		--image "$$image" --region "$${GCP_REGION}" --project "$${GCP_PROJECT_ID}" \
		--platform managed --allow-unauthenticated \
		--add-cloudsql-instances "$$sql_conn" \
		--set-secrets "AUTH_SECRET=AUTH_SECRET:latest,DATABASE_URL=DATABASE_URL:latest" \
		--set-env-vars "AUTH_TRUST_HOST=true,NODE_ENV=production,NEXT_TELEMETRY_DISABLED=1" \
		--port 3000; \
	echo "▶ Migrate-on-deploy: update + run the migrate Cloud Run Job"; \
	gcloud run jobs describe migrate-job --region "$${GCP_REGION}" --project "$${GCP_PROJECT_ID}" >/dev/null 2>&1 \
		&& gcloud run jobs update migrate-job --image "$$migrate_image" --region "$${GCP_REGION}" --project "$${GCP_PROJECT_ID}" \
		|| gcloud run jobs create migrate-job --image "$$migrate_image" --region "$${GCP_REGION}" --project "$${GCP_PROJECT_ID}" \
			--add-cloudsql-instances "$$sql_conn" \
			--set-secrets "DATABASE_URL=DATABASE_URL:latest" \
			--set-env-vars "NODE_ENV=production" --command pnpm --args "db:migrate"; \
	gcloud run jobs execute migrate-job --region "$${GCP_REGION}" --project "$${GCP_PROJECT_ID}" --wait; \
	echo "✅ deploy-gcp complete → $$(gcloud run services describe "$${GCP_SERVICE_NAME}" --region "$${GCP_REGION}" --project "$${GCP_PROJECT_ID}" --format 'value(status.url)' 2>/dev/null)"

db-migrate-prod: ## Apply pending Drizzle migrations to a prod DATABASE_URL (GUARDED: requires CONFIRM=1)
	@test "$(CONFIRM)" = "1" || { \
		echo "❌ Refusing to migrate a PROD database without an explicit confirm."; \
		echo "   This applies all pending Drizzle migrations to the target DATABASE_URL."; \
		echo "   Re-run with:  make db-migrate-prod CONFIRM=1"; \
		echo "   DATABASE_URL is read from \$$PROD_DATABASE_URL (or $(DEPLOY_ENV))."; \
		exit 1; }
	@set -a; [ -f $(DEPLOY_ENV) ] && . ./$(DEPLOY_ENV) || true; set +a; \
	url="$${PROD_DATABASE_URL:-$${DATABASE_URL:-}}"; \
	test -n "$$url" || { echo "❌ No PROD_DATABASE_URL set (export it or put it in $(DEPLOY_ENV))"; exit 1; }; \
	host=$$(echo "$$url" | sed -E 's#^[^@]*@([^/?:]+).*#\1#'); \
	echo "▶ Migrating PROD DB at host: $$host"; \
	cd $(NEXT) && DATABASE_URL="$$url" pnpm db:migrate \
		&& echo "✅ Prod migrations applied." \
		|| { echo "❌ Prod migrate failed (see above)."; exit 1; }

install-tools: ## Install required dev tools (macOS — Homebrew: node, pnpm, docker)
	@echo "📦 Installing development tools…"
	@command -v brew >/dev/null 2>&1 || { echo "❌ Homebrew required: https://brew.sh"; exit 1; }
	brew install node pnpm docker || true
	@command -v pnpm >/dev/null 2>&1 || npm install -g pnpm
	@echo "✅ Tools installed. Run 'make local-setup' to set up the app."

# ─── Template lifecycle ────────────────────────────────────────────────────
new-project: ## Archive template epics and prepare for a fresh product start
	@echo "Archiving template epic specs to docs/epics/archive/template-phases/..."
	@mkdir -p docs/epics/archive/template-phases
	@bash scripts/new-project.sh

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

new-domain: ## Scaffold a new CRUD domain by copying the items domain (usage: make new-domain NAME=note [PLURAL=notes])
	@test -n "$(NAME)" || { echo "Usage: make new-domain NAME=<singular> [PLURAL=<plural>]"; exit 1; }
	@bash scripts/new-domain.sh $(NAME) $(PLURAL)

# ─── Docs tooling ─────────────────────────────────────────────────────────
staleness-check: ## Check docs for stale stat claims
	bash scripts/staleness-check.sh

screenshot-refresh: ## Refresh doc screenshots from live app
	bash scripts/screenshot-refresh.sh

# ─── Plugin sync ───────────────────────────────────────────────────────────
drift-check: ## Check athena-core drift (dry-run sync; exits non-zero if diff detected)
	@echo "Checking athena-core drift…"
	@bash scripts/sync-to-plugin.sh
	@echo "Drift check complete."

# ─── Help ──────────────────────────────────────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
