# E286 — Onboarding repoint (fork-ability)

> Phase 67 (Fork-ability) · docs · branch `feat/E286-onboarding`
> Source: the 2026-06 fork-readiness audit (F1, F17, F18).

## Problem

The README routed new forkers to `docs/zh-tw/getting-started.md`, which was **FastAPI-era**:
`Python 3.12+` / `uv sync` / `:8000/docs` / `:5173` / a non-existent `/athena:review`. A
stranger following the linked guide could not succeed. `track-b-integration.md` had the wrong
agent count (11 vs 12), an invented `domain-expert` agent, references to `/athena:review` +
`/execute` (don't exist), and a stale repo slug. The maintained, accurate guides at
`docs/guides/` weren't linked from the README.

## Solution

- **`docs/zh-tw/getting-started.md`** — rewritten to the Next.js fork flow (繁中): Node 22 + pnpm +
  Docker (no Python/uv); `gh repo fork cloud-f1/ai-coding-nexjs-template` → `make local-setup` →
  `make local` (http://localhost:3000, Mailpit :8025) + demo logins; customize via CLAUDE.md's
  Fork section + `.env.example`; first epic via `/athena:plan` → `/athena:loop` (quality = `/athena:qa`,
  not `/athena:review`). Cross-links the deeper `docs/guides/` set.
- **`docs/zh-tw/track-b-integration.md`** — agent count 11→12, removed the fictional `domain-expert`,
  listed the real 12, replaced `/athena:review` + `/execute` with the real commands, fixed the repo slug.
- **`README.md`** — fork links now point to the accurate getting-started AND the maintained
  `docs/guides/` (quickstart + first-epic-walkthrough); added an English "Start here" block
  (clone → `make local-setup` → `make local` + demo logins).

## Acceptance Criteria

- [x] No live `/athena:review` / `/execute` / `:8000` / `:5173` / `uv sync` / Python refs in the 3 files
      (remaining mentions are changelog "changed-from" notes + an external methodology reference).
- [x] README routes forkers to a guide that actually works on the Next.js stack.
- [x] Agent roster/counts + repo slug accurate.

## Out of Scope

- The `@saas` install skills + registry URL → **E284**. Deploy guides → **E287**.
- One-knob rebrand (`NEXT_PUBLIC_APP_NAME`) → **E285**.
