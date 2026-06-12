# E70 — Example Domain Extraction

> **Phase**: 21 | **Size**: M (8 SP) | **Priority**: P1
> **Depends on**: E69 (reset script must exist to reference)
> **Branch**: `MH/feat/E70-example-domain-extraction`

---

## Problem Statement

The template ships with 4 full domain implementations (billing, teams, places, portfolios) totaling ~9.5K lines of code. A SaaS template should provide auth + dashboard as core, with example domains as optional add-ons. Currently there's no way to separate "template framework" from "example project content."

## Solution

1. Move example domains to `docs/examples/domains/` as reference implementations
2. Create `scripts/add-example-domains.sh` to optionally install them back
3. Strip domain-specific content from core code (i18n keys, CSP directives, OpenAPI schemas)
4. Keep auth + dashboard + getting-started as core template pages

## Stories

### S1: Server Domain Extraction

**AC**:
- [ ] Move `server/app/domains/{billing,teams,places,portfolios}/` → `docs/examples/domains/server/`
- [ ] Remove domain-specific i18n keys from `server/app/core/i18n.py` (TEAM_SLUG_EXISTS, SUBSCRIPTION_ALREADY_ACTIVE, NO_STRIPE_CUSTOMER, INVALID_WEBHOOK_SIGNATURE)
- [ ] Remove Stripe CSP directives from `server/app/middleware/security_headers.py` (move to example docs)
- [ ] Remove backward-compat shims: `server/app/models/portfolio.py`, `server/app/schemas/portfolio.py`, `server/app/api/v1/endpoints/portfolios.py`
- [ ] Domain registry auto-discovers — empty `domains/` dir is valid (zero-domain template)
- [ ] Server still starts and passes tests with no domains

### S2: Client Domain Extraction

**AC**:
- [ ] Move `client/src/pages/{billing,places,portfolios}/` → `docs/examples/domains/client/`
- [ ] Remove domain routes from `client/src/App.tsx` (keep auth, dashboard, legal, getting-started)
- [ ] Remove domain-specific MSW handlers from `client/src/tests/handlers/`
- [ ] Remove domain-specific navigation from DashboardLayout sidebar
- [ ] Client still builds and passes tests with no domain pages

### S3: OpenAPI Schema Extraction

**AC**:
- [ ] Move `docs/openapi/schemas/{portfolio,place,team,billing}.yaml` → `docs/examples/domains/openapi/schemas/`
- [ ] Move `docs/openapi/paths/{portfolios,places,teams,billing}.yaml` → `docs/examples/domains/openapi/paths/`
- [ ] Core `docs/openapi.yaml` only includes auth, users, sessions, health paths
- [ ] `pnpm generate:types` still works with reduced schema set

### S4: Example Domain Installer

**AC**:
- [ ] `scripts/add-example-domains.sh [domain]` — copies domain back from examples to working dirs
- [ ] Supports: `billing`, `teams`, `places`, `portfolios`, `all`
- [ ] Copies server domain, client pages, OpenAPI schemas
- [ ] Runs `pnpm generate:types` after install
- [ ] `make add-domain NAME=billing` Makefile target

### S5: Documentation

**AC**:
- [ ] `docs/examples/domains/README.md` — explains each example domain
- [ ] Each domain has a brief README with what it demonstrates
- [ ] Main README updated to mention optional domains

## Risk Notes

- **Test count will drop significantly** — domain tests move with domains. This is expected.
- **Coverage % may increase** — less code to cover, but auth/core tests remain
- Server and client must still start, build, and pass core tests with zero domains
- Stripe-related env vars become truly optional (no code references them in core)
