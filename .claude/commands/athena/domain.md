---
description: "(ops) Scaffold new domain → server endpoints + 6 client files from templates. Usage: `NAME=x`."
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

Read the domain generator spec at `docs/epics/e23-starter-domain-generator.md`.

Read the template files in `docs/templates/domain/`.

Parse the user's input: $ARGUMENTS

The first argument is the domain name (singular, lowercase, e.g. "note").
Optional --fields flag provides comma-separated field definitions (e.g. "title:string,body:text").
Optional --agent flag generates a domain expert agent alongside the CRUD code.

If --fields is omitted, use default fields: name (string, required) + description (text, optional).

## Naming Derivation

Given the input name, derive ALL naming variants:

| Variable | Rule | Example (input: `blog_post`) |
|----------|------|------------------------------|
| `{{SNAKE}}` | snake_case singular | `blog_post` |
| `{{SNAKE_PLURAL}}` | snake_case plural | `blog_posts` |
| `{{PASCAL}}` | PascalCase singular | `BlogPost` |
| `{{PASCAL_PLURAL}}` | PascalCase plural | `BlogPosts` |
| `{{CAMEL}}` | camelCase singular | `blogPost` |
| `{{CAMEL_PLURAL}}` | camelCase plural | `blogPosts` |
| `{{KEBAB_PLURAL}}` | kebab-case plural | `blog-posts` |
| `{{UPPER_SNAKE}}` | UPPER_SNAKE_CASE | `BLOG_POST` |

### Pluralization rules:
- Ends with `s`, `x`, `z`, `sh`, `ch` → add `es`
- Ends with `y` (preceded by consonant) → drop `y`, add `ies`
- Otherwise → add `s`

## Field Type Mapping

| Short | Python type | SQLAlchemy | Zod | OpenAPI |
|-------|-------------|------------|-----|---------|
| string | `str` | `String(200)` | `z.string()` | `type: string` |
| text | `str \| None` | `Text` | `z.string()` | `type: string` |
| int | `int` | `Integer` | `z.number().int()` | `type: integer` |
| float | `float` | `Float` | `z.number()` | `type: number` |
| bool | `bool` | `Boolean` | `z.boolean()` | `type: boolean` |
| date | `datetime` | `DateTime` | `z.string()` | `type: string, format: date-time` |
| decimal | `Decimal` | `Numeric(12,2)` | `z.number()` | `type: number` |

## 10-Step Workflow

Follow this exact sequence:

### Step 1 — Parse input
Parse the domain name and fields. Derive all naming variants.

### Step 2 — Generate OpenAPI spec FIRST (SDD compliance)
1. Read `docs/templates/domain/openapi/schemas.yaml.tmpl`
2. Replace variables + expand `{{#FIELDS}}` blocks
3. Write to `docs/openapi/schemas/{{SNAKE}}.yaml`
4. Read `docs/templates/domain/openapi/paths.yaml.tmpl`
5. Replace variables + expand fields
6. Write to `docs/openapi/paths/{{SNAKE_PLURAL}}.yaml`
7. Update `docs/openapi/openapi.yaml`:
   - Add path `$ref` entries for `/{{KEBAB_PLURAL}}` and `/{{KEBAB_PLURAL}}/{{{SNAKE}}_id}`
   - Add tag entry for `{{KEBAB_PLURAL}}`
   - Add schema `$ref` entries for `{{PASCAL}}Create`, `{{PASCAL}}Read`, `{{PASCAL}}Update`, `Paginated{{PASCAL}}Response`

### Step 3 — Run type generation
Execute `cd client && pnpm generate:types`

### Step 4 — Generate server domain package
1. Read each server template from `docs/templates/domain/server/`
2. Replace all variables + expand field blocks
3. Write files to `server/app/domains/{{SNAKE_PLURAL}}/`
   - `__init__.py`, `models.py`, `schemas.py`, `endpoints.py`
4. Write backward-compat shims:
   - `server/app/models/{{SNAKE}}.py` (from `model_shim.py.tmpl`)
   - `server/app/schemas/{{SNAKE}}.py` (from `schema_shim.py.tmpl`)

### Step 5 — Generate Alembic migration
Execute: `cd server && uv run alembic revision --autogenerate -m "add {{SNAKE_PLURAL}} table"`
Then: `cd server && uv run alembic upgrade head`

### Step 6 — Generate server integration tests
Read `docs/templates/domain/server/test_integration.py.tmpl`
Write to `server/tests/integration/test_{{SNAKE_PLURAL}}.py`

### Step 7 — Generate client schemas + service + hooks
1. Read client templates and write:
   - `client/src/schemas/{{SNAKE}}.ts` (from `schema.ts.tmpl`)
   - `client/src/api/services/{{SNAKE_PLURAL}}.ts` (from `service.ts.tmpl`)
   - `client/src/hooks/use{{PASCAL_PLURAL}}.ts` (from `hooks.ts.tmpl`)

### Step 8 — Generate client page + tests
1. Create directory `client/src/pages/{{KEBAB_PLURAL}}/`
2. Write:
   - `{{PASCAL_PLURAL}}Page.tsx` (from `page.tsx.tmpl`) — style via Tailwind
     utility classes + `components/ui/` primitives. Example pattern:
     `<div className="flex flex-col gap-4 p-6">`. Do NOT import a CSS file.
   - `{{PASCAL_PLURAL}}Page.test.tsx` (from `page.test.tsx.tmpl`)
   - **Do NOT emit a `{{PASCAL_PLURAL}}.css` file** — page-co-located CSS is
     banned by Stop-verifier Rule #21. Use Tailwind + `components/ui/` + Preset
     slots (`components/ui/preset.ts`) for all visual styling.

### Step 9 — Generate client MSW handlers
Write `client/src/tests/handlers/{{SNAKE_PLURAL}}.ts` (from `handlers.ts.tmpl`)

### Step 10 — Update scaffold + verify
1. Add entry in `scripts/new-site/scaffold.ts` `DOMAIN_REMOVAL_MAP` for the new domain
2. Remind user to add route to `App.tsx` and sidebar link in `DashboardLayout`
3. Run: `cd server && uv run pytest tests/integration/test_{{SNAKE_PLURAL}}.py -v`
4. Run: `cd client && pnpm test -- --run src/pages/{{KEBAB_PLURAL}}/`
5. Output the full list of generated files

### Step 11（Optional）— Generate Domain Agent

If --agent flag is provided:
1. Read `docs/templates/domain/agent.md.tmpl`
2. Replace variables:
   - `{{SNAKE}}` → snake_case singular name
   - `{{SNAKE_PLURAL}}` → snake_case plural name
   - `{{PASCAL}}` → PascalCase singular name
   - `{{PASCAL_PLURAL}}` → PascalCase plural name
3. Write to `.claude/agents/{{SNAKE}}.md`
4. Create `docs/context/{{SNAKE}}-log.md` with header:
   ```markdown
   # {{PASCAL}} — 諮詢紀錄

   > 由 @{{SNAKE}} 自動維護。記錄所有領域諮詢的問題、建議與參考來源。
   ```
5. Report: "Created @{{SNAKE}} domain agent"

## Important Rules

- OpenAPI spec is generated FIRST — this is SDD (Spec-Driven Development)
- All endpoints include `@limiter.limit(settings.RATE_LIMIT_GENERAL)` and `current_active_user`
- All queries filter by `user_id` for data isolation
- Model uses `GUID` PK, `user_id` FK, and `TimestampMixin`
- Zod schemas use `satisfies z.ZodType<ApiType>` for drift detection
- Services use `createService()` factory
- Domain registry auto-discovers — no `main.py` edits needed
- When --agent flag is used, generate from `docs/templates/domain/agent.md.tmpl` (see Step 11)
