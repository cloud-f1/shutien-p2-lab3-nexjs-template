# E106 — Post-Clone Customization Verifier — `make verify`

> **Phase 29** | Priority: P1 | Points: 13 | Size: L
> **Depends on**: E103 (dead config cleaned first)

---

## Problem Statement

After cloning and running `make reset`, a developer must manually check that all placeholder values are replaced, OAuth is configured, email provider is set, etc. There's no automated verification. `make doctor` checks tools and env vars exist but doesn't validate their content is customized. Template users deploy half-configured apps because nothing tells them what they missed.

## Stories

### S1: `make verify` Command

**AC:**
- [ ] New Makefile target `verify` that runs `scripts/verify-customization.sh`
- [ ] Output: numbered checklist with ✅/❌ per item
- [ ] Exit code 0 if all pass, 1 if any fail
- [ ] Can be run at any time, idempotent

### S2: Customization Checks

**AC:**
- [ ] Check 1: OpenAPI title is not "AI Coding Template" (customized)
- [ ] Check 2: `PROJECT_DISPLAY` in CLAUDE.md is not placeholder
- [ ] Check 3: `.env` SECRET_KEY is not in `_PLACEHOLDER_VALUES`
- [ ] Check 4: `.env` REFRESH_SECRET_KEY is not placeholder
- [ ] Check 5: `.env` DATABASE_URL is set (not empty)
- [ ] Check 6: At least one OAuth provider configured OR `OAUTH_DISABLED=true`
- [ ] Check 7: Email provider is set to non-console in production
- [ ] Check 8: `README.md` project name is customized
- [ ] Each check: descriptive message on failure with how to fix

### S3: Integration with Existing DX

**AC:**
- [ ] `make go` suggests running `make verify` after first setup
- [ ] `make tutorial` mentions `make verify` as a final step
- [ ] `/getting-started` page references the verify command
- [ ] CI workflow can optionally run `make verify` as a gate

### S4: Tests

**AC:**
- [ ] Script test: verify passes on properly customized env
- [ ] Script test: verify fails on default/placeholder env
- [ ] Integration with `make doctor` — no conflicts, complementary output

## Risk Notes

- Must handle partial customization gracefully (don't crash on missing files)
- OAuth "disabled" opt-out must be explicit (not just missing config)
- Depends on E103 having cleaned dead config so checks are against real config surface

## Files to Touch

```
Makefile                              — update: add verify target
scripts/verify-customization.sh       — new: customization verification script
docs/guides/en/quickstart.md          — update: mention make verify
docs/guides/zh-TW/quickstart.md       — update: mention make verify
```
