# Contributing Guide

Thank you for your interest in the AI Coding Template (Next.js)! We welcome
contributions of all kinds — bug reports, feature suggestions, documentation
improvements, and code.

---

## Code of Conduct

- **Respect** — interact professionally and in good faith.
- **Inclusion** — welcome participants of all backgrounds and experience levels.
- **Constructive** — focus feedback on improvement, not criticism.

---

## Development Environment

The fastest path is Docker:

```bash
git clone https://github.com/cloud-f1/ai-coding-nexjs-template.git && cd ai-coding-nexjs-template
docker compose up --build -d        # postgres + migrate/seed + web (+ mailpit)
open http://localhost:3000
```

Or use the Makefile helper (Docker for Postgres + `pnpm dev` for the web app):

```bash
make local          # boots local infra (Postgres) + Next.js dev on http://localhost:3000
```

Or run the app directly from `next-app/`:

```bash
cd next-app
pnpm install
# set DATABASE_URL + AUTH_SECRET (see .env.example)
pnpm db:generate    # regenerate Drizzle migrations after a schema change (optional)
pnpm db:migrate && pnpm db:seed
pnpm dev
```

Demo logins (after `pnpm db:seed`): `admin@example.com / Admin123!` ·
`editor@example.com / Editor123!` · `viewer@example.com / Viewer123!`.

**Requirements:** Node.js >= 20 · pnpm >= 9 · PostgreSQL >= 15 (or Docker) · Git.

---

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Stable branch, target for all PR merges |
| `feat/E{n}-{slug}` | Epic feature branch (e.g. `feat/E251-stripe-billing`) |
| `feat/{description}` | Non-Epic feature branch |
| `fix/{description}` | Bug fix branch |

**Flow:** branch from `main` → develop & commit → open a PR back to `main`.

> Direct pushes to `main` are blocked by `scripts/hooks/pre-bash-guard.sh` — always go through a PR.

---

## Commit Conventions & Versioning

This project uses **[Conventional Commits](https://www.conventionalcommits.org/)** and
**[Semantic Versioning](https://semver.org/)**.

### Commit format

```
<type>(<scope>): <description>
```

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(E251): Stripe billing module` |
| `fix` | Bug fix | `fix: re-read role from DB in RBAC guard` |
| `docs` | Documentation | `docs: refresh README for Next.js stack` |
| `refactor` | Refactor (no behavior change) | `refactor: extract billing resolver` |
| `test` | Tests | `test: add ECPay CheckMacValue vectors` |
| `chore` | Build / tooling / config | `chore: bump deps` |

- Scope is the Epic number when applicable: `feat(E251): ...`.
- Description in English, lowercase start; each commit is one meaningful change.

### Versioning (SemVer)

- **MAJOR** — incompatible API / module-contract changes.
- **MINOR** — new modules or backward-compatible features (e.g. a new `@saas/*` module).
- **PATCH** — backward-compatible bug fixes.

Releases are tagged `vMAJOR.MINOR.PATCH` (e.g. `v0.1.0`). Every release adds an entry to
[`CHANGELOG.md`](CHANGELOG.md) (Keep a Changelog format). Bump `next-app/package.json`
`version` in the same commit, then tag `main`.

---

## Development Pipeline

Epic-driven work follows the Athena pipeline — each step has an owning agent and command:

```
spec ──► implement ──► qa ──► commit ──► merge
 │           │          │
@spec-writer TDD       @reviewer + @qa + @evaluator
(Drizzle      (red→green  (review + Vitest/Playwright + coverage gate)
 schema +     →refactor)
 Zod + Server
 Action / Route
 Handler + RBAC)
```

- `@spec-writer` designs the **feature spec** (Drizzle table + shared Zod schema +
  Server Action / Route Handler signatures + RBAC), written to `docs/epics/` — not OpenAPI.
- `@dba` reviews `drizzle-kit` migrations; `@qa` runs the `next-app/` `pnpm` gates.
- See [`CLAUDE.md`](CLAUDE.md) § "Slash Commands" for the full command list.

---

## PR Workflow

```bash
/athena:pr         # full flow: merge main -> build -> test -> create PR
/athena:ship       # quick flow: review -> fix -> commit -> PR
```

Manual: push the branch, open a PR titled in Conventional Commits format
(`feat(E{n}): short description`), pass the local quality gate, and merge after review.

Before opening a PR, run the quality gate:

```bash
scripts/pre-merge-check.sh [--e2e]   # repo hygiene + typecheck + lint + unit (+ e2e)
# or, from next-app/:
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

---

## Architecture Rules (must follow)

See [`CLAUDE.md`](CLAUDE.md) § "Architecture Rules — NEVER DEVIATE". Highlights:

- **Default to Server Components** — add `"use client"` only for browser APIs / events / state.
- **Path alias `@/*`** resolves to `next-app/` root — no relative `../../` imports.
- **shadcn/ui** lives in `components/ui/` — add via `npx shadcn@latest add`, never hand-author.
- **Drizzle** for all DB access (no raw SQL, no Prisma); mutations via Server Actions (`"use server"`).
- **`cn()`** for conditional Tailwind; theme via `dark:` variants — no inline `style=` color overrides.
- **API contract (E281)** — Server Actions are TS + Zod (compile-time) contract; HTTP routes are the **generated** `docs/openapi.yaml` (+ `GET /api/openapi`). Regenerate with `pnpm openapi:generate` (never hand-edit); drift-guarded in smoke.

---

## Testing Requirements

| Item | Requirement |
|------|-------------|
| Unit | Vitest (`pnpm test`) — keep meaningful coverage on `lib/`, validations, actions |
| E2E | Playwright (`pnpm test:e2e`) — needs a seeded DB (`pnpm db:seed`) |
| Types / lint | `pnpm typecheck` + `pnpm lint` must pass |
| Registry | `pnpm registry:build` + `pnpm module:validate` for module changes |
| Design fidelity | structural alignment (`app/cobalt-integration.test.ts`, runs with `pnpm test`) + opt-in visual regression (`pnpm test:vrt`) |

```bash
cd next-app
pnpm test                # unit (incl. structural design-alignment suite)
pnpm test:e2e            # functional e2e (DB up + seeded)
make smoke               # full smoke (typecheck + lint + unit + build + e2e + registry install)
make smoke ... --vrt     # add the visual-regression gate (see below)
```

### Design-fidelity gate (two layers)

1. **Structural** — `app/cobalt-integration.test.ts` asserts every design deliverable
   (tokens, FX classes, shell wiring, sections) is present. Fast + deterministic; runs in `pnpm test`.
2. **Visual regression (VRT)** — `e2e/vrt/design-fidelity.spec.ts` screenshots the design-stable
   surfaces (landing/login/register/settings/components × light+dark) and diffs against baselines.
   Runs only in the `vrt` Playwright project (motion disabled → deterministic).

   Baselines are **platform-suffixed and gitignored** (a `-darwin` baseline won't match Linux CI),
   so **generate them once per environment** before gating:
   ```bash
   pnpm test:vrt:update     # (re)generate baselines for THIS platform
   pnpm test:vrt            # compare against them
   scripts/smoke.sh --vrt   # same, as a smoke gate
   ```
   Re-run `test:vrt:update` whenever you make an intentional visual change.

---

## Authoring a Module

New `@saas` registry modules follow the `module-author` skill — see
`.claude/skills/module-author/` and the
[module catalog](https://ai-coding-nexjs-template-docs.pages.dev/modules/). Each module ships
code + a machine-readable `module.manifest.json` + a paired `install-<module>` skill.

---

## Reporting Issues

Use the [issue templates](https://github.com/cloud-f1/ai-coding-nexjs-template/issues/new/choose):

- **Bug Report** — error with reproduction steps and environment info.
- **Feature Request** — motivation and proposed solution.

---

## License

This project is licensed under the [MIT License](LICENSE). By submitting contributions,
you agree to release your code under the same license.
