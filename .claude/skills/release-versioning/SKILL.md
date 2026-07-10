---
name: release-versioning
description: >-
  SemVer release flow for THIS template — mechanizes what's currently prose-only in
  CONTRIBUTING.md. Use when bumping `next-app/package.json` version, preparing a
  `release/vX.Y.Z` branch, cutting a release PR, updating CHANGELOG.md, or when someone asks
  "what version should this be", "cut a release", "bump version", or "prepare the release PR".
  Covers the exact major/minor/patch rule, the package.json → branding.ts → sidebar-footer
  version-display chain, the observed release branch/PR flow, and the pull-only constraint —
  the agent prepares the branch + PR, the human merges and tags.
---

# Release & Versioning — AI-Coding-Template

## 1. The SemVer rule (cited verbatim from `CONTRIBUTING.md` §"Versioning (SemVer)")

> - **MAJOR** — incompatible API / module-contract changes.
> - **MINOR** — new modules or backward-compatible features (e.g. a new `@saas/*` module).
> - **PATCH** — backward-compatible bug fixes.
>
> Releases are tagged `vMAJOR.MINOR.PATCH` (e.g. `v0.1.0`). Every release adds an entry to
> [`CHANGELOG.md`](CHANGELOG.md) (Keep a Changelog format). Bump `next-app/package.json`
> `version` in the same commit, then tag `main`.

Also from the same file's commit-format table, the epic-scoped commit types that typically map to
each bump:

| Commit type | Typical bump |
|---|---|
| `feat(E###): ...` — new feature/module | MINOR (or MAJOR if it breaks an existing `@saas/*` module contract) |
| `fix: ...` — bug fix | PATCH |
| `refactor:` / `perf:` / `chore:` (no behavior change) | usually no bump, or PATCH if user-visible |

When in doubt between MINOR and PATCH: does this add something a fork could start depending on
(new module, new env var read, new Server Action)? → MINOR. Does it only fix incorrect behavior of
something that already existed? → PATCH.

## 2. The mechanical chain — one bump, zero drift

```
next-app/package.json  "version": "0.4.0"
        │
        ▼  (import packageJson from "../package.json")
next-app/lib/branding.ts   export const APP_VERSION = packageJson.version
        │
        ▼  (rendered as a muted label)
components/app-sidebar.tsx   dashboard sidebar footer
```

`lib/branding.ts` reads the version **directly from `package.json`** — there is no separate
version constant to keep in sync, and no git-tag↔UI drift is possible by construction. This means
the *only* file that needs the version number edited is `next-app/package.json`; the UI update
happens automatically on the next build/deploy (no `NEXT_PUBLIC_*` env var involved — this one is
baked from the JSON import at build time, same build-time rule as any other bundled constant).

**Do not** hand-edit a version string anywhere else (no separate `VERSION` file, no duplicated
constant in `branding.ts`) — if you find one, that's drift to fix, not a second source to update.

## 3. Observed release flow (from git history — `git log --oneline --all | grep release`)

```
release/vX.Y.Z branch
      │  chore(release): vX.Y.Z — <short summary of what shipped>
      │    - bump next-app/package.json version
      │    - add/finish the CHANGELOG.md [X.Y.Z] section (Keep a Changelog format)
      ▼
   PR opened  (e.g. "Merge pull request #83 from cloud-f1/release/vX.Y.Z")
      │
      ▼
   USER merges the PR into main
      │
      ▼
   USER tags main as vX.Y.Z
```

Real examples from this repo's history: `release/v0.4.0` → `chore(release): v0.4.0 — Backport
Wave 2 (Phases 75–76, E319–E325)` → PR #83 → merged. Earlier releases (`v0.3.0`, `v0.2.0`,
`v0.1.0`) followed the same shape, sometimes with a small follow-up `chore(release): add vX.Y.Z
changelog link-refs` commit for reference-link cleanup in `CHANGELOG.md`.

### Pull-only constraint — the agent does not merge or tag

Per this project's GitHub access, an agent has **pull-only** permissions: it can push a branch and
open a PR, but **cannot merge PRs or push tags to `main`**. The release flow an agent executes is:

1. Create `release/vX.Y.Z` from the tip of `main` (or the branch to be released).
2. Bump `next-app/package.json` `"version"`.
3. Write/finish the `CHANGELOG.md` `[X.Y.Z]` section (Keep a Changelog format — `### Added` /
   `### Changed` / `### Fixed` etc., matching the existing entries above it).
4. Commit as `chore(release): vX.Y.Z — <summary>`.
5. Push the branch and open the PR.
6. **Stop.** The human merges the PR and creates the `vX.Y.Z` tag. Do not attempt `gh pr merge`,
   `git push --tags`, or any destructive/merge operation — those are the human's step.

## 4. Pre-release checklist

- [ ] `next-app/package.json` `"version"` bumped per the MAJOR/MINOR/PATCH rule in §1.
- [ ] `CHANGELOG.md` has a `[X.Y.Z] - YYYY-MM-DD` section (Keep a Changelog format) summarizing
      what shipped since the last release — check the `[Unreleased]` section at the top of the
      file for already-drafted notes to fold in.
- [ ] `docs/epics/EPIC_INDEX.md` reflects the phase/epics actually included in this release (so
      the next session's "Active Epic" pointer isn't stale).
- [ ] `make verify` is green (staleness-check + `scripts/pre-merge-check.sh` [typecheck · lint ·
      unit] + non-strict `check:orphans` report + `test:int` [gracefully skips without a reachable
      Postgres] + a dev-docs build) — run this before pushing, per `CONTRIBUTING.md`'s "Ship
      discipline" section.
- [ ] Release branch named `release/vX.Y.Z`, commit message `chore(release): vX.Y.Z — <summary>`.
- [ ] PR opened targeting `main`; agent stops here (§3) — human merges + tags `vX.Y.Z`.
