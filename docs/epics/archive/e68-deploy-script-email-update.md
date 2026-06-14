# E68 — Deploy Script Email Update

> **Phase**: 21 | **Size**: S (3 SP) | **Priority**: P1
> **Depends on**: E67 (env vars must be renamed first)
> **Branch**: `feat/E68-deploy-script-email`

---

## Problem Statement

`scripts/deploy-zeabur.sh` Gate 3 (lines 186-217) prompts for `SMTP_HOST` and generates `SMTP_*` vars in `.env.zeabur`. After E66+E67, the email system uses `EMAIL_PROVIDER`/`ZEABUR_EMAIL_API_KEY` — the deploy script generates incompatible config.

## Solution

Update Gate 3 in `deploy-zeabur.sh` to:
1. Replace SMTP prompt with Zeabur Email API key prompt
2. Generate `EMAIL_PROVIDER=zeabur` + `ZEABUR_EMAIL_API_KEY` + `EMAIL_FROM` in `.env.zeabur`
3. Add instructions for creating the API key in Zeabur dashboard

## Stories

### S1: Gate 3 — Email Section Rewrite

**AC**:
- [ ] Remove: SMTP_HOST prompt, all `SMTP_*` var generation
- [ ] Add: prompt for Zeabur Email API key (with instructions: "Create at Zeabur Dashboard → Email")
- [ ] Generate: `EMAIL_PROVIDER=zeabur`, `ZEABUR_EMAIL_API_KEY={input}`, `EMAIL_FROM=noreply@{client_domain}`
- [ ] If user skips (Enter): `EMAIL_PROVIDER=console` (safe fallback)
- [ ] Add `LOG_FORMAT=json` to production env generation

### S2: Documentation in Script Output

**AC**:
- [ ] Gate 6 (Verification) output includes email provider status
- [ ] "Next steps" section mentions email setup if `EMAIL_PROVIDER=console`
- [ ] Help text updated for `--env-only` mode

## Risk Notes

- Low risk — script change only, no code impact
- Backward compatible: existing `.env.zeabur` files still work (unknown vars are ignored)
