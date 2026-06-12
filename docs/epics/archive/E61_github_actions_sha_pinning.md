# E61 — GitHub Actions SHA Pinning

> **Phase**: 19 — Post-v1.0.0 Production Hardening
> **Priority**: P2 | **Points**: 3
> **Depends on**: None (independent)
> **Source**: Cycle 6 audit — supply chain risk from tag-pinned Actions

---

## Problem Statement

`.github/workflows/ci.yml`, `audit.yml`, and `docker-publish.yml` use tag-pinned actions (`actions/checkout@v4`, `pnpm/action-setup@v4`) rather than SHA-pinned actions. Tag pins are mutable — a compromised action could hijack CI. SLSA level 2+ and GitHub's security hardening guide recommend SHA pinning all third-party actions.

## Stories

### E61-S01: SHA Pin All Actions (3 pts)

**Task**: Replace all tag-pinned actions with SHA-pinned versions in:
- `.github/workflows/ci.yml`
- `.github/workflows/audit.yml`
- `.github/workflows/docker-publish.yml`

**Format**:
```yaml
# Before
- uses: actions/checkout@v4

# After
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
```

**Acceptance Criteria**:
- Given all workflow files
- When I search for `@v[0-9]` patterns
- Then zero matches are found (all SHA-pinned)
- And each SHA has a comment with the tag version for readability
- And CI still passes (SHAs resolve to the same code as tags)

## Risk Notes

- **Zero functional risk**: SHAs point to the exact same code as the tags
- **Maintenance**: When upgrading actions, must update both SHA and comment tag
- **Verification**: Use `gh api /repos/{owner}/{repo}/git/ref/tags/{tag}` to get SHAs

## Dependency Chain

```
E61-S01 (single story, no deps)
```
