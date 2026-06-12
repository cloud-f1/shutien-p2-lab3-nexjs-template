# CI Pipeline Explained

> A beginner-friendly guide to what happens when you push code or open a PR.

## What CI Checks Run

When you push to a branch or open a pull request, GitHub Actions runs these checks automatically:

| Check | What it does | Local command |
|-------|-------------|---------------|
| **Server tests** | Runs all Python tests with coverage | `cd server && uv run pytest` |
| **Client tests** | Runs all Vitest tests with coverage | `cd client && pnpm test:coverage` |
| **Type generation** | Verifies `src/api/types.ts` matches `openapi.yaml` | `cd client && pnpm generate:types` |
| **Lint** | Checks code formatting and style | `make lint` |

## Common CI Failures & How to Fix

### 1. "Coverage does not meet threshold"

**What it means**: Your code changes dropped test coverage below 80% (branches, statements, or lines).

**How to fix**:
```bash
cd client && pnpm test:coverage    # See which files are under-covered
cd server && uv run pytest --cov   # Same for server
```

Write tests for the uncovered branches. The coverage report shows exact line numbers.

### 2. "Generated types are stale"

**What it means**: You edited `docs/openapi.yaml` but forgot to regenerate the TypeScript types.

**How to fix**:
```bash
cd client && pnpm generate:types
git add client/src/api/types.ts
git commit -m "chore: regenerate types from openapi.yaml"
```

### 3. "Lint errors"

**What it means**: Code formatting or style violations.

**How to fix**:
```bash
# Server (Python)
cd server && uv run ruff check --fix && uv run ruff format

# Client (TypeScript)
cd client && pnpm lint --fix
```

### 4. "Test failures"

**What it means**: One or more tests are failing.

**How to fix**:
```bash
# Run the specific failing test locally
cd client && pnpm vitest run src/path/to/failing.test.tsx
cd server && uv run pytest tests/path/to/test_file.py -v
```

Read the error message — it usually tells you exactly what assertion failed and why.

## Running CI Locally Before Pushing

Save time by running checks locally before pushing:

```bash
make test          # Run all test suites
make lint          # Check formatting
cd client && pnpm generate:types && git diff --exit-code src/api/types.ts  # Check types
```

Or use the all-in-one diagnostic:

```bash
make doctor        # Check environment health
```

## CI Workflow Files

The workflow definitions live in `.github/workflows/`:

| File | Trigger | What it does |
|------|---------|-------------|
| `ci.yml` | Push / PR | Tests, coverage, lint, type check |
| `docker-publish.yml` | Push to main | Build & push Docker images to GHCR |
| `audit.yml` | Schedule / manual | Security audit of dependencies |

## Need Help?

- Check the [Quickstart Guide](quickstart.md) for setup instructions
- Run `make doctor` to diagnose environment issues
- Open an issue with the CI log output if you're stuck

---

## Next Steps

- **[Working Without Claude Code](without-claude-code.md)** — Full development workflow using only `make` commands
- **[OpenAPI Design Patterns](openapi-patterns.md)** — Master the API design patterns and avoid common pitfalls
- **[AI Agent Team Guide](ai-agent-team-guide.md)** — Automate your workflow with serial and parallel agent execution
- **[Learning Path](learning-path.md)** — See the full recommended reading order for all guides
