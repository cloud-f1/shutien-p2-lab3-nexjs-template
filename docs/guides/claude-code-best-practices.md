# Claude Code Configuration Best Practices

> Based on David Chu's talk at Taipei Claude Community (2026) and 72 epics of real-world experience with this template.

---

## The Five Levels of AI Code Agent Collaboration

| Level | Name | Description | This Template |
|-------|------|-------------|---------------|
| 1 | Conversational | You prompt, Claude responds, you react | - |
| 2 | Configured | CLAUDE.md guides behavior, memory retains learnings | CLAUDE.md + docs/context/ |
| 3 | Automated | Hooks enforce rules, skills encode workflows | lifecycle hooks + project skills |
| 4 | Orchestrated | Custom agents with specific roles, tools, and memory | 12 agents + 23 commands |
| 5 | Autonomous | Agent teams operate independently, verify each other | /athena:loop + /athena:cycle |

---

## Design Philosophy: Defense in Depth

Rules are enforced at two complementary layers:

```
CLAUDE.md        = Prevention — tells Claude WHAT to do and WHY
Stop Verifier    = Enforcement — blocks completion if rules were violated
```

**Why not three layers?** Earlier versions added PostToolUse warnings (Layer 2) and PreToolUse file path guards (Layer 2.5). These were removed as over-design:

- PostToolUse can only warn, not block — the Stop verifier already catches everything
- PreToolUse file path guards solved a problem that never occurred in 72 epics
- Each extra hook adds: a process per tool call, a file to maintain, a place to update when rules change

**The right answer**: explicit rules in CLAUDE.md (prevention) + one Stop verifier (enforcement). Two layers, not three.

> "A good verifier with a bad workflow beats a good workflow without a verifier." — David Chu

---

## Rule Inventory

Every enforced rule, where it's defined, and where it's enforced.

### Architecture Rules

| Rule | CLAUDE.md | Stop Verifier | Other Hook |
|------|-----------|---------------|------------|
| Default to Server Components | yes | - | - |
| No hand-authored files in `components/ui/` | yes | `stop-verifier.sh` | - |
| No inline `style=` color overrides (use Tailwind `dark:`) | yes | `stop-verifier.sh` | - |
| Drizzle for DB access; mutations via Server Actions | yes | - | - |
| RBAC re-reads role from DB (Auth.js v5 + JWT) | yes | - | - |

### Testing Rules

| Rule | CLAUDE.md | Stop Verifier | Other Hook |
|------|-----------|---------------|------------|
| No `console.log` residue in committed code | yes | `stop-verifier.sh` | - |
| Vitest unit + Playwright e2e (`next-app/`) | yes | - | @qa: `post-test-coverage-gate.sh` |
| Verification discipline (Rule #23) before `feat:`/`fix:` commits | yes | `stop-verifier.sh` Rule 23 | `audit-emit-verification.sh` |

### Safety Rules

| Rule | CLAUDE.md | Stop Verifier | Other Hook |
|------|-----------|---------------|------------|
| No DROP TABLE / TRUNCATE | - | - | `pre-bash-guard.sh` (exit 2) |
| No git push origin main | - | - | `pre-bash-guard.sh` (exit 2) |
| No rm -rf / | - | - | `pre-bash-guard.sh` (exit 2) |
| Clean tree before deploy | - | - | @deployer: `pre-deploy-guard.sh` |
| Correct branch before deploy | - | - | @deployer: `pre-deploy-guard.sh` |

### Quality Rules

| Rule | CLAUDE.md | Stop Verifier | Other Hook |
|------|-----------|---------------|------------|
| TypeScript / TSX auto-format (Prettier) | - | - | `post-edit-lint.sh` |
| ESLint (eslint-config-next) clean | - | - | `pre-merge-check.sh` |
| drizzle-kit migration review | - | - | @dba: `/athena:dba` |

---

## Hook Architecture

### Global Hooks (settings.json)

```
SessionStart
  └─ session-start.sh          Inject ~30 lines of active context

UserPromptSubmit
  └─ user-prompt-submit.sh     Detect agent write-back requests

PreToolUse(Bash)
  └─ pre-bash-guard.sh         Block destructive commands + wrong dirs

PostToolUse(Write|Edit)
  └─ post-edit-lint.sh          Auto-format TypeScript/TSX (Prettier)

PostToolUse(Bash)
  └─ post-bash-log.sh           Audit trail → .claude/audit.log

Stop
  ├─ stop-verifier.sh           5 rule checks → exit 2 if violated
  └─ stop-notify.sh             macOS notification (after verifier passes)

SubagentStop
  └─ subagent-stop-writeback.sh Timestamp agent documents

TaskCompleted
  └─ task-completed.sh          Webhook stub (disabled)

WorktreeCreate
  └─ worktree-setup.sh          Copy .env + docs/context/ to worktree
```

### Agent-Scoped Hooks (in agent YAML frontmatter)

```
@qa           → post-test-coverage-gate.sh   Warn if coverage drops
@debugger     → debug-backup-pre-edit.sh     Backup file before edit
@debugger     → post-debug-verify.sh         Log verify pass/fail
@deployer     → pre-deploy-guard.sh          Block deploy if dirty or wrong branch
@dba          → /athena:dba                  Review drizzle-kit migrations
```

---

## The Stop Verifier (Highest-Leverage Hook)

**File**: `scripts/hooks/stop-verifier.sh`

**How it works**:
1. Collects all changed files (staged + unstaged + untracked)
2. Skips docs/config files (*.md, *.json, *.yaml, etc.)
3. Runs its static grep checks against changed source files (no `console.log`, no inline
   `style=` color overrides, no hand-authored `components/ui/`, verification discipline, etc.)
4. If any violation found: prints file:line + fix instruction → `exit 2` (blocks)
5. Claude must fix and retry. At 70% per-attempt accuracy, 4 retries → 99% overall.

**Why this matters** (David Chu's math):

```
Without verifier:  5 steps × 80% each = 0.8^5 = 33% overall success
With verifier:     Each retry = independent 70% chance
                   P(fail all 4) = 0.3^4 = 0.8%
                   P(success) = 99.2%
```

---

## Graduation Path: When to Create a New Hook

Three signals that a CLAUDE.md rule should graduate to a hook:

1. **Claude violated it twice** — the text instruction isn't enough
2. **It's mechanically checkable** — grep/regex can detect the violation
3. **The blast radius is high** — violations cause real damage (security, data loss, broken deploys)

If all three are true, create a hook. If only #1, make the CLAUDE.md rule more explicit first.

**Where to graduate**:

| Target | When | Example |
|--------|------|---------|
| Stop verifier (add a rule) | Static check on source files | No `console.log` in committed code |
| PreToolUse hook | Must block BEFORE the action | Dangerous bash commands |
| PostToolUse hook | Auto-fix AFTER the action | Prettier formatting |
| Agent-scoped hook | Only applies to one agent's workflow | drizzle-kit migration review for @dba |
| Skill | Complex knowledge Claude needs at a specific time | `nextjs-saas-patterns` gotchas |
| Agent | A persistent role across many tasks | @qa reviewing everything |

**Where NOT to graduate**:
- Rules that have never been violated → keep in CLAUDE.md text
- Rules that can't be grep-checked → keep in CLAUDE.md text or skills
- Workflow ordering ("schema before action") → keep in CLAUDE.md + skills

---

## Context Budget (1M Context Era)

```
CLAUDE.md:              ~200 lines  ≈ 2,800 tokens
Session-start injection: ~80 lines  ≈ 1,200 tokens
Skills (project):       ~varies     ≈ 1,500 tokens (only relevant ones auto-inject)
Agents (12 files):      ~700 lines  ≈ 1,100 tokens
─────────────────────────────────────────────────
Total always-on:       ~well under 1% of a 1M context budget
```

**Conclusion**: With 1M context, there is no reason to slim CLAUDE.md. Be explicit. Verbose-but-clear beats slim-but-implicit. The Boris Cherny approach (invest ruthlessly in CLAUDE.md) is correct at this scale.

**What to optimize**: Session-start injection. Only load active epic phase (~30 lines) instead of full history (277 lines). The savings aren't about tokens — they're about cognitive clarity.

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why It's Wrong | What to Do Instead |
|---|---|---|
| Three layers checking the same rule | Maintenance burden, false sense of security | One CLAUDE.md rule + one Stop verifier check |
| PreToolUse guard for rare events | Solves a problem that doesn't exist | Wait until it happens twice, then add |
| Slimming CLAUDE.md to save tokens | 100 tokens = 0.04% of 1M budget | Keep rules explicit; tokens are cheap |
| Running tests in hooks | Hooks timeout at ~5s; tests take 30s+ | Delegate to agents (@qa, @deployer) |
| Hook per rule | One process per tool call, per hook | Consolidate: one Stop verifier with N rules |

---

## File Reference

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Session identity — rules, layout, agents, commands |
| `.claude/settings.json` | Hook registry — which scripts run when |
| `scripts/hooks/CLAUDE.md` | Hook developer guide — contracts, patterns, registry |
| `scripts/hooks/*.sh` | Lifecycle hook scripts |
| `.claude/skills/*/` | Auto-loaded knowledge injectors (`nextjs-saas-patterns`, `athena-loop-speedups`, …) |
| `.claude/agents/*.md` | 12 agent role definitions |
| `.claude/commands/athena/*.md` | Athena slash command orchestrators |
| `docs/context/*.md` | Agent write-back memory (Tier 1) |
| `~/.claude/template-memory/` | Cross-project wisdom (Tier 0) |
