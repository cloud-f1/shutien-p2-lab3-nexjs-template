---
description: "(epic) Pre-publish wave integration gate → merge a wave's epic branches onto a throwaway branch, run the full quality gate, and attribute any failure as own-epic vs combination-defect. Usage: `[--phase N] [--keep] [--gate GATE]`"
allowed-tools: Read, Bash, Grep, Glob
---

# Integration Gate — proving the combination, not just the parts

You are `@integrator`. Your job is the one node nothing else in the pipeline owns:
**does this wave's epics combined still work**, checked BEFORE any of them publishes.

## Why this exists — read this before touching anything

Phase 82, real incident:

| Epic | Shipped | Its own QA |
|---|---|---|
| E336 | Sidebar "管理" link → `/dashboard/admin` | ✅ PASS |
| E337 | Admin-only stat card → also links to `/dashboard/admin` | ✅ PASS |

Both epics were correct in isolation. Merged, `a[href='/dashboard/admin']` matched
**two** elements, Playwright strict mode failed, and `e2e/auth-flow.spec.ts:41` +
`e2e/dashboard-smoke.spec.ts:22` both went red — **in `main`**, undetected until a
human ran e2e by hand afterward (fixed in PR #118). Nothing was wrong with either
epic. Nothing owned the combination. `git diff --name-only` between E336 and E337
shows **zero file overlap** — a file-overlap check would have missed this entirely;
only actually running e2e against the merged result catches it. That is the gap
this command closes.

> **Read this twice: overlap detection (Step 3) is a supporting signal, not the
> safety net.** E336/E337 — the incident this whole command exists for — share
> *zero* files. Step 3 would report nothing for it. The load-bearing check is
> Step 4: actually merging the branches and running the real test suite against
> the result. Overlap detection catches a different, narrower class of risk
> (two epics editing the same file) and is worth surfacing for awareness, but do
> not mistake "no overlaps reported" for "safe to publish."

## Hard rules

- **This command NEVER publishes.** It builds one throwaway local branch, runs
  gates on it, reports, and deletes it. Publishing stays one-PR-per-epic, via the
  normal `merge` step in `loop.md` — that step runs only AFTER this gate PASSes.
- **Never auto-resolve a merge conflict.** A conflict STOPS the run. Report the
  exact branch pair and the conflicting files. A human decides the reconciliation.
- **Never touch `docs/context/epic-progress.md` or `docs/epics/EPIC_INDEX.md`.**
  Those are the per-epic step matrix (spec/impl/qa/commit/merge). This gate is a
  wave-level artifact; it logs only to `docs/context/orchestration-log.md`.
- **The integration branch is always throwaway.** Delete it (and every bisection
  probe branch — see Step 6) whether the run PASSes, FAILs, or is BLOCKED. `--keep`
  is the one exception, and even then say so explicitly in the report.
- **Only ✅-QA'd epics enter the wave.** An epic without `qa: ✅` in
  `docs/context/epic-progress.md`'s Epic Step Matrix is excluded, not force-included.
- **Re-run only the failing gate during attribution** (Step 6) — never the whole
  suite on every branch. That re-run IS the mechanism; running everything on
  everything defeats its purpose (and burns the time this command exists to save).

## Argument parsing

| Argument | Example | Default | Meaning |
|---|---|---|---|
| `--phase N` | `--phase 82` | (none) | Integrate the next not-yet-integrated wave in phase N |
| `--keep` | `--keep` | off | Do not delete the integration branch (or probe branches) after reporting — for human inspection |
| `--gate GATE` | `--gate e2e` | (none) | **Targeted re-check mode.** Skip Step 4's full 5-command suite; build the integration branch (Step 2) as normal, then jump straight to running only `GATE` (scoped per Step 5) on it. If `GATE` still fails, run Step 6 attribution scoped to it. Use this to re-verify a specific fix without paying for the whole suite again. `GATE` ∈ `typecheck\|lint\|unit\|int\|e2e` |

If neither `--phase` nor an explicit epic list is given, run **Wave Auto-Detection**
(Step 1) to find the target wave.

**`--gate` verdict semantics — read before relying on it**: a targeted re-check's
`PASS` means only "`GATE` no longer fails on this wave's combination" — it says
nothing about the other four gates. Set `"scope": "targeted:<gate>"` in the report
(instead of `"scope": "full"`) and treat this run as **advisory only** — it never
authorizes publish on its own. The caller must still obtain a `"scope": "full"`
`PASS` (a plain `/athena:integrate` run, no `--gate`) before any epic in the wave
merges. `--gate` exists to make iterating on a fix cheap, not to shortcut the gate.

## Step 1: Resolve the target wave

1. If `--phase N` given: `bash scripts/epic-graph.sh --phase N --pending-only --json`
   → parse `.waves[]`. Pick the **first wave, in order**, where every epic in it
   satisfies **both**:
   - a branch exists for it — check local first (`git branch --list "feat/E{n}-*"`),
     then remote (`git ls-remote --heads origin "feat/E{n}-*"`)
   - `docs/context/epic-progress.md`'s Epic Step Matrix has `qa: ✅` for it AND
     `merge` is **not yet** `✅` (already-published epics have nothing to integrate)
   If a wave has SOME qualifying epics and some not-yet-QA'd ones, it is not this
   wave's turn — skip it and check the next. If NO wave in the phase qualifies,
   report `"nothing to integrate — no wave has all branches QA-complete and
   unpublished"` and EXIT 0.
2. **Wave Auto-Detection** (no `--phase`): scan phases in `epic-graph.sh --json
   --pending-only` order (all phases, not just one) and apply the same per-wave
   test as above; take the first phase+wave that qualifies.
3. Record `PHASE`, `WAVE`, and the epic list `EPICS=(E{a} E{b} ...)` for the rest
   of the run. Resolve each epic's exact branch name and whether it's local-only
   or needs a `git fetch origin` first.

## Step 2: Build the throwaway integration branch

```bash
git fetch origin
git checkout -b "integration/phase${PHASE}-wave${WAVE}" origin/main
for E in "${EPICS[@]}"; do
  BRANCH=$(git branch --list "feat/${E}-*" | sed 's/^[* ]*//' | head -1)
  [ -z "$BRANCH" ] && BRANCH="origin/$(git ls-remote --heads origin "feat/${E}-*" | sed 's#.*refs/heads/##' | head -1)"
  if ! git merge --no-ff "$BRANCH" -m "merge: integrate ${E} into integration/phase${PHASE}-wave${WAVE}"; then
    # CONFLICT — stop here, do not resolve.
    CONFLICTS=$(git diff --name-only --diff-filter=U)
    echo "BLOCKED: merge conflict bringing $E ($BRANCH) into the integration branch."
    echo "Conflicting files: $CONFLICTS"
    echo "Likely pair: $E vs whichever already-merged epic last touched these files —"
    echo "cross-reference with: git log --oneline -1 -- <file> (on the integration branch, pre-merge)"
    git merge --abort
    git checkout - && git branch -D "integration/phase${PHASE}-wave${WAVE}"
    # Report BLOCKED verdict (see Integration Gate Report schema) and EXIT.
  fi
done
```

Merge order = epic ID ascending (deterministic, matches the epic-graph wave's own
listing order). This only affects which conflict message names "the newly-added
branch" — the reported file list is correct regardless of order.

## Step 3: Cross-branch file overlap (informational, not blocking)

For every pair of epics in the wave:

```bash
comm -12 \
  <(git diff --name-only origin/main..."origin/feat/${A}-slug" | sort) \
  <(git diff --name-only origin/main..."origin/feat/${B}-slug" | sort)
```

(substitute each epic's real branch name). List every non-empty intersection in
the report as `fileOverlaps`. An overlap is **not** automatically wrong — E339
legitimately touched E338's `_items-table.tsx` because it's a natural evolution of
the same file — but it IS exactly where a combination defect is most likely, so it
must always be surfaced for human awareness even when every gate below passes.

**Worked example of the overlap-listing mechanism itself (not a same-wave case —
see the label below):** the E338/E339 pair (Phase 82, PRs #112 and #115) really
did overlap on two files: `next-app/app/(dashboard)/dashboard/items/_items-table.tsx`
and `next-app/e2e/items-mobile.spec.ts`. **Important caveat**: E338 shipped in
Wave 1 and merged to `main` before E339 (Wave 2) was even built on top of it — this
is the *sequential* case (a later epic extending an already-merged file), not the
*simultaneous* same-wave case Step 3 actually targets (two branches, neither yet
merged, diffed against a common `origin/main`). It's kept here only to illustrate
what an overlap listing looks like and that an overlap is not automatically wrong
(E339 legitimately extended E338's table) — it is not a validated example of Step
3 catching a same-wave overlap, since these two epics were never in the same wave
together. No real same-wave overlap case has been observed yet in this repo's
history; the mechanism itself is a straightforward `comm -12` diff and does not
depend on wave-simultaneity to work correctly.

## Step 4: Full gate on the merged branch

**If `--gate GATE` was passed, skip this entire step** — go directly to Step 5/6
with `G = GATE` and `scope = "targeted:<GATE>"`, running only that one command
(scoped as in Step 5) against `integration/phase${PHASE}-wave${WAVE}`. If it
passes, report `verdict: PASS` with `scope: "targeted:<GATE>"` (advisory — see
Argument Parsing above) and skip straight to Step 7. If it fails, continue to
Step 6 attribution scoped to `GATE` only. Everything below this line is the
default (`scope = "full"`) path.

All commands from `next-app/`, on `integration/phase${PHASE}-wave${WAVE}`:

```bash
cd next-app
pnpm typecheck
pnpm lint
pnpm test:coverage
pnpm test:int
pnpm db:e2e-setup && pnpm test:e2e
```

Record each command's exit code and (for `test:e2e`) the list of failing spec
files/test names from Playwright's output. **e2e is mandatory, not optional** —
Phase 82's defect was invisible to typecheck/lint/unit/int; only e2e caught it.
Do not accept "skipped" as a pass for this gate.

After each command, emit a verification event (Stop Rule #23 discipline):

```bash
bash scripts/hooks/audit-emit-verification.sh "integrate:<gate>" <exit_code> || true
```

### The one pre-authorized carve-out

`e2e/two-factor.spec.ts:103` ("enable 2FA from Settings → Security") is a known
pre-existing failure (TOTP env-window issue, Phase 72 #51) that has appeared in
every QA round since without being caused by the epic under test. This gate MAY
treat it as non-blocking, but only when **both** hold:

1. It is the **only** failure (plus its known dependent-skip cluster) — any other
   failing spec means this carve-out does not apply.
2. `git diff origin/main..."<branch>" --stat | grep -iE 'two-factor|totp|2fa'` is
   **empty for every branch in the wave** — confirmed, not assumed.

If both hold, record `e2eCarveOut: {applied: true, test: "e2e/two-factor.spec.ts:103",
reason: "pre-existing, Phase 72 #51"}` in the report and treat the e2e gate as PASS.
Do **not** invent any other carve-out, and do not widen this one to cover a
different failing spec "because it's probably unrelated" — attribution (Step 6)
exists precisely so you never have to guess that.

If all gates pass (post carve-out): verdict = **PASS**. Go to Step 7 (cleanup +
report). If any gate fails: go to Step 6 (attribution) — but ONLY for the failing
gate(s).

## Step 5 (implicit): scope of what "a gate" means for attribution

Attribution re-runs must be scoped as narrowly as the failure:
- `typecheck` / `lint` — re-run the same bare command.
- `unit` (`test:coverage`) — re-run `pnpm vitest run <failing test file>` if the
  failure names specific files; otherwise the full `test:coverage` (unit tests are
  fast — this is still cheap).
- `int` (`test:int`) — same narrowing as unit, using the int config.
- `e2e` — re-run **only the failing spec file(s)**:
  `pnpm exec playwright test --project=chromium <spec-file> [<spec-file> ...]`.
  This is what makes attribution cheap even though e2e is the slowest gate.

### DB re-provisioning rule for e2e attribution probes (read before Step 6)

`test:int` needs no rule here — it creates its own fresh, uniquely-named throwaway
database per run (`setupTestDb()` in `test/int/harness.ts`) and drops it at
teardown, so switching branches between probes cannot leak state into it.

`e2e` is different: `pnpm db:e2e-setup` provisions the **persistent** `saas_dev_e2e`
database once, and every subsequent `pnpm test:e2e` / `pnpm exec playwright test`
just runs against whatever schema/seed is already sitting there. Step 6 checks out
a *different* branch for every probe (solo checks in 6a, incremental merges in
6b) — if any of those branches carries a Drizzle migration, a probe that skips
re-provisioning runs against the *previous* branch's schema, producing a
pass/fail result that reflects DB drift, not the code difference. An attribution
built on that is confidently wrong, which is worse than no attribution.

**Default (always safe): re-run `pnpm db:e2e-setup` immediately before every e2e
probe** (every branch switch in 6a and every incremental merge step in 6b) —
it's a scripted drop→create→migrate→seed and cheap relative to the Playwright run
it precedes.

**Allowed optimization**: check once, up front, whether the wave touches any
migration at all —
```bash
git diff --name-only origin/main..."integration/phase${PHASE}-wave${WAVE}" -- next-app/drizzle/migrations/
```
If this is **empty** (no epic in the wave added a migration), the schema is
identical across every branch combination and a single `pnpm db:e2e-setup` at the
start of Step 6 is sufficient — skip the per-probe re-provisioning. If it is
**non-empty**, re-provision before every probe (the default rule) — do not try to
guess which specific probes need it.

## Step 6: Combination-specific failure attribution

This is the node's core value — the thing a human finds tedious and a machine
finds easy. For the failing gate `G` (scoped per Step 5):

**6a. Solo pass/fail per epic.** For each epic `E` in the wave:
```bash
git checkout -b "integration/_probe-${E}" origin/main
git merge --no-ff "feat/${E}-slug"   # single epic, no conflict possible (already in wave)
# If G == e2e and the DB re-provisioning rule (above) says to: pnpm db:e2e-setup
# run G, scoped, exactly as in Step 5
git checkout - && git branch -D "integration/_probe-${E}"
```
Record PASS/FAIL per epic.

- **Any epic FAILs solo** → that epic owns an independent defect. Report it
  against that epic specifically (`attribution: [{type: "own-epic", epic: "E{n}",
  gate: G, ...}]`). It is excluded from the combination search below — its solo
  failure already explains its share of the wave failure.
- **Every epic PASSes solo** → the failure only exists in combination. Continue to 6b.

**6b. Bisect to the minimal reproducing subset.** Using only the epics that passed
solo (call this set `S`, in the wave's epic-ID order):

1. Build incrementally: start a fresh `integration/_bisect` branch from
   `origin/main`, merge `S[0]`, (if `G == e2e`, apply the DB re-provisioning rule
   above before running it) run `G` (scoped) → expected PASS (6a already proved
   this). Merge `S[1]` on top, re-provision again if the rule calls for it, run
   `G` again. Continue merging `S[i]` one at a time — re-provisioning before each
   run per the same rule — until `G` flips to FAIL. Call the epic whose addition
   flipped it the **trigger**, and the accumulated-and-still-passing set before it
   the **baseline**.
2. If `|baseline| == 1` (the common case — e.g. a 2-epic wave): the pair is
   `(baseline[0], trigger)`. Report it directly — no further narrowing needed.
   **This is exactly the Phase 82 shape**: wave = {E336, E337}, both pass solo,
   merging E336 alone still passes the affected specs, adding E337 on top flips
   them to FAIL → pair = (E336, E337).
3. If `|baseline| > 1`: narrow further — for each `b` in `baseline`, build
   `origin/main` + `b` + `trigger` alone (a fresh 2-epic branch) and run `G`
   scoped. The first `b` that reproduces the FAIL gives the pair `(b, trigger)`.
   If NO single `b` reproduces it alone, the defect is a genuine 3-or-more-way
   combination — report the full minimal reproducing set found (do not force a
   pair where none exists), flagged `type: "combination"` with all implicated
   epics listed.
4. **Re-confirm before finalizing — do not report `"combination"` off a single
   failing run.** This repo already has one known-flaky test (`two-factor.spec.ts:103`);
   a different intermittent flake landing on whichever branch state step 2 or 3 just
   settled on would otherwise produce a confident, well-formatted, *wrong*
   attribution — which costs more than no attribution, because someone will go
   fix the wrong two epics. On the exact branch state that just reproduced the
   FAIL (the pair/subset found in step 2 or 3, still checked out), re-run `G`
   (scoped, same DB re-provisioning rule as above) **one more time** — no more:
   - **Both runs FAIL** → confirmed. Proceed to 6c with `type: "combination"`.
   - **The second run PASSes** → the failure did not reproduce. Report
     `type: "flaky"` instead, with **both** results (`["fail", "pass"]`, in
     order) and the epics/gate involved, and do **not** name an interacting pair
     — an unconfirmed pairing is worse than admitting it's inconclusive.
5. Delete every probe/bisect branch created during this step, regardless of
   outcome — same rule as Step 2/7.

**6c. Report.** For each attribution finding:
```json
{"type": "own-epic" | "combination" | "flaky", "epics": ["E{n}", ...], "gate": "e2e",
 "tests": ["e2e/auth-flow.spec.ts:41", "e2e/dashboard-smoke.spec.ts:22"],
 "detail": "<one line — what broke and why, if inferable from the diff/selector>",
 "reconfirmRuns": ["fail", "pass"]}
```
`reconfirmRuns` is present only on `type: "flaky"` (step 6b.4) — the two results,
in order, that disagreed. `own-epic` and `combination` findings omit it (a
`combination` finding by definition passed the re-confirm: both runs agreed).

### Worked example — Phase 82 replay (E336 + E337), since the live branches are gone

The real branches were squash-merged and deleted (PRs #111, #114), so a literal
re-run of Steps 2–6 against them is not possible today. This is stated plainly,
not glossed over — here is the walk-through of what the algorithm produces against
that scenario, using the actual historical facts (confirmed via `gh pr view 111
--json files` / `gh pr view 114 --json files` / PR #118's diff):

- Wave = {E336, E337}. `git diff --name-only` shows **zero file overlap** between
  them (E336: `lib/nav.ts` + sidebar/nav components; E337: `components/dashboard/*`
  + dashboard page) — Step 3's overlap check would report **no overlaps**, correctly,
  because the defect was never about shared files.
- Step 4 (full gate on the merged branch): e2e fails —
  `e2e/auth-flow.spec.ts:41` and `e2e/dashboard-smoke.spec.ts:22`, both hitting
  `a[href='/dashboard/admin']` matching 2 elements (Playwright strict-mode error).
- Step 6a (solo): E336 alone → both specs PASS (only E336's sidebar link exists).
  E337 alone → both specs PASS (E337's stat card exists, but the strict-mode
  selector only matches one element without E336's sidebar link also present).
  Both PASS solo.
- Step 6b: `|wave| == 2`, so `baseline = {E336}` after merging it alone (still
  passing); merging `E337` on top flips both specs to FAIL. `|baseline| == 1` →
  pair reported directly: `(E336, E337)`.
- Verdict: `{"type": "combination", "epics": ["E336","E337"], "gate": "e2e",
  "tests": ["e2e/auth-flow.spec.ts:41","e2e/dashboard-smoke.spec.ts:22"],
  "detail": "both link to /dashboard/admin; combined DOM breaks the
  a[href='/dashboard/admin'] strict-mode selector"}` — matching the actual fix in
  PR #118 (selector narrowed to
  `a[data-sidebar='menu-button'][href='/dashboard/admin']`).

## Step 7: Cleanup + report

1. Delete `integration/phase${PHASE}-wave${WAVE}` (and confirm no probe/bisect
   branches survive: `git branch --list "integration/_*"` should be empty) —
   **unless** `--keep` was passed, in which case leave it and say so in the report.
2. Append one row to `docs/context/orchestration-log.md`, same table convention
   the post-merge Step 4c gate already uses, labeled to distinguish the two:
   ```markdown
   | Pre-Publish Integration (E344) | Phase {N} Wave {M} | ✅ PASS / ❌ FAIL / ⛔ BLOCKED | — | epics: {list}; {gate summary}; {attribution summary if FAIL} |
   ```
3. Emit the audit event. `EPICS` is a bash **array** (set in Step 1.3) — a bare
   `"$EPICS"` silently expands to only `${EPICS[0]}`, under-recording every
   multi-epic wave as if it were single-epic. Join it explicitly:
   ```bash
   EPICS_JOINED=$(IFS=,; echo "${EPICS[*]}")
   bash scripts/hooks/audit-emit-pipeline.sh integration_gate phase=$PHASE wave=$WAVE epics="$EPICS_JOINED" verdict=$VERDICT || true
   ```
4. Return the **Integration Gate Report**.

### Integration Gate Report (schema)

```json
{
  "verdict": "PASS" | "FAIL" | "BLOCKED",
  "scope": "full" | "targeted:<gate>",
  "phase": "N",
  "wave": "M",
  "epics": ["E336", "E337"],
  "integrationBranch": "integration/phase82-wave1",
  "kept": false,
  "fileOverlaps": [{"epics": ["E338", "E339"], "files": ["next-app/app/(dashboard)/dashboard/items/_items-table.tsx", "next-app/e2e/items-mobile.spec.ts"]}],
  "gateResults": {"typecheck": "pass", "lint": "pass", "unit": "pass", "int": "pass", "e2e": "fail"},
  "e2eCarveOut": {"applied": false},
  "attribution": [
    {"type": "combination", "epics": ["E336", "E337"], "gate": "e2e",
     "tests": ["e2e/auth-flow.spec.ts:41", "e2e/dashboard-smoke.spec.ts:22"],
     "detail": "both link to /dashboard/admin; combined DOM breaks the selector"}
  ],
  "conflict": null
}
```

`conflict` is populated only on `BLOCKED`:
`{"epics": ["E{a}", "E{b}"], "files": ["path1", "path2"]}`.

## What the caller does with the verdict

- **PASS with `scope: "full"`** → the caller (`/athena:batch` Step 4a-integrate,
  `/athena:loop`, or a human) proceeds to publish every epic in the wave (the
  normal `merge` step).
- **PASS with `scope: "targeted:<gate>"`** → advisory only, per the `--gate`
  semantics above. Confirms one previously-failing gate is fixed; does NOT
  authorize publish. Run a full (`scope: "full"`) `/athena:integrate` next.
- **FAIL** → the caller **stops publish for the whole wave**. Epics named in an
  `own-epic` attribution go back to that epic (❌, fix + re-QA, no state-matrix
  write from this command — the epic's own qa/implement cells are what a human or
  a follow-up agent flips). Epics named in a `combination` attribution require a
  fix that reconciles both — typically in whichever epic is easier to adjust
  (Phase 82's fix landed as a follow-up PR, not a re-open of either original epic).
  An attribution of `flaky` means the failure did not survive its re-confirm run
  (Step 6b.4) — do not act on it as if it named a defect; re-run
  `/athena:integrate` from scratch (a fresh Step 4 full-suite run) to see whether
  it recurs, and only escalate to a human if it does so repeatedly. Re-run
  `/athena:integrate` after any real fix lands on the relevant branch(es).
- **BLOCKED** → the caller stops and reports the conflicting branch pair + files.
  No gate ran; nothing to attribute. A human resolves the conflict on one of the
  branches, then re-run.
