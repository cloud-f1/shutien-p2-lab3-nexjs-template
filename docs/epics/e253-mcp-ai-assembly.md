# E253 — MCP + AI-Assembly End-to-End

**Phase:** 58 | **Status:** ⬜ | **Depends:** E250

## Problem

The whole point is "AI 直接組裝模組". We need the MCP wiring plus a proven end-to-end where an
agent installs a module by natural language and completes post-install.

## Solution

- `.mcp.json` configuring the shadcn MCP server pointed at the `@saas` namespace (private
  registry support: headers / token via env if hosted).
- Runbook: `npx shadcn@latest mcp init --client claude`; how an agent browses / searches /
  installs `@saas/*`; how it reads `module.manifest.json` + the `install-*` skill to wire
  env / migration.
- A scripted end-to-end demo (documented; smoke test where feasible): "install `@saas/landing`
  via MCP into a clean app and render it".

## Acceptance

- [ ] `.mcp.json` present; shadcn MCP server resolves the `@saas` namespace
- [ ] runbook documents browse → search → install → post-install for an agent
- [ ] demonstrated end-to-end: a module installed via MCP + wired via its install skill (≥ `@saas/landing`)
- [ ] manifest fields (env/db/deps) are machine-read during assembly
