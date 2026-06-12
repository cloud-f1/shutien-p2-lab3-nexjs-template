# Contributing Guide

[繁體中文版](CONTRIBUTING.zh-TW.md)

Thank you for your interest in AI Coding Template! We welcome contributions of all kinds — bug reports, feature suggestions, documentation improvements, or code submissions.

---

## Code of Conduct

By participating in this project, you agree to the following principles:

- **Respect**: Interact with others in a friendly, professional manner
- **Inclusion**: Welcome participants of all backgrounds and experience levels
- **Constructive**: Provide constructive feedback, focusing on improvement rather than criticism

---

## Development Environment Setup

See the [Quickstart Guide](docs/guides/en/quickstart.md) to set up your development environment.

**Requirements**:

- Node.js >= 22
- pnpm >= 8
- Python >= 3.12
- uv (Python package management)
- PostgreSQL >= 15
- Git

---

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Stable branch, target for all PR merges |
| `feat/E{n}-{slug}` | Epic feature branch (e.g.: `feat/E7-places-crud`) |
| `feat/{description}` | Non-Epic feature branch (e.g.: `feat/add-dark-mode`) |
| `fix/{description}` | Bug fix branch |

**Flow**:

1. Create a new branch from `main`
2. Develop and commit
3. Create a PR back to `main`

---

## Commit Conventions

This project uses **Conventional Commits** format. `git-cliff` relies on this format for auto-generating the Changelog.

### Format

```
<type>(<scope>): <description>

[optional body]
```

### Common Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(E7): Places CRUD endpoints` |
| `fix` | Bug fix | `fix: resolve token refresh race condition` |
| `docs` | Documentation changes | `docs: update quickstart guide` |
| `refactor` | Refactoring (no functionality change) | `refactor: extract auth middleware` |
| `test` | Test-related | `test: add portfolio service tests` |
| `chore` | Build, tooling, config | `chore: update dependencies` |

### Rules

- Scope should use the Epic number: `feat(E7): ...`
- Description in English, starting with lowercase
- Each commit should represent a meaningful change

---

## PR Workflow

### Using Agents to Create PRs (Recommended)

```bash
/athena:pr         # Full flow: merge main -> build -> test -> create PR
/athena:ship       # Quick flow: review -> fix -> commit -> PR
```

### Manual PR Creation

1. Ensure the branch has been pushed to remote
2. Create a PR with a title following Conventional Commits format:
   ```
   feat(E{n}): Short description (#issue)
   ```
3. Wait for CI to pass:
   - Backend tests (pytest, >= 80% coverage)
   - Frontend tests (Vitest, >= 80% coverage)
   - Lint checks
4. Merge after at least one reviewer approves

---

## Agent Team Usage

This project includes 7 built-in AI Agents, dispatched through the Athena command system:

| Command | Purpose |
|---------|---------|
| `/athena:spec <feature>` | Design a new feature spec (OpenAPI-first) |
| `/athena:implement` | TDD cycle: spec -> code -> QA |
| `/athena:qa` | Code review + test suite |
| `/athena:pr [--draft]` | Merge main -> build -> test -> create PR |
| `/athena:deploy [env]` | 6-gate deployment to Zeabur |
| `/athena:load` | Load all context documents |
| `/athena:save` | All agents checkpoint simultaneously |
| `/athena:promote` | Extract reusable insights to Tier 0 |

**Recommended workflow**:

1. Use `/athena:spec` to design the feature spec
2. Use `/athena:implement` for TDD development
3. Use `/athena:qa` for quality checks
4. Use `/athena:pr` or `/athena:ship` to create the PR

---

## Epic Pipeline

All feature development must go through the **Epic Pipeline**:

```
spec -> implement -> qa -> commit -> merge
```

| Step | Description |
|------|-------------|
| **spec** | Design the feature spec, write OpenAPI spec |
| **implement** | TDD cycle (RED -> GREEN -> REFACTOR) |
| **qa** | Code review + test coverage check |
| **commit** | Commit code following Conventional Commits |
| **merge** | Create PR, pass CI, merge to main |

Use `/athena:loop` to advance through the Epic Pipeline step by step.

Progress tracking: [`docs/epics/EPIC_INDEX.md`](docs/epics/EPIC_INDEX.md)

---

## Code Style

### Server (Python)

- Follow Python conventions (see CLAUDE.md for architecture rules)
- Use `uv` for package management (not pip)
- Use `async def` for async endpoints
- Complete type hints

### Client (React + TypeScript)

- Follow React conventions (see CLAUDE.md for architecture rules)
- Use `userEvent` (not `fireEvent`) for interaction tests
- MSW handlers go in `src/tests/handlers/`
- React Query cache tiers from `cacheConfig.ts`

### API Design

- **Spec-Driven Development (SDD)**: Edit `docs/openapi.yaml` first, then write code
- OpenAPI spec is the single source of truth for all types

---

## Testing Requirements

| Item | Requirement |
|------|-------------|
| Coverage gate | >= 80% (Server + Client) |
| Server test framework | pytest + asyncio (`asyncio_mode = auto`) |
| Client test framework | Vitest + @testing-library/react + MSW |
| Interaction testing | Use `userEvent`, not `fireEvent` |

```bash
# Run Server tests
cd server && uv run pytest --cov

# Run Client tests
cd client && pnpm test --coverage
```

For details on what CI checks run and how to fix common failures, see the [CI Explained guide](docs/guides/en/ci-explained.md).

---

## Reporting Issues

Use [Issue Templates](https://github.com/cloud-f1/ai-coding-template/issues/new/choose) to report issues:

- **Bug Report**: Report errors with reproduction steps and environment info
- **Feature Request**: Suggest new features with motivation and proposed solution

---

## License

This project is licensed under the [MIT License](LICENSE). By submitting contributions, you agree to release your code under the same license.
