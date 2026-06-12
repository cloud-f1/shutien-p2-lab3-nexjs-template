# E73 — New-Site CLI Post-E70 Sync

> **Phase**: 23 | **Size**: M (13 SP) | **Priority**: P0
> **Depends on**: none
> **Branch**: `MH/feat/E73-new-site-cli-sync`

---

## Problem Statement

E70 (Example Domain Extraction, PR #96) moved billing/teams/places/portfolios from the working tree to `docs/examples/domains/`. The `new-site.sh` Interactive Site Builder CLI was not updated — its domain feature prompts still reference places/portfolio as removable features, and `DOMAIN_REMOVAL_MAP` targets paths that no longer exist. Running `new-site.sh` post-clone produces a misleading experience where domain selection is a no-op.

The domain model needs to flip from **opt-OUT** (select domains to remove) to **opt-IN** (select example domains to install).

## Stories

### S1: Update Domain Feature Model (opt-OUT → opt-IN)

**AC**:
- [ ] `prompts.ts`: Replace "Places (CRUD + Map)" and "Portfolio (analytics + charts)" feature choices with opt-in example domains (blog, todo, crm) from `docs/examples/`
- [ ] `types.ts`: Update `ProjectConfig` type — `features` field reflects opt-in domain list
- [ ] `scaffold.ts`: Remove `DOMAIN_REMOVAL_MAP` entirely (no more domain removal logic)
- [ ] Add new `installDomains()` function that copies selected example domains into the project via `make new-domain` or direct file copy from `docs/examples/domains/`

### S2: Update Template File References

**AC**:
- [ ] `scaffold.ts`: Update `TEMPLATE_FILES` list to match current file structure (post-E66/E67/E70)
- [ ] Remove references to `.claude-plugin/plugin.json`, `.env.local.example`, `.env.production.example` if they no longer exist
- [ ] Add references to new files: `.env.local`, `.env.production`, `scripts/template-reset.sh`
- [ ] Verify all file paths in `TEMPLATE_FILES` exist in the current working tree

### S3: Update Tests

**AC**:
- [ ] Update all test files in `scripts/new-site/__tests__/` to reflect new domain model
- [ ] Test opt-in domain installation flow
- [ ] Test `--dry-run` mode produces correct output
- [ ] All existing tests pass with updated expectations

## Risk Notes

- The new-site CLI has its own `package.json` and test suite — changes are self-contained
- Must verify `docs/examples/domains/` structure is compatible with the install flow
- `make new-domain` may need minor updates to accept example domain as source
