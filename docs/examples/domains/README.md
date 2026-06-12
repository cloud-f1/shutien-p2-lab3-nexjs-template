# Example Domains

This directory contains 4 complete domain implementations extracted from the
template core. Each domain is a fully working reference — server, client, and
OpenAPI schema included.

## Domains

| Domain | Description |
|--------|------------|
| **billing** | Stripe billing — checkout, subscriptions, webhooks, customer portal |
| **teams** | Team management with RBAC (viewer/editor/admin/owner), member invites |
| **places** | Place CRUD with spatial queries (lat/lng, nearby search) |
| **portfolios** | Portfolio management with analytics, place investments, allocation |

## Directory Structure

```
server/         Server-side domain packages (FastAPI + SQLAlchemy)
client/         Client-side pages, hooks, services, schemas, handlers, components
openapi/        OpenAPI path and schema definitions
  schemas/      Reusable schema YAML files
  paths/        Path definition YAML files
```

## Installing a Domain Back

To add an example domain back into the working project:

1. **Server**: Copy `server/<domain>/` to `server/app/domains/<domain>/`
2. **Client**: Copy `client/<domain>/` pages to `client/src/pages/<domain>/`
   - Copy schemas from `client/schemas/` to `client/src/schemas/`
   - Copy services from `client/api/services/` to `client/src/api/services/`
   - Copy hooks from `client/hooks/` to `client/src/hooks/`
   - Copy handlers from `client/tests/handlers/` to `client/src/tests/handlers/`
   - Copy components from `client/components/` to `client/src/components/`
3. **OpenAPI**: Copy schemas and paths back to `docs/openapi/schemas/` and
   `docs/openapi/paths/`, then add `$ref` entries to `docs/openapi/openapi.yaml`
4. **i18n**: If the domain has locale files, copy them to `client/src/locales/`
   and register the namespace in `client/src/i18n.ts`
5. Run `pnpm generate:types` to regenerate TypeScript types
6. Add routes in `client/src/App.tsx` as needed

The server domain registry auto-discovers packages under `server/app/domains/`,
so simply copying a domain package back is enough to register its API routes.

## Migration

每個範例 domain 都有對應的合併 migration，位於 [`docs/examples/migrations/`](../migrations/)。

安裝 domain 時，請同時複製對應的 migration 檔案到 `server/alembic/versions/`。
詳細步驟請參考 [`docs/examples/migrations/README.md`](../migrations/README.md)。

## Stripe CSP Note

If installing the billing domain, add these CSP directives back to
`server/app/middleware/security_headers.py`:

```
script-src ... https://js.stripe.com;
connect-src ... https://api.stripe.com https://q.stripe.com;
frame-src https://js.stripe.com https://hooks.stripe.com;
```
