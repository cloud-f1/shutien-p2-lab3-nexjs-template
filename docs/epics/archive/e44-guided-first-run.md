# E44 — Guided First-Run Experience (No Claude Code Required)

> **Size**: M (13 SP) | **Priority**: P1 | **Phase**: 16
> **Dependencies**: E41 (startup must work first)

---

## Problem Statement

After setup, beginners face a "now what?" cliff. The template's value proposition is the AI agent system, but using it requires Claude Code CLI. No guided path exists for developers who want a SaaS starter without the AI toolchain. All 14 Athena commands are listed with equal prominence — a beginner cannot distinguish the 3 they need.

## Stories

### S1: `make tutorial` — Terminal Walkthrough
**Acceptance Criteria**:
- [ ] Interactive terminal guide: "Build your first endpoint in 5 minutes"
- [ ] Steps: create domain → add model → add endpoint → test → see result
- [ ] Works without Claude Code — uses `make new-domain NAME=notes` wrapper
- [ ] Clear success message at each step

### S2: `/getting-started` Client Page
**Acceptance Criteria**:
- [ ] New page at `/getting-started` in the client app
- [ ] Interactive checklist: env configured ✓, DB connected ✓, first API call ✓
- [ ] Auto-detects completion state (calls health endpoint, checks auth)
- [ ] Links to next steps based on what's working

### S3: `make new-domain` Wrapper
**Acceptance Criteria**:
- [ ] `make new-domain NAME=notes` creates a new domain without Claude Code
- [ ] Wraps the domain generator (E23) in a simple make target
- [ ] Prints next steps after generation

### S4: Claude Code-Free Documentation
**Acceptance Criteria**:
- [ ] `docs/guides/without-claude-code.md` — full workflow using just make/CLI
- [ ] Covers: create domain, add endpoints, run tests, deploy
- [ ] Positions Claude Code as "power-up" not "requirement"

## Technical Notes

- `make new-domain` can call the existing domain generator script directly
- `/getting-started` page should use the existing health endpoint (`/api/v1/health`)
- Keep the tutorial script simple — bash with `echo` prompts, not a TUI framework
- The "essentials" commands for beginners: `make go`, `make new-domain`, `make test`
