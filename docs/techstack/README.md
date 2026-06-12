# Tech Stack — Index

> Detailed reference for AI-Coding-Template tech decisions.
> For quick context restore, upload root `TECHSTACK.md` instead.

## Contents

| File | Covers | Lines |
|---|---|---|
| [architecture.md](architecture.md) | System diagram, project structure, design principles | ~80 |
| [server.md](server.md) | FastAPI, SQLAlchemy, endpoints, DB design, security, testing | ~150 |
| [client.md](client.md) | React 18, auth flow, cache tiers, API client, testing | ~185 |
| [openapi-workflow.md](openapi-workflow.md) | OpenAPI contract, SDD + TDD cycle, slash commands | ~80 |
| [deployment.md](deployment.md) | Env vars, Zeabur, pre-deploy gates, rollback | ~80 |
| [agents-memory.md](agents-memory.md) | Agent team, memory system, track roadmap | ~70 |
| [agent-teams.md](agent-teams.md) | Full agent team spec (reference) | ~90 |
| [ai-dev-pipeline.md](ai-dev-pipeline.md) | Full pipeline spec (reference) | ~150 |

## Rules

- Root `TECHSTACK.md` stays under 200 lines (lean summary for upload)
- Detailed content lives here in sub-files
- Update sub-files when architecture decisions change
- `@best-practice` agent owns architecture decisions
