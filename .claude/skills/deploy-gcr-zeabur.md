---
name: deploy-gcr-zeabur
description: >
  Retired skill — do not load. The GCR + dual FastAPI client/server flow it
  described is obsolete (the app migrated to a single Next.js service). For the
  current Next.js deploy use the `deploy-config` skill (Zeabur + GCP Cloud Run).
  Tombstone kept for git history and back-references; carries no active guidance.
---

# [Retired] Deploy GCR + Zeabur

> **Superseded.** This described the old GCR + dual FastAPI/Vite client+server
> deploy, which no longer exists. For the current single Next.js service, use the
> **[`deploy-config`](deploy-config/SKILL.md)** skill (Road 1 Zeabur · Road 2 GCP
> Cloud Run + Cloud SQL) and the runbooks in
> [`docs/guides/deployment.md`](../../docs/guides/deployment.md).
> Retired by E257 (2026-06-15); originally consolidated into deploy-readiness by E210.
