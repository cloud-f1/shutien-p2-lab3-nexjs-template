# Athena Core Plugin — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `athena-core`, a Claude Code plugin that ports the universal meta-workflow of the AI Coding Template's Athena system — memory tiers, planning, autopilot, review-loop, stop-verifier framework, agent roster — into a single distributable plugin installable in any project.

**Architecture:** A Claude Code plugin at `/Users/MH/Documents/git_saas/athena-core/` with Athena-native internal layout (`commands/athena/`, flat `agents/`, separate `scripts/hooks/` + `scripts/memory/`). Two-root path resolution in hooks (`${CLAUDE_PLUGIN_ROOT}` for plugin scripts, `$PROJECT_ROOT` for user's repo state). Truly global Tier 0 memory at `~/.claude/athena-memory/`; per-project Tier 1 at `<project>/docs/context/`. Gateway skill + description-driven auto-trigger. Forward-compat extension registry so Phase 2 `athena-saas-profile` drops in without restructuring.

**Tech Stack:** Bash 4+, Claude Code plugin manifest format, jq (for JSON manipulation in hooks), git (for project-root detection), bats-core (test harness). No runtime dependencies beyond standard POSIX + bash + jq.

**Source spec:** `docs/superpowers/specs/2026-05-19-athena-core-plugin-design.md` (commit `616cd2b`).

**Plugin location:** `/Users/MH/Documents/git_saas/athena-core/` — sibling to this repo, will become its own git repo. All file paths in this plan are absolute or relative to that root.

**Milestone summary (9 milestones, ~74 tasks):**

| # | Milestone | Tasks | Verifiable artifact |
|---|---|---|---|
| M1 | Scaffolding | 5 | Installable empty plugin |
| M2 | Memory subsystem | 8 | score.sh + match.sh + inject.sh working on python-mini fixture |
| M3 | Hooks subsystem | 8 | All 6 hook scripts + 10 stop-rules firing in test fixture |
| M4 | Skills | 6 | 6 skills auto-loaded via gateway |
| M5 | Agents | 11 | All 11 agents universalized, no stack-specific refs |
| M6 | Commands | 17 | All 17 commands universalized + smoke-pass |
| M7 | Seed memory | 8 | 8 sanitized lessons, no FastAPI/React/openapi refs |
| M8 | Install flow + docs | 6 | First-install seeds Tier 0; README/INSTALL/MIGRATION written |
| M9 | Test harness + smoke | 5 | `run-all.sh` green on all 3 fixtures, tag v1.0.0-alpha |

---

## Milestone 1: Scaffolding (5 tasks)

**Files:**
- Create: `/Users/MH/Documents/git_saas/athena-core/` (new directory)
- Create: `/Users/MH/Documents/git_saas/athena-core/.claude-plugin/plugin.json`
- Create: `/Users/MH/Documents/git_saas/athena-core/.claude-plugin/marketplace.json`
- Create: `/Users/MH/Documents/git_saas/athena-core/package.json`
- Create: `/Users/MH/Documents/git_saas/athena-core/tests/fixtures/empty-project/.gitkeep`
- Create: `/Users/MH/Documents/git_saas/athena-core/tests/fixtures/nodejs-mini/package.json`
- Create: `/Users/MH/Documents/git_saas/athena-core/tests/fixtures/python-mini/pyproject.toml`
- Create: `/Users/MH/Documents/git_saas/athena-core/install.sh`

### Task 1.1: Initialize plugin directory + git repo

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p /Users/MH/Documents/git_saas/athena-core/{.claude-plugin,skills,agents,commands/athena,hooks,scripts/{lib,memory,hooks,stop-rules},seed-memory,tests/fixtures/{empty-project,nodejs-mini,python-mini}}
cd /Users/MH/Documents/git_saas/athena-core
git init
echo "node_modules/\n.DS_Store\n*.log" > .gitignore
```

- [ ] **Step 2: Verify structure**

Run: `find /Users/MH/Documents/git_saas/athena-core -type d | sort`
Expected: lists all created directories.

- [ ] **Step 3: Commit**

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add .gitignore
git commit -m "chore: initialize athena-core plugin repository"
```

### Task 1.2: Write `plugin.json` manifest

- [ ] **Step 1: Create plugin.json**

Create `/Users/MH/Documents/git_saas/athena-core/.claude-plugin/plugin.json`:

```json
{
  "name": "athena-core",
  "version": "0.1.0",
  "description": "Universal meta-workflow for Claude Code: memory tiers, planning, autopilot, review-loop, stop-verifier framework.",
  "author": "Athena project (originated in ai-coding-template)",
  "license": "MIT",
  "athena": {
    "extensionPoints": {
      "stop-rules": "scripts/stop-rules/",
      "commands": "commands/athena/",
      "agents": "agents/",
      "skills": "skills/",
      "spec-formats": ["openapi", "proto", "typespec", "freeform"]
    }
  }
}
```

- [ ] **Step 2: Validate JSON**

Run: `jq . /Users/MH/Documents/git_saas/athena-core/.claude-plugin/plugin.json`
Expected: parses without error, prints back the JSON.

- [ ] **Step 3: Commit**

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add .claude-plugin/plugin.json
git commit -m "feat: add plugin.json manifest with athena extension registry"
```

### Task 1.3: Write `marketplace.json` + `package.json`

- [ ] **Step 1: Create marketplace.json**

Create `/Users/MH/Documents/git_saas/athena-core/.claude-plugin/marketplace.json`:

```json
{
  "name": "athena-core",
  "displayName": "Athena Core",
  "version": "0.1.0",
  "description": "Universal meta-workflow plugin for Claude Code: memory, planning, autopilot, stop-verifier.",
  "categories": ["workflow", "memory", "quality"],
  "keywords": ["athena", "memory", "planning", "review", "tdd", "verification"],
  "homepage": "https://github.com/<github-username>/athena-core",
  "repository": "https://github.com/<github-username>/athena-core.git",
  "license": "MIT"
}
```

- [ ] **Step 2: Create package.json**

Create `/Users/MH/Documents/git_saas/athena-core/package.json`:

```json
{
  "name": "athena-core",
  "version": "0.1.0",
  "description": "Athena Core Claude Code plugin",
  "scripts": {
    "test": "bash tests/run-all.sh"
  },
  "license": "MIT"
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add .claude-plugin/marketplace.json package.json
git commit -m "feat: add marketplace metadata + package.json"
```

### Task 1.4: Create test fixtures

- [ ] **Step 1: empty-project fixture**

```bash
cd /Users/MH/Documents/git_saas/athena-core/tests/fixtures/empty-project
git init
touch .gitkeep
git add .gitkeep
git -c user.email=test@test git -c user.name=test commit -m "init" --allow-empty
```

- [ ] **Step 2: nodejs-mini fixture**

Create `/Users/MH/Documents/git_saas/athena-core/tests/fixtures/nodejs-mini/package.json`:

```json
{
  "name": "nodejs-mini",
  "version": "0.0.1",
  "description": "Test fixture for athena-core plugin"
}
```

```bash
cd /Users/MH/Documents/git_saas/athena-core/tests/fixtures/nodejs-mini
echo "console.log('hello');" > index.js
git init && git add . && git -c user.email=test@test -c user.name=test commit -m "init"
```

- [ ] **Step 3: python-mini fixture**

Create `/Users/MH/Documents/git_saas/athena-core/tests/fixtures/python-mini/pyproject.toml`:

```toml
[project]
name = "python-mini"
version = "0.0.1"
description = "Test fixture for athena-core plugin"
```

```bash
cd /Users/MH/Documents/git_saas/athena-core/tests/fixtures/python-mini
echo "print('hello')" > main.py
git init && git add . && git -c user.email=test@test -c user.name=test commit -m "init"
```

- [ ] **Step 4: Verify**

Run: `ls /Users/MH/Documents/git_saas/athena-core/tests/fixtures/*/`
Expected: 3 fixtures, each with content + .git/.

- [ ] **Step 5: Commit (parent repo)**

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add tests/fixtures/
git commit -m "test: add 3 fixture projects (empty, nodejs-mini, python-mini)"
```

### Task 1.5: Smoke test — manifest validates as plugin

- [ ] **Step 1: Write smoke test**

Create `/Users/MH/Documents/git_saas/athena-core/tests/test-install.sh`:

```bash
#!/bin/bash
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Validate plugin.json
jq -e '.name == "athena-core"' "$PLUGIN_ROOT/.claude-plugin/plugin.json" >/dev/null
echo "PASS: plugin.json valid"

# Validate marketplace.json
jq -e '.name == "athena-core"' "$PLUGIN_ROOT/.claude-plugin/marketplace.json" >/dev/null
echo "PASS: marketplace.json valid"

# Validate extension points registry
jq -e '.athena.extensionPoints["stop-rules"] == "scripts/stop-rules/"' "$PLUGIN_ROOT/.claude-plugin/plugin.json" >/dev/null
echo "PASS: extension registry present"
```

- [ ] **Step 2: Make executable + run**

```bash
chmod +x /Users/MH/Documents/git_saas/athena-core/tests/test-install.sh
/Users/MH/Documents/git_saas/athena-core/tests/test-install.sh
```

Expected: 3 PASS lines, exit code 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add tests/test-install.sh
git commit -m "test: add manifest validation smoke test"
```

---

## Milestone 2: Memory subsystem (8 tasks)

**Files (all under `/Users/MH/Documents/git_saas/athena-core/`):**
- Create: `scripts/lib/common.sh`
- Create: `scripts/memory/score.sh` (port from source repo `scripts/memory/score.sh`)
- Create: `scripts/memory/match.sh` (port from source repo)
- Create: `scripts/memory/inject.sh` (port from source repo)
- Create: `scripts/memory/half-life-resolve.sh` (port from source repo)
- Create: `scripts/memory/half-life-defaults.json` (port from source repo)
- Create: `tests/test-memory-loop.sh`
- Create: `tests/test-match-inject.sh`

**Source location for ports:** `/Users/MH/Documents/git_saas/ai-coding-template/scripts/memory/`

### Task 2.1: Write `scripts/lib/common.sh` (two-root resolution)

- [ ] **Step 1: Write failing test**

Create `/Users/MH/Documents/git_saas/athena-core/tests/test-common.sh`:

```bash
#!/bin/bash
set -euo pipefail
export CLAUDE_PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd /tmp
source "$CLAUDE_PLUGIN_ROOT/scripts/lib/common.sh"
[[ "$PLUGIN_ROOT" == "$CLAUDE_PLUGIN_ROOT" ]] || { echo "FAIL: PLUGIN_ROOT mismatch"; exit 1; }
[[ -n "$PROJECT_ROOT" ]] || { echo "FAIL: PROJECT_ROOT empty"; exit 1; }
echo "PASS: two-root resolution works"
```

- [ ] **Step 2: Run test — expect fail**

Run: `chmod +x /Users/MH/Documents/git_saas/athena-core/tests/test-common.sh && /Users/MH/Documents/git_saas/athena-core/tests/test-common.sh`
Expected: FAIL (file doesn't exist yet).

- [ ] **Step 3: Implement `scripts/lib/common.sh`**

Create `/Users/MH/Documents/git_saas/athena-core/scripts/lib/common.sh`:

```bash
#!/bin/bash
# Common helpers for athena-core plugin scripts.
# Source this from every hook + memory script.

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:?CLAUDE_PLUGIN_ROOT must be set by Claude Code runtime}"
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

ATHENA_MEMORY_DIR="${HOME}/.claude/athena-memory"
ATHENA_META_DIR="${ATHENA_MEMORY_DIR}/.meta"
PROJECT_CONTEXT_DIR="${PROJECT_ROOT}/docs/context"
PROJECT_AUDIT_LOG="${PROJECT_ROOT}/.claude/audit.jsonl"

export PLUGIN_ROOT PROJECT_ROOT ATHENA_MEMORY_DIR ATHENA_META_DIR PROJECT_CONTEXT_DIR PROJECT_AUDIT_LOG
```

- [ ] **Step 4: Run test — expect pass**

Run: `/Users/MH/Documents/git_saas/athena-core/tests/test-common.sh`
Expected: `PASS: two-root resolution works`, exit 0.

- [ ] **Step 5: Commit**

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add scripts/lib/common.sh tests/test-common.sh
git commit -m "feat(memory): two-root resolution helper (PLUGIN_ROOT + PROJECT_ROOT)"
```

### Task 2.2: Port `scripts/memory/score.sh`

- [ ] **Step 1: Read source script**

Run: `cat /Users/MH/Documents/git_saas/ai-coding-template/scripts/memory/score.sh`
Read the implementation to understand subcommands: get, reinforce, decay, decay-all, flag-weak, init.

- [ ] **Step 2: Copy + adapt**

Copy source to plugin, then edit top to source common.sh:

```bash
cp /Users/MH/Documents/git_saas/ai-coding-template/scripts/memory/score.sh /Users/MH/Documents/git_saas/athena-core/scripts/memory/score.sh
```

Then edit the top of the new file. Replace any hardcoded paths to `~/.claude/template-memory/` with `${ATHENA_MEMORY_DIR}` from common.sh:

Add at top (after shebang):
```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$PLUGIN_ROOT/scripts/lib/common.sh"
```

Then `grep -n 'template-memory' /Users/MH/Documents/git_saas/athena-core/scripts/memory/score.sh` — replace each match with `${ATHENA_MEMORY_DIR}`.

- [ ] **Step 3: Write `score.sh init` test**

Create test slice in `/Users/MH/Documents/git_saas/athena-core/tests/test-memory-loop.sh`:

```bash
#!/bin/bash
set -euo pipefail
export CLAUDE_PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Isolate test memory
export HOME=$(mktemp -d)
trap 'rm -rf "$HOME"' EXIT

source "$CLAUDE_PLUGIN_ROOT/scripts/lib/common.sh"
mkdir -p "$ATHENA_MEMORY_DIR"
echo "Test lesson" > "$ATHENA_MEMORY_DIR/test-lesson.md"

bash "$CLAUDE_PLUGIN_ROOT/scripts/memory/score.sh" init
[[ -f "$ATHENA_META_DIR/strengths.json" ]] || { echo "FAIL: strengths.json not created"; exit 1; }
echo "PASS: score.sh init creates strengths.json"
```

- [ ] **Step 4: Run, expect pass**

```bash
chmod +x /Users/MH/Documents/git_saas/athena-core/scripts/memory/score.sh
chmod +x /Users/MH/Documents/git_saas/athena-core/tests/test-memory-loop.sh
/Users/MH/Documents/git_saas/athena-core/tests/test-memory-loop.sh
```

- [ ] **Step 5: Commit**

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add scripts/memory/score.sh tests/test-memory-loop.sh
git commit -m "feat(memory): port score.sh with ATHENA_MEMORY_DIR path"
```

### Task 2.3: Port `scripts/memory/match.sh`

- [ ] **Step 1: Copy + adapt**

```bash
cp /Users/MH/Documents/git_saas/ai-coding-template/scripts/memory/match.sh /Users/MH/Documents/git_saas/athena-core/scripts/memory/match.sh
```

Edit top: add common.sh source block (same pattern as score.sh).
Edit: replace `~/.claude/template-memory/` with `${ATHENA_MEMORY_DIR}`.
Edit: replace any reference to `docs/context/` with `${PROJECT_CONTEXT_DIR}`.

- [ ] **Step 2: Extend `test-memory-loop.sh`**

Append to `/Users/MH/Documents/git_saas/athena-core/tests/test-memory-loop.sh`:

```bash
# match.sh: returns top-N relevant files for given keywords
echo "tdd" > "$ATHENA_MEMORY_DIR/test-lesson.md"
result=$(bash "$CLAUDE_PLUGIN_ROOT/scripts/memory/match.sh" "test")
[[ -n "$result" ]] || { echo "FAIL: match.sh returned empty"; exit 1; }
echo "PASS: match.sh returns relevant files"
```

- [ ] **Step 3: Run + commit**

```bash
chmod +x /Users/MH/Documents/git_saas/athena-core/scripts/memory/match.sh
/Users/MH/Documents/git_saas/athena-core/tests/test-memory-loop.sh
cd /Users/MH/Documents/git_saas/athena-core
git add scripts/memory/match.sh tests/test-memory-loop.sh
git commit -m "feat(memory): port match.sh for selective Tier 0 injection"
```

### Task 2.4: Port `scripts/memory/inject.sh`

- [ ] **Step 1: Copy + adapt**

```bash
cp /Users/MH/Documents/git_saas/ai-coding-template/scripts/memory/inject.sh /Users/MH/Documents/git_saas/athena-core/scripts/memory/inject.sh
```

Same edits as Task 2.2/2.3: source common.sh, replace paths.

- [ ] **Step 2: Add inject test slice**

Append to `test-memory-loop.sh`:

```bash
# inject.sh: outputs injection block for SessionStart
output=$(bash "$CLAUDE_PLUGIN_ROOT/scripts/memory/inject.sh" 2>&1 || true)
[[ -n "$output" ]] || { echo "FAIL: inject.sh produced no output"; exit 1; }
echo "PASS: inject.sh produces injection block"
```

- [ ] **Step 3: Run + commit**

```bash
chmod +x /Users/MH/Documents/git_saas/athena-core/scripts/memory/inject.sh
/Users/MH/Documents/git_saas/athena-core/tests/test-memory-loop.sh
cd /Users/MH/Documents/git_saas/athena-core
git add scripts/memory/inject.sh tests/test-memory-loop.sh
git commit -m "feat(memory): port inject.sh for SessionStart Tier 0 injection"
```

### Task 2.5: Port `half-life-resolve.sh` + `half-life-defaults.json`

- [ ] **Step 1: Copy both files**

```bash
cp /Users/MH/Documents/git_saas/ai-coding-template/scripts/memory/half-life-resolve.sh /Users/MH/Documents/git_saas/athena-core/scripts/memory/half-life-resolve.sh
cp /Users/MH/Documents/git_saas/ai-coding-template/scripts/memory/half-life-defaults.json /Users/MH/Documents/git_saas/athena-core/scripts/memory/half-life-defaults.json
```

Adapt: source common.sh in the .sh, edit any path refs.

- [ ] **Step 2: Add resolve test**

Append to `test-memory-loop.sh`:

```bash
# half-life-resolve.sh: returns int for a given lesson file
echo "test" > "$ATHENA_MEMORY_DIR/anti-patterns.md"
days=$(bash "$CLAUDE_PLUGIN_ROOT/scripts/memory/half-life-resolve.sh" "anti-patterns.md")
[[ "$days" =~ ^[0-9]+$ ]] || { echo "FAIL: half-life not numeric: $days"; exit 1; }
echo "PASS: half-life-resolve.sh returns numeric days"
```

- [ ] **Step 3: Run + commit**

```bash
chmod +x /Users/MH/Documents/git_saas/athena-core/scripts/memory/half-life-resolve.sh
/Users/MH/Documents/git_saas/athena-core/tests/test-memory-loop.sh
cd /Users/MH/Documents/git_saas/athena-core
git add scripts/memory/half-life-resolve.sh scripts/memory/half-life-defaults.json
git commit -m "feat(memory): port half-life-resolve.sh + defaults rubric"
```

### Task 2.6: Implement cold-start session-count tracking

- [ ] **Step 1: Write failing test**

Append to `test-memory-loop.sh`:

```bash
# Cold-start: session-count starts at 0
bash "$CLAUDE_PLUGIN_ROOT/scripts/memory/score.sh" session-tick
count=$(cat "$ATHENA_META_DIR/session-count" 2>/dev/null || echo 0)
[[ "$count" == "1" ]] || { echo "FAIL: session-count not 1, got $count"; exit 1; }
echo "PASS: session-tick increments session-count"
```

- [ ] **Step 2: Run — expect fail (subcommand doesn't exist)**

- [ ] **Step 3: Add `session-tick` subcommand to `score.sh`**

Add to the case statement in `score.sh`:

```bash
session-tick)
  mkdir -p "$ATHENA_META_DIR"
  current=$(cat "$ATHENA_META_DIR/session-count" 2>/dev/null || echo 0)
  echo $((current + 1)) > "$ATHENA_META_DIR/session-count"
  ;;
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add scripts/memory/score.sh tests/test-memory-loop.sh
git commit -m "feat(memory): add session-tick subcommand for cold-start tracking"
```

### Task 2.7: Implement breadth-mode vs. selective-mode switch in `match.sh`

- [ ] **Step 1: Write failing test**

Append to `test-memory-loop.sh`:

```bash
# Reset session-count + retrieval events for cold-start test
echo 0 > "$ATHENA_META_DIR/session-count"

# Breadth mode: returns ALL files when session-count < 3
result=$(bash "$CLAUDE_PLUGIN_ROOT/scripts/memory/match.sh" --mode-auto "anything")
lines=$(echo "$result" | wc -l)
[[ "$lines" -ge "1" ]] || { echo "FAIL: breadth mode returned no files"; exit 1; }
echo "PASS: --mode-auto returns files in breadth mode"
```

- [ ] **Step 2: Edit `match.sh`** — add mode-auto logic:

```bash
if [[ "${1:-}" == "--mode-auto" ]]; then
  shift
  session_count=$(cat "$ATHENA_META_DIR/session-count" 2>/dev/null || echo 0)
  retrieval_total=$(jq '[.[] | .retrieval_count] | add // 0' "$ATHENA_META_DIR/strengths.json" 2>/dev/null || echo 0)
  if [[ "$session_count" -lt 3 || "$retrieval_total" -lt 10 ]]; then
    # Breadth mode: list all .md files in memory dir
    find "$ATHENA_MEMORY_DIR" -maxdepth 1 -name "*.md" -type f
    exit 0
  fi
  # else fall through to selective mode (original logic)
fi
```

- [ ] **Step 3: Run + commit**

```bash
/Users/MH/Documents/git_saas/athena-core/tests/test-memory-loop.sh
cd /Users/MH/Documents/git_saas/athena-core
git add scripts/memory/match.sh tests/test-memory-loop.sh
git commit -m "feat(memory): add breadth-mode for first-3-sessions cold-start"
```

### Task 2.8: Write `test-match-inject.sh` and link to run-all

- [ ] **Step 1: Create dedicated match-inject test**

Create `/Users/MH/Documents/git_saas/athena-core/tests/test-match-inject.sh`:

```bash
#!/bin/bash
set -euo pipefail
export CLAUDE_PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export HOME=$(mktemp -d)
trap 'rm -rf "$HOME"' EXIT
source "$CLAUDE_PLUGIN_ROOT/scripts/lib/common.sh"
mkdir -p "$ATHENA_MEMORY_DIR"

# Seed two files with different keywords
echo "# TDD tips" > "$ATHENA_MEMORY_DIR/tdd-lessons.md"
echo "# Debug tips" > "$ATHENA_MEMORY_DIR/debug-lessons.md"
bash "$CLAUDE_PLUGIN_ROOT/scripts/memory/score.sh" init
echo 5 > "$ATHENA_META_DIR/session-count"  # past cold-start

# match for "tdd" should rank tdd-lessons.md higher than debug-lessons.md
top=$(bash "$CLAUDE_PLUGIN_ROOT/scripts/memory/match.sh" "tdd" | head -1)
[[ "$top" == *"tdd-lessons.md" ]] || { echo "FAIL: tdd-lessons not top match (got $top)"; exit 1; }
echo "PASS: match.sh ranks by keyword relevance"
```

- [ ] **Step 2: Run + commit**

```bash
chmod +x /Users/MH/Documents/git_saas/athena-core/tests/test-match-inject.sh
/Users/MH/Documents/git_saas/athena-core/tests/test-match-inject.sh
cd /Users/MH/Documents/git_saas/athena-core
git add tests/test-match-inject.sh
git commit -m "test(memory): add dedicated match-inject relevance test"
```

**M2 verification:** All 4 memory tests green. Memory subsystem works in isolation on python-mini fixture.

---

## Milestone 3: Hooks subsystem (8 tasks)

**Files (all under `/Users/MH/Documents/git_saas/athena-core/`):**
- Create: `hooks/hooks.json`
- Create: `scripts/hooks/session-start.sh`
- Create: `scripts/hooks/stop-verifier.sh`
- Create: `scripts/hooks/audit-emit-verification.sh`
- Create: `scripts/hooks/user-prompt-submit.sh`
- Create: `scripts/hooks/pre-bash-guard.sh`
- Create: `scripts/hooks/subagent-stop-writeback.sh`
- Create: `scripts/stop-rules/*.sh` (10 files, see Task 3.6)
- Create: `tests/test-hooks.sh`

**Source location:** `/Users/MH/Documents/git_saas/ai-coding-template/scripts/hooks/`

### Task 3.1: Write `hooks/hooks.json`

- [ ] **Step 1: Create hooks.json**

Create `/Users/MH/Documents/git_saas/athena-core/hooks/hooks.json`:

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/session-start.sh",
        "timeout": 10
      }]
    }],
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/user-prompt-submit.sh",
        "timeout": 5
      }]
    }],
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/pre-bash-guard.sh"
      }]
    }],
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/stop-verifier.sh",
        "timeout": 15
      }]
    }],
    "SubagentStop": [{
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/subagent-stop-writeback.sh"
      }]
    }]
  }
}
```

- [ ] **Step 2: Validate JSON**

Run: `jq . /Users/MH/Documents/git_saas/athena-core/hooks/hooks.json`

- [ ] **Step 3: Commit**

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add hooks/hooks.json
git commit -m "feat(hooks): register SessionStart/PreToolUse/Stop/SubagentStop hooks"
```

### Task 3.2: Port `session-start.sh`

- [ ] **Step 1: Copy + universalize**

```bash
cp /Users/MH/Documents/git_saas/ai-coding-template/scripts/hooks/session-start.sh /Users/MH/Documents/git_saas/athena-core/scripts/hooks/session-start.sh
```

Edit:
- Add at top: `source "${CLAUDE_PLUGIN_ROOT}/scripts/lib/common.sh"`
- Remove `cd "$(git rev-parse...)"` lines (common.sh handles roots)
- Replace `~/.claude/template-memory/` → `$ATHENA_MEMORY_DIR`
- Replace `docs/context/` → `$PROJECT_CONTEXT_DIR`
- Replace `.claude/audit.jsonl` → `$PROJECT_AUDIT_LOG`
- Remove any reference to `scripts/hooks/inject.sh` (it's at `${PLUGIN_ROOT}/scripts/memory/inject.sh` now)
- Replace any reference to `~/.claude/template-memory/match.sh` → `${PLUGIN_ROOT}/scripts/memory/match.sh`
- Add `bash "${PLUGIN_ROOT}/scripts/memory/score.sh" session-tick` near end

- [ ] **Step 2: Write hook test**

Create `/Users/MH/Documents/git_saas/athena-core/tests/test-hooks.sh`:

```bash
#!/bin/bash
set -euo pipefail
export CLAUDE_PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export HOME=$(mktemp -d)
trap 'rm -rf "$HOME"' EXIT
source "$CLAUDE_PLUGIN_ROOT/scripts/lib/common.sh"
mkdir -p "$ATHENA_MEMORY_DIR"
echo "test" > "$ATHENA_MEMORY_DIR/test.md"
bash "$CLAUDE_PLUGIN_ROOT/scripts/memory/score.sh" init

cd /tmp
mkdir -p test-project && cd test-project
git init -q
git -c user.email=t@t -c user.name=t commit --allow-empty -m init -q

# Run session-start hook
output=$(bash "$CLAUDE_PLUGIN_ROOT/scripts/hooks/session-start.sh" 2>&1 || true)
[[ -n "$output" ]] || { echo "FAIL: session-start produced no output"; exit 1; }

# session-count should have been incremented
count=$(cat "$ATHENA_META_DIR/session-count")
[[ "$count" == "1" ]] || { echo "FAIL: session-count not ticked (got $count)"; exit 1; }
echo "PASS: session-start.sh ticks session-count + emits output"
```

- [ ] **Step 3: Run + commit**

```bash
chmod +x /Users/MH/Documents/git_saas/athena-core/scripts/hooks/session-start.sh
chmod +x /Users/MH/Documents/git_saas/athena-core/tests/test-hooks.sh
/Users/MH/Documents/git_saas/athena-core/tests/test-hooks.sh
cd /Users/MH/Documents/git_saas/athena-core
git add scripts/hooks/session-start.sh tests/test-hooks.sh
git commit -m "feat(hooks): port session-start.sh with two-root resolution"
```

### Task 3.3: Port `user-prompt-submit.sh`

- [ ] **Step 1: Copy + universalize**

```bash
cp /Users/MH/Documents/git_saas/ai-coding-template/scripts/hooks/user-prompt-submit.sh /Users/MH/Documents/git_saas/athena-core/scripts/hooks/user-prompt-submit.sh
chmod +x /Users/MH/Documents/git_saas/athena-core/scripts/hooks/user-prompt-submit.sh
```

Apply universalize edits (source common.sh, replace paths).

- [ ] **Step 2: Append test to `test-hooks.sh`**

```bash
output=$(echo '{"prompt":"test"}' | bash "$CLAUDE_PLUGIN_ROOT/scripts/hooks/user-prompt-submit.sh" 2>&1 || true)
echo "PASS: user-prompt-submit.sh executes without crash"
```

- [ ] **Step 3: Run + commit**

```bash
/Users/MH/Documents/git_saas/athena-core/tests/test-hooks.sh
cd /Users/MH/Documents/git_saas/athena-core
git add scripts/hooks/user-prompt-submit.sh tests/test-hooks.sh
git commit -m "feat(hooks): port user-prompt-submit.sh"
```

### Task 3.4: Port `pre-bash-guard.sh`

- [ ] **Step 1: Copy + universalize**

```bash
cp /Users/MH/Documents/git_saas/ai-coding-template/scripts/hooks/pre-bash-guard.sh /Users/MH/Documents/git_saas/athena-core/scripts/hooks/pre-bash-guard.sh
chmod +x /Users/MH/Documents/git_saas/athena-core/scripts/hooks/pre-bash-guard.sh
```

Universalize. Remove rules specific to this template (e.g., if it blocks `cd server/`); keep universal guards (e.g., block `rm -rf /`, block force-push to main).

- [ ] **Step 2: Append test**

```bash
echo '{"command":"echo hello"}' | bash "$CLAUDE_PLUGIN_ROOT/scripts/hooks/pre-bash-guard.sh"
echo "PASS: pre-bash-guard allows safe command"

result=$(echo '{"command":"rm -rf /"}' | bash "$CLAUDE_PLUGIN_ROOT/scripts/hooks/pre-bash-guard.sh" 2>&1 || true)
[[ "$result" == *"block"* || $? -ne 0 ]] || { echo "FAIL: rm -rf / not blocked"; exit 1; }
echo "PASS: pre-bash-guard blocks dangerous command"
```

- [ ] **Step 3: Run + commit**

```bash
/Users/MH/Documents/git_saas/athena-core/tests/test-hooks.sh
cd /Users/MH/Documents/git_saas/athena-core
git add scripts/hooks/pre-bash-guard.sh tests/test-hooks.sh
git commit -m "feat(hooks): port pre-bash-guard.sh (universal guards only)"
```

### Task 3.5: Port `subagent-stop-writeback.sh` + `audit-emit-verification.sh`

- [ ] **Step 1: Copy both**

```bash
cp /Users/MH/Documents/git_saas/ai-coding-template/scripts/hooks/subagent-stop-writeback.sh /Users/MH/Documents/git_saas/athena-core/scripts/hooks/subagent-stop-writeback.sh
cp /Users/MH/Documents/git_saas/ai-coding-template/scripts/hooks/audit-emit-verification.sh /Users/MH/Documents/git_saas/athena-core/scripts/hooks/audit-emit-verification.sh
chmod +x /Users/MH/Documents/git_saas/athena-core/scripts/hooks/{subagent-stop-writeback,audit-emit-verification}.sh
```

Universalize each (source common.sh, replace paths).

- [ ] **Step 2: Append test**

```bash
echo '{"agent":"test","timestamp":"2026-05-19"}' | bash "$CLAUDE_PLUGIN_ROOT/scripts/hooks/subagent-stop-writeback.sh"
echo "PASS: subagent-stop-writeback executes"

bash "$CLAUDE_PLUGIN_ROOT/scripts/hooks/audit-emit-verification.sh" 0 "test verification"
[[ -f "$PROJECT_AUDIT_LOG" ]] || { echo "FAIL: audit log not created"; exit 1; }
grep -q "verification_check" "$PROJECT_AUDIT_LOG" || { echo "FAIL: no verification_check event"; exit 1; }
echo "PASS: audit-emit-verification writes JSONL event"
```

- [ ] **Step 3: Run + commit**

```bash
/Users/MH/Documents/git_saas/athena-core/tests/test-hooks.sh
cd /Users/MH/Documents/git_saas/athena-core
git add scripts/hooks/subagent-stop-writeback.sh scripts/hooks/audit-emit-verification.sh tests/test-hooks.sh
git commit -m "feat(hooks): port subagent-stop + audit-emit-verification"
```

### Task 3.6: Extract 10 universal stop-rules to discrete scripts

**Source:** `/Users/MH/Documents/git_saas/ai-coding-template/scripts/hooks/stop-verifier.sh` (one monolithic script with all 23 rules).

The 10 universal rules to extract:
1. console-log-residue.sh
2. large-file-warning.sh
3. test-file-size.sh
4. internal-mock-assertions.sh
5. parametrize-nudge.sh
6. mock-depth-limit.sh
7. verification-discipline.sh
8. qa-gate-enforcement.sh
9. migration-review.sh
10. reviewer-convergence.sh

- [ ] **Step 1: Read source stop-verifier.sh**

Run: `cat /Users/MH/Documents/git_saas/ai-coding-template/scripts/hooks/stop-verifier.sh`
Identify each rule's check logic (function or inline block).

- [ ] **Step 2: For each universal rule, create discrete script**

For rule #1 (console-log-residue), create `/Users/MH/Documents/git_saas/athena-core/scripts/stop-rules/console-log-residue.sh`:

```bash
#!/bin/bash
# Stop-rule: block completion if console.log/print() residue exists in changed files.
# Exit 0 = pass, exit non-zero = block.

set -euo pipefail
source "${CLAUDE_PLUGIN_ROOT}/scripts/lib/common.sh"

cd "$PROJECT_ROOT"
# Check staged + recently modified files
files=$(git diff --name-only HEAD~1..HEAD 2>/dev/null || echo "")
[[ -z "$files" ]] && exit 0

residue=$(echo "$files" | xargs -I{} grep -l "console\.log\|print(.*debug" {} 2>/dev/null || true)
if [[ -n "$residue" ]]; then
  echo "BLOCKED: console.log/debug print residue found in: $residue" >&2
  exit 1
fi
exit 0
```

Apply the same pattern for rules 2-10. Each script:
- Sources common.sh
- Implements ONE rule check
- Exit 0 = pass, exit non-zero with stderr message = block

Use the source `stop-verifier.sh` as reference for the exact check logic per rule. Universalize anything that references FastAPI/React/openapi specifically — drop or generalize.

- [ ] **Step 3: Make all executable**

```bash
chmod +x /Users/MH/Documents/git_saas/athena-core/scripts/stop-rules/*.sh
```

- [ ] **Step 4: Smoke test each rule**

Append to `test-hooks.sh`:

```bash
for rule in console-log-residue large-file-warning test-file-size \
            internal-mock-assertions parametrize-nudge mock-depth-limit \
            verification-discipline qa-gate-enforcement migration-review \
            reviewer-convergence; do
  bash "$CLAUDE_PLUGIN_ROOT/scripts/stop-rules/${rule}.sh" || true  # may exit non-zero, just verify executable
  echo "PASS: ${rule}.sh executable"
done
```

- [ ] **Step 5: Commit each rule as a separate commit** (10 commits total — easier to review/revert)

Example:

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add scripts/stop-rules/console-log-residue.sh
git commit -m "feat(stop-rules): add console-log-residue rule"
# repeat for each of the 10 rules
```

### Task 3.7: Write meta `stop-verifier.sh` that runs all stop-rules

- [ ] **Step 1: Create meta verifier**

Create `/Users/MH/Documents/git_saas/athena-core/scripts/hooks/stop-verifier.sh`:

```bash
#!/bin/bash
# Stop hook: runs all stop-rules; any rule failure blocks completion.
set -uo pipefail
source "${CLAUDE_PLUGIN_ROOT}/scripts/lib/common.sh"

# Discover rules from core + any profile plugins via extension registry
RULES_DIR="${PLUGIN_ROOT}/scripts/stop-rules"
failed=0
failures=()

for rule in "$RULES_DIR"/*.sh; do
  [[ -f "$rule" ]] || continue
  if ! bash "$rule" 2>>/tmp/athena-stop-verifier.err; then
    failed=$((failed + 1))
    failures+=("$(basename "$rule")")
  fi
done

if [[ $failed -gt 0 ]]; then
  echo "STOP-VERIFIER: $failed rule(s) blocked completion:" >&2
  printf '  - %s\n' "${failures[@]}" >&2
  cat /tmp/athena-stop-verifier.err >&2
  rm -f /tmp/athena-stop-verifier.err
  exit 1
fi
exit 0
```

- [ ] **Step 2: Make executable + test**

```bash
chmod +x /Users/MH/Documents/git_saas/athena-core/scripts/hooks/stop-verifier.sh
```

Append to test-hooks.sh:

```bash
bash "$CLAUDE_PLUGIN_ROOT/scripts/hooks/stop-verifier.sh" || true
echo "PASS: stop-verifier.sh runs all rules"
```

- [ ] **Step 3: Run + commit**

```bash
/Users/MH/Documents/git_saas/athena-core/tests/test-hooks.sh
cd /Users/MH/Documents/git_saas/athena-core
git add scripts/hooks/stop-verifier.sh tests/test-hooks.sh
git commit -m "feat(hooks): add meta stop-verifier that runs all rule scripts"
```

### Task 3.8: Integration test — full hook chain on python-mini fixture

- [ ] **Step 1: Add fixture-based integration test**

Append to `test-hooks.sh`:

```bash
# Integration: run hooks against python-mini fixture
cd "$CLAUDE_PLUGIN_ROOT/tests/fixtures/python-mini"
export PROJECT_ROOT=$(pwd)
bash "$CLAUDE_PLUGIN_ROOT/scripts/hooks/session-start.sh" >/dev/null
bash "$CLAUDE_PLUGIN_ROOT/scripts/hooks/stop-verifier.sh" >/dev/null
echo "PASS: full hook chain executes on python-mini fixture"
```

- [ ] **Step 2: Run + commit**

```bash
/Users/MH/Documents/git_saas/athena-core/tests/test-hooks.sh
cd /Users/MH/Documents/git_saas/athena-core
git add tests/test-hooks.sh
git commit -m "test(hooks): full hook chain integration test on python-mini"
```

**M3 verification:** `test-hooks.sh` green. All 6 hooks + 10 stop-rules fire cleanly on a real fixture.

---

## Milestone 4: Skills (6 tasks)

**Files:**
- Create: `skills/using-athena.md` (NEW)
- Create: `skills/tdd-workflow.md` (port)
- Create: `skills/verification-discipline.md` (port)
- Create: `skills/systematic-debugging.md` (port from `debugging.md`)
- Create: `skills/launch-checklist.md` (port)
- Create: `skills/reviewer-convergence.md` (NEW, distilled from `scripts/reviewer-loop.sh`)

**Source for ports:** `/Users/MH/Documents/git_saas/ai-coding-template/.claude/skills/`

### Task 4.1: Write NEW `skills/using-athena.md` gateway skill

- [ ] **Step 1: Create the gateway skill**

Create `/Users/MH/Documents/git_saas/athena-core/skills/using-athena.md`:

```markdown
---
name: using-athena
description: Use this skill at the start of any conversation when athena-core plugin is installed. Establishes the Athena meta-workflow: when to invoke /athena:plan vs. /athena:loop vs. /athena:ship, which agent to delegate to for which task, when to trigger tdd-workflow / verification-discipline / systematic-debugging skills. Read this first before responding to any user task.
---

# Using Athena

You are working with the `athena-core` plugin installed. Athena is a meta-workflow for managing software development through epic-driven cycles, with persistent memory and quality gates.

## When to use which command

| User intent | Command |
|---|---|
| "Plan a feature" / "what should we build next" | `/athena:plan` |
| "Build the next epic" / "advance the project" | `/athena:loop` or `/athena:autopilot` |
| "Ship this change" / "create a PR" | `/athena:ship` or `/athena:pr` |
| "Run quality checks" | `/athena:qa` |
| "Save state for resume" | `/athena:save` |
| "What's the current state?" | `/athena:load` or `/athena:dashboard` |
| "Extract a lesson learned" | `/athena:promote` |

## When to invoke which skill (auto-trigger)

- User asks to implement / add a feature → invoke `tdd-workflow`
- User claims work is done / about to commit → invoke `verification-discipline`
- User reports a bug / test failure → invoke `systematic-debugging`
- User reviewing code in a loop → invoke `reviewer-convergence`
- User about to launch / deploy → invoke `launch-checklist`

## Which agent to delegate to

| Task type | Agent |
|---|---|
| Multi-step orchestration | `@orchestrator` |
| Strategic planning | `@strategist` |
| Code review | `@reviewer` |
| Test execution | `@qa` |
| Acceptance evaluation | `@evaluator` |
| Bug investigation | `@debugger` |
| Architecture decisions | `@best-practice` |
| Memory curation | `@memory-curator` |
| Feature design | `@spec-writer` |
| Deploy gate | `@deployer` |
| UI/page generation | `@designer` |

## Memory model

- Tier 0 (global): `~/.claude/athena-memory/` — cross-project wisdom
- Tier 1 (project): `<project>/docs/context/` — this project's state
- Audit log: `<project>/.claude/audit.jsonl`

Read `<project>/docs/context/session-summary.md` to resume context.
```

- [ ] **Step 2: Commit**

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add skills/using-athena.md
git commit -m "feat(skills): add using-athena gateway skill"
```

### Task 4.2: Port `tdd-workflow.md` (sanitize)

- [ ] **Step 1: Copy**

```bash
cp /Users/MH/Documents/git_saas/ai-coding-template/.claude/skills/tdd-workflow.md /Users/MH/Documents/git_saas/athena-core/skills/tdd-workflow.md
```

- [ ] **Step 2: Sanitize**

Read the file. Remove or genericize:
- References to `pytest`, `vitest`, `pyproject.toml`, `package.json` → "your test runner"
- References to `server/`, `client/` → "your code dir"
- References to `coverage gate >= 80%` → keep (universal principle)
- References to `asyncio_mode = auto` → drop (FastAPI-specific)

Preserve: RED → GREEN → REFACTOR loop, 80% coverage gate, behavior > implementation testing.

- [ ] **Step 3: Verify**

Run: `grep -E 'fastapi|pytest|pnpm|vitest|asyncio|server/|client/' /Users/MH/Documents/git_saas/athena-core/skills/tdd-workflow.md`
Expected: no matches (or only matches in genericized form like "your test runner (pytest, vitest, jest, ...)").

- [ ] **Step 4: Commit**

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add skills/tdd-workflow.md
git commit -m "feat(skills): port tdd-workflow.md (sanitized for any stack)"
```

### Task 4.3: Port `verification-discipline.md`

- [ ] **Step 1: Copy + sanitize**

```bash
cp /Users/MH/Documents/git_saas/ai-coding-template/.claude/skills/verification-discipline.md /Users/MH/Documents/git_saas/athena-core/skills/verification-discipline.md
```

Sanitize. The current skill is already mostly universal (evidence-before-claim principle). Remove any reference to `audit-emit-verification.sh`'s exact path — replace with `${CLAUDE_PLUGIN_ROOT}/scripts/hooks/audit-emit-verification.sh`.

- [ ] **Step 2: Verify + commit**

```bash
grep -E 'server/|client/|fastapi|openapi\.yaml' /Users/MH/Documents/git_saas/athena-core/skills/verification-discipline.md
# expected: no matches
cd /Users/MH/Documents/git_saas/athena-core
git add skills/verification-discipline.md
git commit -m "feat(skills): port verification-discipline.md"
```

### Task 4.4: Port + rename `debugging.md` → `systematic-debugging.md`

- [ ] **Step 1: Copy with rename**

```bash
cp /Users/MH/Documents/git_saas/ai-coding-template/.claude/skills/debugging.md /Users/MH/Documents/git_saas/athena-core/skills/systematic-debugging.md
```

- [ ] **Step 2: Update frontmatter**

Edit the file. Update `name:` field in YAML frontmatter to `systematic-debugging`. Update `description:` to clearly trigger on debug tasks.

- [ ] **Step 3: Sanitize**

Same approach: remove FastAPI/React/openapi/Zeabur refs. Keep universal debugging methodology (reproduce → bisect → hypothesize → verify → fix).

- [ ] **Step 4: Verify + commit**

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add skills/systematic-debugging.md
git commit -m "feat(skills): port debugging.md as systematic-debugging.md"
```

### Task 4.5: Port `launch-checklist.md`

- [ ] **Step 1: Copy + sanitize**

```bash
cp /Users/MH/Documents/git_saas/ai-coding-template/.claude/skills/launch-checklist.md /Users/MH/Documents/git_saas/athena-core/skills/launch-checklist.md
```

Sanitize: remove Zeabur-specific items, keep universal pre-launch checklist (smoke tests, rollback plan, monitoring, observability).

- [ ] **Step 2: Verify + commit**

```bash
grep -E 'zeabur|fastapi|sentry-specific-config' /Users/MH/Documents/git_saas/athena-core/skills/launch-checklist.md
# expected: no matches
cd /Users/MH/Documents/git_saas/athena-core
git add skills/launch-checklist.md
git commit -m "feat(skills): port launch-checklist.md (universal checklist)"
```

### Task 4.6: Write NEW `reviewer-convergence.md`

- [ ] **Step 1: Read source**

Run: `cat /Users/MH/Documents/git_saas/ai-coding-template/scripts/reviewer-loop.sh`
Understand the 4-round-max state machine: round, verdict (CONVERGED/STUCK/MAX_REACHED), audit emit.

- [ ] **Step 2: Distill into skill**

Create `/Users/MH/Documents/git_saas/athena-core/skills/reviewer-convergence.md`:

```markdown
---
name: reviewer-convergence
description: Use this skill when conducting an iterative code review with multiple rounds. Implements a 4-round convergence state machine: track round count, verdict (CONVERGED / STUCK / MAX_REACHED), emit audit events. Prevents reviewer/implementer loops from spiraling indefinitely.
---

# Reviewer Convergence

## State machine

Track these across review rounds:
- `round` (int, starts at 1, max 4)
- `verdict` (one of: PENDING, CONVERGED, STUCK, MAX_REACHED)
- `prior_findings` (set of issues from previous rounds)

## Round flow

1. **Round 1:** Initial review. Set verdict = PENDING.
2. **Round 2-4:** Re-review. Compare new findings to prior:
   - If no new findings AND prior addressed → `verdict = CONVERGED` (done)
   - If new findings are subset of prior → `verdict = STUCK` (escalate to human)
   - If new findings emerge AND round < 4 → continue
   - If round == 4 AND not converged → `verdict = MAX_REACHED` (escalate)

## Termination

Emit audit event on every verdict change:
\`\`\`json
{"event": "review_loop", "round": <int>, "verdict": "<CONVERGED|STUCK|MAX_REACHED>"}
\`\`\`

Stop the loop on verdict = CONVERGED, STUCK, or MAX_REACHED.

## Why 4 rounds

Empirically: review loops that don't converge in 4 rounds are either:
- Stuck on a design disagreement (escalate to human)
- Compounding new issues each round (likely the patch is wrong-shape)

Letting it run 10+ rounds wastes tokens and rarely converges.
```

- [ ] **Step 3: Commit**

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add skills/reviewer-convergence.md
git commit -m "feat(skills): NEW reviewer-convergence skill (4-round state machine)"
```

**M4 verification:** 6 skills exist in `skills/`, each with frontmatter `description:` field that auto-triggers correctly.

---

## Milestone 5: Agents (11 tasks)

**Pattern (applies to every agent):** copy from source → sanitize stack-specific refs → adjust delegation targets to universal commands → commit.

**Source:** `/Users/MH/Documents/git_saas/ai-coding-template/.claude/agents/`

### Task 5.1: Port `orchestrator.md` (detailed example for the pattern)

- [ ] **Step 1: Copy**

```bash
cp /Users/MH/Documents/git_saas/ai-coding-template/.claude/agents/orchestrator.md /Users/MH/Documents/git_saas/athena-core/agents/orchestrator.md
```

- [ ] **Step 2: Sanitize — read the file, edit out:**
- References to `openapi.yaml` → "your spec source"
- References to `docs/epics/EPIC_INDEX.md` → "your epic index (project-defined location)"
- References to `server/`, `client/` → drop or replace with "your code directories"
- References to deferred commands (`/athena:deploy`, `/athena:dba`, `/athena:domain`, `/athena:audit`, `/athena:design`, `/athena:qa-report`) → drop or note "(profile pack)"
- References to deferred agents (`@dba`) → drop

Preserve: orchestration pattern, wave dispatch, dependency graph reading, status tracking.

- [ ] **Step 3: Verify**

```bash
grep -E 'openapi\.yaml|fastapi|@dba|/athena:(deploy|dba|domain|audit|design|qa-report)' /Users/MH/Documents/git_saas/athena-core/agents/orchestrator.md
```
Expected: no matches (or only inside "(profile pack)" annotations).

- [ ] **Step 4: Commit**

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add agents/orchestrator.md
git commit -m "feat(agents): port orchestrator.md (universalized)"
```

### Tasks 5.2 – 5.11: Port remaining 10 agents

For each agent below, repeat the Task 5.1 pattern (copy, sanitize, verify, commit). One commit per agent.

- [ ] **Task 5.2: `strategist.md`** — also remove references to `/athena:plan brainstorm` step formats that assume openapi-first design (replace with format-agnostic spec output).
- [ ] **Task 5.3: `reviewer.md`** — remove React/FastAPI checklists; keep universal review heuristics (security, correctness, test coverage, readability).
- [ ] **Task 5.4: `qa.md`** — keep universal test quality scoring (behavior ratio, mock depth, parametrize rate); drop fixture paths specific to this template.
- [ ] **Task 5.5: `evaluator.md`** — keep acceptance evaluation framework; drop any reference to `docs/epics/` exact path.
- [ ] **Task 5.6: `debugger.md`** — keep diagnostic methodology; drop language-specific examples or rewrite as multi-language ("Python: `pytest -xvs`; JS: `vitest run`; Go: `go test -v`...").
- [ ] **Task 5.7: `best-practice.md`** — keep architecture decision framework; drop FastAPI/React-specific patterns.
- [ ] **Task 5.8: `memory-curator.md`** — keep promotion/decay logic; replace path `~/.claude/template-memory/` with `${ATHENA_MEMORY_DIR}` (referenced via common.sh in any scripts the agent invokes).
- [ ] **Task 5.9: `spec-writer.md`** — drop "OpenAPI-first" hard requirement; read `spec.format` from `plugin.json` (openapi | proto | typespec | freeform); default = freeform markdown to `docs/specs/`.
- [ ] **Task 5.10: `deployer.md`** — keep 7-gate framework structure; drop Zeabur-specific gate implementations (note them as "profile pack provides concrete gates"). Make the gate registry pluggable.
- [ ] **Task 5.11: `designer.md`** — keep design-token → component pattern; drop refs to `client/src/components/ui/` (replace with "your UI primitive directory, configurable via athena.config.json").

Each task commits with: `git commit -m "feat(agents): port <agent>.md (universalized)"`

**M5 verification:**

```bash
ls /Users/MH/Documents/git_saas/athena-core/agents/ | wc -l   # should be 11
grep -rE 'fastapi|openapi\.yaml|server/|client/|@dba|zeabur' /Users/MH/Documents/git_saas/athena-core/agents/
# expected: no matches (or only in genericized form)
```

---

## Milestone 6: Commands (17 tasks)

**Pattern:** copy → sanitize → verify → commit. One commit per command.

**Source:** `/Users/MH/Documents/git_saas/ai-coding-template/.claude/commands/athena/`

### Task 6.1: Port `plan.md` (detailed example)

- [ ] **Step 1: Copy**

```bash
cp /Users/MH/Documents/git_saas/ai-coding-template/.claude/commands/athena/plan.md /Users/MH/Documents/git_saas/athena-core/commands/athena/plan.md
```

- [ ] **Step 2: Sanitize**

Read the file. Apply universalization edits:
- Replace `openapi.yaml` references → "your spec source (configurable via athena.config.json)"
- Replace `docs/epics/EPIC_INDEX.md` → "your epic index"
- Drop references to specific stop-rules that are profile-only
- Replace `~/.claude/template-memory/` → "Tier 0 memory (at `~/.claude/athena-memory/`)"

- [ ] **Step 3: Verify**

```bash
grep -E 'fastapi|openapi\.yaml|server/|client/' /Users/MH/Documents/git_saas/athena-core/commands/athena/plan.md
# expected: only inside config-explanation context
```

- [ ] **Step 4: Commit**

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add commands/athena/plan.md
git commit -m "feat(commands): port /athena:plan (universalized)"
```

### Tasks 6.2 – 6.17: Port remaining 16 commands

Apply the Task 6.1 pattern to each:

- [ ] **6.2: `loop.md`** — orchestrator loop; drop references to specific epic format
- [ ] **6.3: `cycle.md`** — full DevOps cycle; check if its current implementation requires `openapi.yaml` step (if so, make optional). **Open question per spec §12: confirm at implementation time whether `/athena:cycle` is too stack-bound for core or should ship to profile.**
- [ ] **6.4: `autopilot.md`** — confidence-gated auto-advance; drop FastAPI-specific confidence heuristics, keep generic ones
- [ ] **6.5: `batch.md`** — parallel wave dispatch; already mostly universal
- [ ] **6.6: `save.md`** — checkpoint agents; replace `docs/context/` path-baked refs with `$PROJECT_CONTEXT_DIR`
- [ ] **6.7: `load.md`** — load project context; same path universalization
- [ ] **6.8: `learn.md`** — memory refresh; replace `~/.claude/template-memory/` → `$ATHENA_MEMORY_DIR`; add `--batch` promotion-suggestion logic per spec §5.4
- [ ] **6.9: `promote.md`** — lesson promotion; same path universalization
- [ ] **6.10: `forget.md`** — archive weak lessons; same
- [ ] **6.11: `metrics.md`** — agent + memory dashboard; same
- [ ] **6.12: `dashboard.md`** — read-only pipeline view; same
- [ ] **6.13: `spec.md`** — feature spec design; drop "OpenAPI-first" hard requirement (read `spec.format` from `plugin.json` or `athena.config.json`)
- [ ] **6.14: `implement.md`** — TDD cycle; replace test-runner commands with stack-detect logic (read project's `package.json` / `pyproject.toml` to choose pytest vs. vitest vs. jest)
- [ ] **6.15: `qa.md`** — quality gate; drop coverage gate specifics (read threshold from `athena.config.json`, default 80%)
- [ ] **6.16: `ship.md`** — quick publish; keep universal
- [ ] **6.17: `pr.md`** — full PR pipeline; universalize gh command flags

Each commits as: `git commit -m "feat(commands): port /athena:<name> (universalized)"`

**M6 verification:**

```bash
ls /Users/MH/Documents/git_saas/athena-core/commands/athena/ | wc -l   # should be 17
grep -rE 'openapi\.yaml|server/|client/|fastapi|zeabur' /Users/MH/Documents/git_saas/athena-core/commands/athena/
# expected: only inside genericized explanation context
```

---

## Milestone 7: Seed memory — curate + sanitize (8 tasks)

**Pattern:** copy → sanitize line-by-line → verify zero stack refs → commit.

**Source:** `/Users/MH/.claude/template-memory/`

**Sanitization rule:** strip all references to FastAPI, React, openapi.yaml, Zeabur, GUID TypeDecorator, fastapi-users, MSW, Alembic, pytest, vitest, React Query, Tailwind, Zustand. Keep only the principle that survives a stack swap.

### Task 7.1: Sanitize `NEW_PROJECT_PRIMER.md` (detailed example)

- [ ] **Step 1: Copy**

```bash
cp /Users/MH/.claude/template-memory/NEW_PROJECT_PRIMER.md /Users/MH/Documents/git_saas/athena-core/seed-memory/NEW_PROJECT_PRIMER.md
```

- [ ] **Step 2: Read + sanitize**

Open the file. For each section/bullet, decide:
- **Universal principle** → keep, possibly rephrase to drop stack name
- **Stack-specific example** → either remove or convert to "(example: pytest + fastapi-users)"
- **Template-specific path** → remove entirely

Example transformations:
- "Always use fastapi-users for auth" → "Use a battle-tested auth library; don't roll your own"
- "edit openapi.yaml first" → "edit your spec FIRST (contract-first development)"
- "`pnpm install` at root for workspaces" → drop or generalize to "use your package manager's monorepo features"

- [ ] **Step 3: Verify**

```bash
grep -E 'fastapi|openapi\.yaml|zeabur|fastapi-users|alembic|react|vite|pnpm|GUID' /Users/MH/Documents/git_saas/athena-core/seed-memory/NEW_PROJECT_PRIMER.md
# expected: zero matches
```

- [ ] **Step 4: Commit**

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add seed-memory/NEW_PROJECT_PRIMER.md
git commit -m "feat(seed): sanitize NEW_PROJECT_PRIMER (stack-agnostic)"
```

### Tasks 7.2 – 7.8: Sanitize remaining 7 seed files

For each file below, apply the Task 7.1 pattern.

- [ ] **7.2: `testing-patterns.md`** — keep TDD, behavior > implementation, integration > mocks; drop pytest/vitest specifics.
- [ ] **7.3: `anti-patterns.md`** — keep universal anti-patterns (premature abstraction, feature-flag debt); drop React/FastAPI examples.
- [ ] **7.4: `failure-patterns.md`** — keep general failure modes (silent retries, race conditions); drop specific past incidents.
- [ ] **7.5: `debugging-patterns.md`** — keep methodology (reproduce → bisect → hypothesize); drop pytest/Vitest commands.
- [ ] **7.6: `dx-patterns.md`** — keep one-command setup, golden path patterns; drop specific tooling refs.
- [ ] **7.7: `security-learnings.md`** — keep universal security principles; drop FastAPI-specific snippets.
- [ ] **7.8: `workflow-patterns.md`** — keep orchestrator/batch/save patterns; drop refs to specific commands not yet ported.

Each commits as: `git commit -m "feat(seed): sanitize <file> (stack-agnostic)"`

**M7 verification:**

```bash
ls /Users/MH/Documents/git_saas/athena-core/seed-memory/*.md | wc -l   # should be 8
grep -rEi 'fastapi|openapi\.yaml|zeabur|fastapi-users|alembic|pnpm|react query|vite|tailwind|zustand' /Users/MH/Documents/git_saas/athena-core/seed-memory/
# expected: zero matches
```

---

## Milestone 8: Install flow + docs (6 tasks)

**Files:**
- Create: `/Users/MH/Documents/git_saas/athena-core/install.sh`
- Create: `/Users/MH/Documents/git_saas/athena-core/README.md`
- Create: `/Users/MH/Documents/git_saas/athena-core/INSTALL.md`
- Create: `/Users/MH/Documents/git_saas/athena-core/MIGRATION.md`
- Create: `/Users/MH/Documents/git_saas/athena-core/CLAUDE.md`

### Task 8.1: Implement `install.sh`

- [ ] **Step 1: Write failing test**

Append to `tests/test-install.sh`:

```bash
# Simulate first install
export HOME=$(mktemp -d)
[[ ! -f "$HOME/.claude/athena-memory/.installed" ]] || { echo "FAIL: pre-state wrong"; exit 1; }

bash "$PLUGIN_ROOT/install.sh"

[[ -f "$HOME/.claude/athena-memory/.installed" ]] || { echo "FAIL: .installed marker not created"; exit 1; }
[[ -f "$HOME/.claude/athena-memory/NEW_PROJECT_PRIMER.md" ]] || { echo "FAIL: seed not copied"; exit 1; }
[[ -f "$HOME/.claude/athena-memory/.meta/strengths.json" ]] || { echo "FAIL: strengths.json not initialized"; exit 1; }
echo "PASS: first install seeds memory + marker"

# Re-install: should be idempotent
bash "$PLUGIN_ROOT/install.sh"
echo "PASS: re-install is idempotent"

rm -rf "$HOME"
```

- [ ] **Step 2: Implement `install.sh`**

Create `/Users/MH/Documents/git_saas/athena-core/install.sh`:

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$SCRIPT_DIR"

ATHENA_MEMORY_DIR="${HOME}/.claude/athena-memory"
ATHENA_META_DIR="${ATHENA_MEMORY_DIR}/.meta"

mkdir -p "$ATHENA_MEMORY_DIR" "$ATHENA_META_DIR"

if [[ ! -f "$ATHENA_MEMORY_DIR/.installed" ]]; then
  # First install — seed memory
  cp -rn "$PLUGIN_ROOT/seed-memory/"*.md "$ATHENA_MEMORY_DIR/" 2>/dev/null || true
  # Initialize scoring state
  export CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT"
  bash "$PLUGIN_ROOT/scripts/memory/score.sh" init
  # Mark installed
  date -u +%Y-%m-%dT%H:%M:%SZ > "$ATHENA_MEMORY_DIR/.installed"
  echo "athena-core: first install complete — Tier 0 seeded with $(ls "$PLUGIN_ROOT/seed-memory"/*.md 2>/dev/null | wc -l) lessons"
else
  echo "athena-core: already installed ($(cat "$ATHENA_MEMORY_DIR/.installed")), skipping seed"
fi
```

- [ ] **Step 3: Run + commit**

```bash
chmod +x /Users/MH/Documents/git_saas/athena-core/install.sh
/Users/MH/Documents/git_saas/athena-core/tests/test-install.sh
cd /Users/MH/Documents/git_saas/athena-core
git add install.sh tests/test-install.sh
git commit -m "feat(install): idempotent first-install seeder"
```

### Task 8.2: Write `README.md`

- [ ] **Step 1: Create README**

Create `/Users/MH/Documents/git_saas/athena-core/README.md`:

```markdown
# Athena Core

> Universal meta-workflow plugin for Claude Code: memory tiers, planning, autopilot, review-loop, stop-verifier framework.

## Install

\`\`\`bash
claude code plugin install github.com/<github-username>/athena-core
\`\`\`

On first SessionStart, the plugin seeds `~/.claude/athena-memory/` with 8 sanitized starter lessons. This is **global** — shared across all your projects.

## Quick start

In any project:
\`\`\`bash
/athena:load --init        # bootstrap docs/context/
/athena:plan               # propose next epics
/athena:loop               # advance one orchestration step
\`\`\`

## What ships

- **17 commands** under `/athena:*` (plan, loop, cycle, autopilot, ship, qa, save, load, learn, promote, ...)
- **11 agents** (@orchestrator, @strategist, @reviewer, @qa, @evaluator, @debugger, @best-practice, @memory-curator, @spec-writer, @deployer, @designer)
- **6 skills** auto-loaded by description match (using-athena, tdd-workflow, verification-discipline, systematic-debugging, launch-checklist, reviewer-convergence)
- **10 stop-verifier rules** (universal: console.log residue, large-file warning, mock depth, parametrize nudge, verification discipline, ...)
- **Memory subsystem**: global Tier 0 (cross-project), per-project Tier 1, Ebbinghaus decay loop, selective injection

## Memory model

- **Tier 0** at `~/.claude/athena-memory/` — global wisdom, accumulates across projects
- **Tier 1** at `<project>/docs/context/` — per-project state
- Audit log at `<project>/.claude/audit.jsonl`

## Documentation

- [INSTALL.md](INSTALL.md) — detailed install + uninstall + upgrade
- [MIGRATION.md](MIGRATION.md) — for users porting from AI Coding Template

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add README.md
git commit -m "docs: add README with install + quick start"
```

### Task 8.3: Write `INSTALL.md`

- [ ] **Step 1: Create INSTALL.md**

Create `/Users/MH/Documents/git_saas/athena-core/INSTALL.md` covering: install command, what it does, first-install seed behavior, per-project bootstrap (`/athena:load --init`), upgrade behavior (skips seed if `.installed` marker exists), uninstall (preserves `~/.claude/athena-memory/`), troubleshooting (missing jq, hook path errors).

- [ ] **Step 2: Commit**

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add INSTALL.md
git commit -m "docs: add INSTALL guide"
```

### Task 8.4: Write `MIGRATION.md`

- [ ] **Step 1: Create MIGRATION.md**

Create `/Users/MH/Documents/git_saas/athena-core/MIGRATION.md` for users migrating from the AI Coding Template repo. Cover: which assets the plugin now provides (so user can delete duplicates from `.claude/` in their fork), which assets stay project-local (`docs/context/`, `.claude/audit.jsonl`), how to verify Tier 0 migration (copy `~/.claude/template-memory/` content into `~/.claude/athena-memory/` if pre-existing).

- [ ] **Step 2: Commit**

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add MIGRATION.md
git commit -m "docs: add MIGRATION guide for AI Coding Template users"
```

### Task 8.5: Write plugin `CLAUDE.md`

- [ ] **Step 1: Create CLAUDE.md**

Create `/Users/MH/Documents/git_saas/athena-core/CLAUDE.md`:

```markdown
# Athena Core — Plugin Session Identity

> Auto-loaded when working on the athena-core plugin itself.

## What this is

The `athena-core` Claude Code plugin. Universal meta-workflow port of the Athena system from the AI Coding Template.

## Layout

\`\`\`
.claude-plugin/      manifest (plugin.json, marketplace.json)
skills/              6 universal skills
agents/              11 universal agents
commands/athena/     17 universal commands
hooks/               hooks.json registration
scripts/lib/         common.sh (two-root resolution)
scripts/memory/      score.sh, match.sh, inject.sh, half-life-resolve.sh
scripts/hooks/       6 hook scripts
scripts/stop-rules/  10 discrete stop-rule scripts
seed-memory/         8 sanitized Tier 0 lessons
tests/               3 fixtures + ~20 fixture-based tests
\`\`\`

## Rules

- All scripts MUST source `${CLAUDE_PLUGIN_ROOT}/scripts/lib/common.sh`
- All path references use `$ATHENA_MEMORY_DIR`, `$PROJECT_CONTEXT_DIR`, `$PROJECT_AUDIT_LOG` — never hardcoded paths
- Stop-rules are discrete scripts in `scripts/stop-rules/`; the meta `stop-verifier.sh` discovers and runs them all
- No FastAPI, React, openapi, Zeabur, Alembic references anywhere — those are Phase 2 profile concerns
- Sanitization rule: a lesson that names a specific framework either gets generalized or moves to profile pack

## Test before commit

`bash tests/run-all.sh` must pass on all 3 fixtures.
```

- [ ] **Step 2: Commit**

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add CLAUDE.md
git commit -m "docs: add plugin's own CLAUDE.md identity"
```

### Task 8.6: Verify install flow on all 3 fixtures

- [ ] **Step 1: Manual smoke**

```bash
for fixture in empty-project nodejs-mini python-mini; do
  export HOME=$(mktemp -d)
  cd /Users/MH/Documents/git_saas/athena-core/tests/fixtures/$fixture
  CLAUDE_PLUGIN_ROOT=/Users/MH/Documents/git_saas/athena-core bash /Users/MH/Documents/git_saas/athena-core/install.sh
  [[ -f "$HOME/.claude/athena-memory/.installed" ]] || { echo "FAIL on $fixture"; exit 1; }
  echo "PASS on $fixture"
  rm -rf "$HOME"
done
```

- [ ] **Step 2: Commit (no file changes — verification only)**

(Skip commit; this is a verification gate.)

**M8 verification:** Install works idempotently on 3 fixtures. README + INSTALL + MIGRATION + plugin CLAUDE.md complete.

---

## Milestone 9: Test harness + smoke (5 tasks)

### Task 9.1: Write `tests/run-all.sh`

- [ ] **Step 1: Create runner**

Create `/Users/MH/Documents/git_saas/athena-core/tests/run-all.sh`:

```bash
#!/bin/bash
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT"

echo "=== athena-core test suite ==="
failed=0
for test in "$PLUGIN_ROOT"/tests/test-*.sh; do
  name=$(basename "$test")
  printf "Running %s... " "$name"
  if bash "$test" >/tmp/test-out.log 2>&1; then
    echo "OK"
  else
    echo "FAIL"
    cat /tmp/test-out.log
    failed=$((failed + 1))
  fi
done

echo "==="
if [[ $failed -gt 0 ]]; then
  echo "RESULT: $failed test file(s) failed"
  exit 1
fi
echo "RESULT: all tests passed"
```

- [ ] **Step 2: Run + commit**

```bash
chmod +x /Users/MH/Documents/git_saas/athena-core/tests/run-all.sh
/Users/MH/Documents/git_saas/athena-core/tests/run-all.sh
cd /Users/MH/Documents/git_saas/athena-core
git add tests/run-all.sh
git commit -m "test: add run-all.sh test suite runner"
```

### Task 9.2: Write `tests/test-commands.sh` (smoke test for each command file)

- [ ] **Step 1: Create command smoke test**

Create `/Users/MH/Documents/git_saas/athena-core/tests/test-commands.sh`:

```bash
#!/bin/bash
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Verify all 17 commands exist + have frontmatter
expected_count=17
actual_count=$(ls "$PLUGIN_ROOT"/commands/athena/*.md 2>/dev/null | wc -l)
[[ "$actual_count" == "$expected_count" ]] || { echo "FAIL: expected $expected_count commands, got $actual_count"; exit 1; }
echo "PASS: 17 commands present"

# Each command has frontmatter description
for cmd in "$PLUGIN_ROOT"/commands/athena/*.md; do
  head -10 "$cmd" | grep -q "^description:" || { echo "FAIL: no description in $(basename "$cmd")"; exit 1; }
done
echo "PASS: all commands have description frontmatter"

# Each command file has no FastAPI/openapi/zeabur refs (universalized)
contamination=$(grep -rEli 'fastapi|openapi\.yaml|zeabur|fastapi-users' "$PLUGIN_ROOT"/commands/athena/ || true)
if [[ -n "$contamination" ]]; then
  echo "FAIL: stack-specific refs in: $contamination"
  exit 1
fi
echo "PASS: no stack-specific contamination in commands"
```

- [ ] **Step 2: Run + commit**

```bash
chmod +x /Users/MH/Documents/git_saas/athena-core/tests/test-commands.sh
/Users/MH/Documents/git_saas/athena-core/tests/test-commands.sh
cd /Users/MH/Documents/git_saas/athena-core
git add tests/test-commands.sh
git commit -m "test: smoke-test command count + frontmatter + sanitization"
```

### Task 9.3: Write similar smoke tests for agents + skills + seed

- [ ] **Step 1: Append agent/skill/seed smoke checks to `test-commands.sh`** (or split into separate files)

Pattern (adapt for agents, skills, seed-memory):

```bash
# Agents: 11 expected, all sanitized
[[ $(ls "$PLUGIN_ROOT"/agents/*.md | wc -l) == "11" ]] || exit 1
! grep -rEli 'fastapi|openapi\.yaml|zeabur' "$PLUGIN_ROOT"/agents/ || exit 1

# Skills: 6 expected, all with description frontmatter
[[ $(ls "$PLUGIN_ROOT"/skills/*.md | wc -l) == "6" ]] || exit 1
for s in "$PLUGIN_ROOT"/skills/*.md; do
  head -10 "$s" | grep -q "^description:" || exit 1
done

# Seed: 8 expected, zero contamination
[[ $(ls "$PLUGIN_ROOT"/seed-memory/*.md | wc -l) == "8" ]] || exit 1
! grep -rEli 'fastapi|openapi\.yaml|zeabur|fastapi-users|alembic|react|pnpm|vitest|pytest|tailwind|zustand' "$PLUGIN_ROOT"/seed-memory/ || exit 1
```

- [ ] **Step 2: Run + commit**

```bash
/Users/MH/Documents/git_saas/athena-core/tests/test-commands.sh
cd /Users/MH/Documents/git_saas/athena-core
git add tests/test-commands.sh
git commit -m "test: extend smoke tests to agents/skills/seed counts + sanitization"
```

### Task 9.4: Add GitHub Actions CI (optional but recommended)

- [ ] **Step 1: Create CI config**

Create `/Users/MH/Documents/git_saas/athena-core/.github/workflows/test.yml`:

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install jq
        run: sudo apt-get install -y jq
      - name: Run test suite
        run: bash tests/run-all.sh
```

- [ ] **Step 2: Commit**

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add .github/workflows/test.yml
git commit -m "ci: GitHub Actions runs tests/run-all.sh on push + PR"
```

### Task 9.5: Tag v0.1.0-alpha + final verification

- [ ] **Step 1: Final run-all.sh**

```bash
/Users/MH/Documents/git_saas/athena-core/tests/run-all.sh
```

Expected: all test files PASS, exit 0.

- [ ] **Step 2: Update version in plugin.json + package.json + marketplace.json from `0.1.0` → `0.1.0-alpha`** (or whichever convention you prefer for first pre-release)

```bash
cd /Users/MH/Documents/git_saas/athena-core
# Manually edit version fields in:
#   .claude-plugin/plugin.json
#   .claude-plugin/marketplace.json
#   package.json
```

- [ ] **Step 3: Commit + tag**

```bash
cd /Users/MH/Documents/git_saas/athena-core
git add .claude-plugin/plugin.json .claude-plugin/marketplace.json package.json
git commit -m "release: v0.1.0-alpha"
git tag v0.1.0-alpha
```

- [ ] **Step 4: Push (optional — only if remote is set up)**

```bash
# Only run if you've added a GitHub remote:
git push origin main
git push origin v0.1.0-alpha
```

**M9 verification:** `tests/run-all.sh` green on local machine. Plugin tagged v0.1.0-alpha. Ready for installation via `claude code plugin install <path or git url>`.

---

## Post-Phase 1 (NOT part of this plan)

- **Profile pack extraction** (Phase 2 — separate spec + plan): port the 6 deferred commands, 2 deferred agents, 7 deferred skills, 13 deferred stop-rules, 5 deferred seed files into `athena-saas-profile` plugin that depends on `athena-core`.
- **Marketplace submission**: after 2-3 months of stability (Phase 3).
- **Migration of this repo**: move ai-coding-template to consume `athena-core` + contribute `athena-saas-profile` (separate cleanup epic).

## Open questions flagged for implementation

These come from spec §12 — to resolve during implementation, not blockers:

1. **`match.sh` relevance threshold** — current default top-3 + min score 0.4 may need tuning per stack. Run against all 3 fixtures during M2/M8 and adjust.
2. **`/athena:cycle` viability in core** — confirm at Task 6.3 whether its current implementation requires a profile pack. If so, move to deferred list and rebuild milestone count (16 commands instead of 17).
3. **`@deployer` framework usefulness without profile** — confirm at Task 5.10 whether the universal framework alone is useful or should be entirely deferred. If deferred, agent count drops to 10.
