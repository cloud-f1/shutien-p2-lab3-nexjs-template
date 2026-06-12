# OpenAPI — Shared Contract & Dev Workflow

## OpenAPI as Source of Truth

`docs/openapi.yaml` is the single schema source for both frontend and backend. TypeScript types are auto-generated -- no schema drift possible.

```bash
# After every openapi.yaml update
npx openapi-typescript docs/openapi.yaml --output client/src/api/types.ts

# Lint check (@spec-writer and /athena:deploy both run this)
npx @redocly/cli lint docs/openapi.yaml
```

### Schema Example

```yaml
openapi: "3.1.0"
info:
  title: AI-Coding-Template API
  version: "1.0.0"

paths:
  /auth/register:
    post:
      operationId: register
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RegisterRequest'
      responses:
        "200":
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'

components:
  schemas:
    RegisterRequest:
      type: object
      required: [email, password]
      properties:
        email:    { type: string, format: email }
        password: { type: string, minLength: 8 }
```

## Development Workflow — SDD + TDD

Every feature follows this exact order:

```
1. SPEC     Edit docs/openapi.yaml (spec FIRST, never code first)
             |
2. GENERATE npx openapi-typescript -> update client/src/api/types.ts
             |
3. RED      Write failing tests (pytest + vitest) -- MUST FAIL
             |
4. GREEN    Minimum code to pass -- no gold-plating
             |
5. REFACTOR Clean while tests stay green
             |
6. REVIEW   /athena:qa -> @qa security + architecture audit
             |
7. COMMIT   git commit -m "feat(auth): add register endpoint"
```

## Claude Code Slash Commands (athena namespace)

```bash
/athena:spec "feature name"      # @spec-writer designs openapi.yaml + plan
/athena:implement feature-name   # TDD cycle (RED -> GREEN -> REFACTOR)
/athena:qa                       # @qa: code review + full suite + coverage gate
/athena:deploy staging           # @deployer 6 gates then Zeabur deploy
/athena:save                     # All agents checkpoint to docs/context/
/athena:promote                  # @memory-curator extracts wisdom -> template tier
```
