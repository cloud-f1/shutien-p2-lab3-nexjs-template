# E26 — Interactive Onboarding CLI

> **Size**: M (~1 session) | **Depends on**: E23, E24
> **Status**: pending

---

## Goal

Enhance the E21 Site Builder CLI (`scripts/new-site/`) with a `--tutorial` guided development mode that walks beginners through their first domain creation — from choosing a domain type, to scaffolding, to running tests — with contextual links to guide docs (E24, E25) at each step.

## Problem Statement

The E21 CLI successfully scaffolds a project, but its "Next Steps" output (lines 165-176 of `index.ts`) is a static 3-line list. New users face a gap between "project scaffolded" and "first feature working":

1. They don't know what kind of domain to build first
2. They don't know the E23 domain generator exists or how to use it
3. They can't verify the scaffold actually works (`make test`)
4. They have no guided path connecting quickstart (E24) → first epic walkthrough (E24) → OpenAPI patterns (E25)
5. There is no status detection — if they return later, they can't see what's done vs. what's pending

## Solution: `--tutorial` Flag + Post-Scaffold Checklist

### CLI Entry Point Change

```
npx tsx scripts/new-site/index.ts              # existing flow (unchanged)
npx tsx scripts/new-site/index.ts --tutorial    # enters guided onboarding mode
```

When `--tutorial` is passed, the CLI appends three additional steps after the existing Step 6 (Next Steps):

```
npx new-site --tutorial
  │
  ├─ Steps 1–6: (existing E21 flow — unchanged)
  │
  ├─ 7. Domain type prompt
  │     ├─ "What are you building?" (select)
  │     │   ├─ Blog        → maps to docs/templates/domain/examples/blog.yaml
  │     │   ├─ Todo App     → maps to docs/templates/domain/examples/todo.yaml
  │     │   ├─ CRM          → maps to docs/templates/domain/examples/crm.yaml
  │     │   ├─ Custom       → skip example config, link to E25 OpenAPI patterns
  │     │   └─ Skip for now → jump to checklist
  │     │
  │     ├─ Show selected example config fields
  │     ├─ Confirm: "Generate this domain with /athena:domain?"
  │     └─ (if confirmed) Print exact command to run
  │
  ├─ 8. Post-scaffold verification
  │     ├─ Run `make test` (or equivalent)
  │     ├─ Show pass/fail summary
  │     └─ On failure: show troubleshooting hints + link to quickstart.md
  │
  └─ 9. Next-steps checklist (with status detection)
        ├─ [✓/○] Prerequisites installed
        ├─ [✓/○] Project scaffolded (.build-manifest.yaml exists)
        ├─ [✓/○] Dependencies installed (node_modules/ + .venv/ exist)
        ├─ [✓/○] Database created + migrated
        ├─ [✓/○] Tests passing (`make test` exit code 0)
        ├─ [○]   First domain created (any dir in server/app/domains/ besides __init__)
        ├─ [○]   OpenAPI spec updated (docs/openapi/ modified after scaffold)
        └─ [○]   First epic started (EPIC_INDEX.md has a non-template entry)
```

## Technical Design

### File Structure

```
scripts/new-site/
  index.ts          ← modify: parse --tutorial flag, call tutorial steps
  tutorial.ts       ← NEW: tutorial orchestrator (steps 7–9)
  checklist.ts      ← NEW: status detection + checklist rendering
  types.ts          ← modify: add TutorialConfig, ChecklistItem types
  prompts.ts        ← unchanged
  checks.ts         ← unchanged
  scaffold.ts       ← unchanged
  setup.ts          ← unchanged
  manifest.ts       ← unchanged
  __tests__/
    tutorial.test.ts   ← NEW
    checklist.test.ts  ← NEW
```

### New Types (`types.ts`)

```typescript
export interface DomainChoice {
  type: "blog" | "todo" | "crm" | "custom" | "skip";
  exampleConfig?: string;  // path to example YAML
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  hint?: string;     // shown when not done
  docLink?: string;  // link to relevant guide
}

export interface TutorialResult {
  domainChoice: DomainChoice;
  testsPassed: boolean;
  checklist: ChecklistItem[];
}
```

### Step 7: Domain Type Prompt (`tutorial.ts`)

```typescript
import * as p from "@clack/prompts";
import { readFileSync } from "node:fs";
import YAML from "yaml";

const DOMAIN_OPTIONS = [
  { value: "blog",   label: "Blog (posts with title, body, published status)",
    example: "docs/templates/domain/examples/blog.yaml" },
  { value: "todo",   label: "Todo App (tasks with priority and due dates)",
    example: "docs/templates/domain/examples/todo.yaml" },
  { value: "crm",    label: "CRM (contacts with company, email, phone)",
    example: "docs/templates/domain/examples/crm.yaml" },
  { value: "custom", label: "Custom — I'll design my own domain" },
  { value: "skip",   label: "Skip for now" },
];
```

When a preset domain is selected:
1. Read the YAML example file
2. Display its fields in a formatted `p.note()` box
3. Show the command to run: `claude "/athena:domain <name>"`
4. Link to `docs/guides/first-epic-walkthrough.md` for the full SDD workflow

When "Custom" is selected:
1. Link to `docs/guides/openapi-patterns.md` for designing their API spec
2. Link to `docs/guides/first-epic-walkthrough.md` for the epic pipeline
3. Briefly explain the SDD workflow: OpenAPI first → server → client

### Step 8: Post-Scaffold Verification (`tutorial.ts`)

Run `make test` via `execFileSync` and capture exit code:

```typescript
function runVerification(projectRoot: string): StepResult {
  try {
    execFileSync("make", ["test"], {
      cwd: projectRoot,
      timeout: 120_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { step: "verify_tests", status: "pass", at: timestamp() };
  } catch (err) {
    return {
      step: "verify_tests",
      status: "fail",
      at: timestamp(),
      error: "Some tests failed. See docs/guides/quickstart.md for troubleshooting.",
    };
  }
}
```

On failure, show:
- The specific error summary (first 200 chars of stderr)
- Link to quickstart troubleshooting section
- Suggestion to run `make test` again after fixing

### Step 9: Checklist with Status Detection (`checklist.ts`)

Each checklist item has a detection function:

| Item | Detection Logic |
|------|----------------|
| Prerequisites installed | All `checkAllPrerequisites()` pass |
| Project scaffolded | `existsSync(".build-manifest.yaml")` |
| Dependencies installed | `existsSync("node_modules")` && `existsSync("server/.venv")` |
| Database migrated | `alembic_migrate` step in manifest has status "pass" |
| Tests passing | `make test` exit code === 0 (cached from step 8) |
| First domain created | Any subdir in `server/app/domains/` besides `__init__.py` and `__pycache__` |
| OpenAPI spec updated | `docs/openapi/` mtime > `.build-manifest.yaml` mtime |
| First epic started | `EPIC_INDEX.md` contains a non-template epic entry |

Rendering uses `@clack/prompts` formatting:

```
┌  Post-Setup Checklist
│
│  ✓  Prerequisites installed
│  ✓  Project scaffolded
│  ✓  Dependencies installed
│  ✓  Database created + migrated
│  ✓  Tests passing
│  ○  First domain created
│     → Run: claude "/athena:domain blog"
│     → Guide: docs/guides/first-epic-walkthrough.md
│  ○  OpenAPI spec updated
│     → Guide: docs/guides/openapi-patterns.md
│  ○  First epic started
│     → Run: /athena:loop
│
└  3 of 8 complete — keep going!
```

### Guide Doc Links (Contextual)

Each tutorial step links to the relevant guide:

| Step | Guide Link |
|------|-----------|
| Domain type selection | `docs/guides/first-epic-walkthrough.md` |
| "Custom" domain | `docs/guides/openapi-patterns.md` |
| Test failure | `docs/guides/quickstart.md` (troubleshooting section) |
| Checklist: domain | `docs/guides/first-epic-walkthrough.md` |
| Checklist: OpenAPI | `docs/guides/openapi-patterns.md` |
| Checklist: epic | `docs/epics/EPIC_INDEX.md` |

### Integration with `index.ts`

Minimal change to the existing flow:

```typescript
// At top of main()
const isTutorial = process.argv.includes("--tutorial");

// After existing Step 6 (Next Steps), before p.outro:
if (isTutorial) {
  const tutorialResult = await runTutorial(projectRoot, config, allSteps);
  // Append tutorial steps to manifest
  manifest.steps_completed.push(
    ...tutorialResult.checklist
      .filter(c => c.done)
      .map(c => ({ step: `checklist_${c.id}`, status: "pass" as const, at: new Date().toISOString() }))
  );
  writeManifest(projectRoot, manifest);
}
```

### Standalone Checklist Mode

The checklist should also be runnable independently for returning users:

```
npx tsx scripts/new-site/index.ts --checklist
```

This skips steps 1-8 and directly runs checklist detection + display. Useful for:
- Returning after a break — "where was I?"
- Verifying progress after manual steps
- CI validation of template readiness

## Test Plan

| Test | Type | Description |
|------|------|-------------|
| Domain prompt options | Unit | Mock @clack/prompts select, verify all 5 options available |
| Example config display | Unit | Read blog.yaml, verify field summary formatting |
| Custom domain messaging | Unit | Verify OpenAPI patterns guide link is shown |
| `make test` pass | Unit | Mock execFileSync success, verify StepResult |
| `make test` fail | Unit | Mock execFileSync throw, verify error message + guide link |
| Checklist detection: manifest exists | Unit | Create temp .build-manifest.yaml, verify item.done = true |
| Checklist detection: no domains | Unit | Empty domains dir, verify item.done = false |
| Checklist detection: domain exists | Unit | Create mock domain dir, verify item.done = true |
| Checklist rendering | Unit | Mock all items, verify formatted output matches snapshot |
| `--tutorial` flag parsing | Unit | Verify flag detected in process.argv |
| `--checklist` standalone mode | Unit | Verify skips steps 1-6, runs checklist only |
| Full tutorial flow | Integration | Temp dir, mock prompts + execFileSync, verify all 3 tutorial steps execute |

**Coverage target**: >= 80% on `tutorial.ts` and `checklist.ts`

## Acceptance Criteria

- [ ] `--tutorial` flag activates guided onboarding after existing E21 flow
- [ ] Domain type prompt offers blog, todo, crm, custom, skip options
- [ ] Selecting a preset domain shows its field summary from the E23 example YAML
- [ ] Selecting a preset domain prints the `/athena:domain <name>` command to run
- [ ] Selecting "Custom" links to `docs/guides/openapi-patterns.md`
- [ ] Post-scaffold `make test` runs and reports pass/fail
- [ ] Test failure shows troubleshooting hint + link to quickstart guide
- [ ] Checklist detects 8 status items with file/directory existence checks
- [ ] Incomplete checklist items show actionable hints + doc links
- [ ] `--checklist` standalone mode works for returning users
- [ ] Existing E21 flow (without `--tutorial`) is completely unchanged
- [ ] Unit tests >= 80% coverage on new modules
- [ ] Tutorial results appended to `.build-manifest.yaml`

## Risk Notes

- **`make test` timeout**: Test suites may take > 2 minutes on slow machines. Mitigate: 120s timeout with clear message, option to skip.
- **Domain detection false positives**: `__pycache__` or `__init__.py` in domains dir. Mitigate: filter for actual Python packages (dirs with `__init__.py` that aren't `__pycache__`).
- **Stale checklist**: If user modifies files outside the CLI, mtime-based detection may be inaccurate. Mitigate: document this as best-effort, not authoritative.

---

## Stories

### S1: Tutorial Orchestrator + Flag (3 SP)
Parse `--tutorial` flag. Add `runTutorial()` function to `tutorial.ts` that orchestrates steps 7-9. Wire into `index.ts` after existing step 6.

### S2: Domain Type Prompt (3 SP)
Interactive select with 5 options. Read E23 example YAML files, display field summary. Print `/athena:domain` command and link to guide docs.

### S3: Post-Scaffold Verification (2 SP)
Run `make test`, capture result, show pass/fail with contextual troubleshooting links.

### S4: Checklist Detection + Rendering (5 SP)
8 detection functions (file existence, mtime comparison, manifest parsing). Formatted checklist output with hints and doc links. `--checklist` standalone mode.

### S5: Tests + Polish (3 SP)
Unit tests for tutorial.ts and checklist.ts. Integration test for full tutorial flow. Snapshot test for checklist rendering.

**Total: 16 SP**
