### E300 — Weekly Digest Emails for Project Owners — 2026-05-19 (brainstorm)

| Field | Value |
|---|---|
| Priority | P1 |
| Size | M |
| SP | 5 |
| Rationale | Owners report missing critical updates. |
| Dependencies | E22 domain registry |

**Phases:**
1. Schema + scheduler — sqlmodel for DigestRun; APScheduler job
2. Template + send — Jinja template; SendGrid integration
3. Unsubscribe + observability — unsub token; Sentry breadcrumbs

**Checkpoints:**
- Phase 1: DigestRun model creates row; cron job logs entry
- Phase 2: Send hits MailHog in dev; HTML lints clean
- Phase 3: Unsubscribe link round-trips; Sentry receives breadcrumb

**Test Strategy:** Server: factory-boy DigestRun factory + 3 parametrized happy/edge/error cases. Client: e2e Playwright for unsubscribe page. Coverage gate: 80%+ in `server/app/domains/digest/`.

**Risks:** SendGrid quota in dev

⏸️ AWAITING HUMAN APPROVAL — run `/athena:plan approve E300` to render `docs/epics/e300-weekly-digest-emails.md`