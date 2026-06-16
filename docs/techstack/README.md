# Tech Stack — Index

> Detailed reference for AI-Coding-Template tech decisions.
> For quick context restore, upload root `TECHSTACK.md` instead.

## Contents

| File | Covers |
|---|---|
| [architecture.md](architecture.md) | System diagram, project structure, design principles |
| [server.md](server.md) | Next.js server layer — Server Components/Actions, Route Handlers, Drizzle, Auth.js (JWT), RBAC, testing |
| [client.md](client.md) | Next.js App Router client — RSC vs `"use client"`, shadcn/ui, Tailwind v4 theming, forms, testing |
| [deployment.md](deployment.md) | Env vars (build-time vs runtime), Zeabur / GCP Cloud Run, pre-deploy gates, rollback |
| [agents-memory.md](agents-memory.md) | Agent team, memory system, domain architecture |
| [agent-teams.md](agent-teams.md) | Full agent team spec (reference) |
| [ai-dev-pipeline.md](ai-dev-pipeline.md) | Full pipeline spec (reference) |

## Rules

- Root `TECHSTACK.md` stays under 200 lines (lean summary for upload)
- Detailed content lives here in sub-files
- Update sub-files when architecture decisions change
- `@best-practice` agent owns architecture decisions
