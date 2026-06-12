# E300 — Weekly Digest Emails for Project Owners

> Phase 46 — Workflow Discipline + Memory-Aware Planning | Size: M (5 SP) | Deps: E22 domain registry

## Problem

Owners report missing critical updates.

## Implementation Phases

### Phase 1 — Schema + scheduler

- sqlmodel for DigestRun
- APScheduler job

**Checkpoint:** DigestRun model creates row; cron job logs entry

### Phase 2 — Template + send

- Jinja template
- SendGrid integration

**Checkpoint:** Send hits MailHog in dev; HTML lints clean

### Phase 3 — Unsubscribe + observability

- unsub token
- Sentry breadcrumbs

**Checkpoint:** Unsubscribe link round-trips; Sentry receives breadcrumb

## Test Strategy

Server: factory-boy DigestRun factory + 3 parametrized happy/edge/error cases. Client: e2e Playwright for unsubscribe page. Coverage gate: 80%+ in `server/app/domains/digest/`.

## Risks

- SendGrid quota in dev

## Acceptance Criteria

- [ ] All phase checkpoints pass
- [ ] Test strategy implemented
- [ ] Coverage gate ≥80% in modified domains
- [ ] No new Stop Verifier violations
