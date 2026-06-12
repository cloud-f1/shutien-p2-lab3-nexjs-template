# E82 — Webhook Activation & JSONL Audit Log

> **Phase 25** | Priority: P0 | Points: 5 | Size: S
> **Depends on**: none

---

## Problem Statement

The project has zero external notification capability. `task-completed.sh` webhook is a commented-out stub. The audit log (`post-bash-log.sh`) writes plaintext — not queryable, no agent/epic attribution. Without observability, parallel pipeline monitoring (E85/E86) is blind.

## Stories

### S1: Enable Webhook in `task-completed.sh`

**AC:**
- [ ] Uncomment webhook logic in `scripts/hooks/task-completed.sh`
- [ ] Send structured JSON payload to `$AI_CODING_WEBHOOK_URL` (env var)
- [ ] Payload includes: `event`, `epic_id`, `step`, `status`, `duration_seconds`, `branch`, `timestamp`
- [ ] Gracefully skip if `$AI_CODING_WEBHOOK_URL` is not set (no error)
- [ ] Support Slack/Discord/generic webhook endpoints
- [ ] Timeout: 5 seconds (non-blocking)

### S2: Convert Audit Log to JSONL Format

**AC:**
- [ ] Modify `scripts/hooks/post-bash-log.sh` to write JSONL to `.claude/audit.jsonl`
- [ ] Each line: `{"ts":"...","event":"bash","cmd":"...","exit":N,"agent":"...","epic":"...","duration_ms":N}`
- [ ] Extract agent name from `$CLAUDE_AGENT` env var (if available)
- [ ] Extract epic ID from current branch name pattern `feat/E{n}-*`
- [ ] Backward compatible: if old `audit.log` exists, leave it (don't migrate)
- [ ] Queryable with `jq`: `jq 'select(.exit != 0)' .claude/audit.jsonl`

### S3: Hook Documentation Update

**AC:**
- [ ] Update `scripts/hooks/CLAUDE.md` with new webhook payload format
- [ ] Document `AI_CODING_WEBHOOK_URL` env var in hook docs
- [ ] Document JSONL audit log format and example `jq` queries

## Risk Notes

- Low risk — hook scripts only, no app code changes
- Webhook is fire-and-forget (non-blocking, no retry)
- JSONL append is atomic per line (no corruption risk)

## Files to Touch

```
scripts/hooks/task-completed.sh    — enable webhook
scripts/hooks/post-bash-log.sh     — JSONL format
scripts/hooks/CLAUDE.md            — documentation
```
