---
name: athena-loop-speedups
description: >-
  The orchestration practices that turn a slow, serial "run → fail → guess → re-run" dev grind into a
  fast, reliable loop in this repo. Use this skill whenever you are planning or executing epics,
  dispatching parallel subagents or a Workflow (/athena:flow, /athena:batch, /athena:loop, or ad-hoc
  Agent fan-out), running QA, picking models for subagents, or debugging slow / flaky e2e — even if
  the user just says "speed this up", "run the epics", "fix the tests", or "why is this taking so
  long". Consult it BEFORE you fan out agents or kick off a wave; it changes how you set up the work,
  not just how you finish it.
---

# Athena Loop Speedups

These practices come from a real retrospective (`docs/context/loop-speedup-retro.md`): across ~10
epics, almost all the wall-clock went to *discovering pre-existing breakage one bug at a time* and to
one-time foundation work — not to writing features. Each rule below targets a specific way the loop
was slow. The goal is to make the *next* batch of epics finish in roughly one build+test cycle.

## 1. Green baseline first — before any feature work

If the app isn't already green (build + unit + one **real** end-to-end login that lands on the
dashboard), establish that *first*. When the baseline is broken but untested, every feature you stack
on top falls over for a different reason and you find them serially — 6 cycles instead of 1. A
regression against a known-green baseline shows up in the very next run.

Concretely: `pnpm build` + `pnpm test` (Vitest) + `pnpm test:e2e` (a login→dashboard flow) green
before starting. If they're not, fixing them *is* the first task.

## 2. Smoke the real critical path before stacking on it

A probe that checks status codes / redirects is not a test — it reports green while the most important
flow (login) is completely broken (see `nextjs-saas-patterns` → JWT sessions). Spend five minutes
proving the real path works (actually sign in, actually land, actually mutate) before building four
epics on top of it. The cheapest bug is the one you catch before it has dependents.

## 3. Log-first debugging — read the server log before you guess

On any failure, read the server log (`/tmp/*-dev.log`, `docker compose logs web`) **before**
hypothesizing or re-running. The two worst bugs this repo hit (credentials login returning null;
sidebar tooltips crashing every dashboard page) were each one line in the server log. Guess-and-rerun
costs minutes per cycle; reading the log costs seconds and usually hands you the answer.

## 4. Warm server + targeted tests, not cold full-suite re-runs

Keep ONE dev server up and run `npx playwright test -g "<name>" --workers=2` against it while
iterating. Cold-booting the whole suite per change burns a 60–120s Next compile every time and invites
port-contention flakiness. (`playwright.config.ts` already has `reuseExistingServer` + a 120s boot
timeout.) Run the full suite once at the end, not on every edit. If a port is stuck, `pkill -9 -f
"next dev"` and re-check before assuming a code bug.

## 5. Parallelize independent work; minimize the serial part

Independent epics/tasks should run as parallel agents — that part is fast. The slow part is always
the *serial shared-debugging* afterward, so the lever is to shrink it by getting the foundation right
(rules 1–2) and by isolating parallel work cleanly:

- **Disjoint file scopes** (e.g. one agent owns `app/(auth)/`, another `app/(dashboard)/`): run
  same-tree in parallel — cheap, no worktree overhead. Confirm non-overlap by reading the specs first.
- **Overlapping files**: give each agent its own **git worktree** (`isolation: "worktree"` on the
  Agent tool, the default in `/athena:batch`) so they can't clobber each other, then merge back.
- **Code changes that genuinely overlap and must compose** (e.g. five fixes touching the same files):
  run them **sequentially** as phases of one Workflow — still gives the live `/workflows` screen,
  zero conflicts. Read-only fan-out (audits, reviews) parallelizes freely.

## 6. Pick each agent's model by task complexity — not blanket Opus

A subagent with no `model` set inherits the main-loop model (often Opus) — so a wave of trivial epics
all run on the most expensive model. Tier it instead, mirroring the agent team (doers = sonnet,
deep-design = opus):

- Source the baseline from the effort map: `ATHENA_MODEL_MAP`'s `execute` (sonnet at
  quick/standard/thorough, opus at ultra) — see `scripts/effort/resolve.sh`.
- Escalate a *complex* epic (size L/XL, or anything touching auth/security/migrations/multi-file
  features) to `opus`; keep simple epics on `sonnet`.
- This is wired into `/athena:flow` and `/athena:batch` dispatch. For ad-hoc `Agent` fan-out, set
  `model:` explicitly the same way.

## 7. The pre-merge gate is mandatory, and QA must actually run it

- **Never merge on a red or unverified tree.** Run `scripts/pre-merge-check.sh [--e2e]` (repo
  hygiene + typecheck + lint + unit, optionally e2e) before any push/PR/merge. It once correctly
  blocked pushing a half-migrated tree with 464 uncommitted deletions.
- **"Must actually run it":** no epic touching an auth flow, a Server Action, a DB query, or a route
  may pass QA on review + unit tests alone. A real `pnpm test:e2e` that exercises the user flow is a
  required gate — static review and unit tests cannot catch integration bugs (session wiring, query
  shape, redirect handling). This is codified in `/athena:qa`.
- **Adversarially verify findings.** When auditing/reviewing, send each finding to an independent
  verifier prompted to *refute* it against the real code before reporting — it rejects plausible-but-
  wrong findings (in the app-audit, 3 of 35 were false positives caught this way).

## When you're deep / looping

If context is getting long or you're stuck in a loop, **hand the next well-scoped chunk to a fresh
subagent** with full context rather than grinding in a saturated context. Orchestrate and verify from
the main loop; let fresh agents do the heavy isolated work.

## Pointers

- `docs/context/loop-speedup-retro.md` — the full retrospective these rules came from.
- `.claude/commands/athena/{flow,batch,loop,qa}.md` — where the practices are operationalized.
- `nextjs-saas-patterns` — the stack-specific bugs that motivated rules 1–3.
