# Architecture Overview

## System Diagram

```
+-------------------------------------------------------------+
|                       CLIENT TIER                             |
|                                                               |
|   React 18 + Vite + TypeScript                                |
|   Zustand (auth state) . React Query (server state)           |
|   tokenCache.ts (in-memory JWT) . axios interceptors          |
+----------------------------+----------------------------------+
                             |  HTTPS . REST . JSON
                             |  Authorization: Bearer <access_token>
+----------------------------v----------------------------------+
|                      API LAYER                                |
|                                                               |
|   FastAPI 0.115 . Python 3.12 . Pydantic v2                   |
|   PyJWT 2.9 . bcrypt 4.x . slowapi rate limiting              |
|   Middleware: CORS . JWT verification cache (30s TTL)          |
+----------------------------+----------------------------------+
                             |  SQLAlchemy 2.x async
+----------------------------v----------------------------------+
|                    DATA LAYER                                 |
|                                                               |
|   PostgreSQL 15 + extensions as needed                        |
|   Alembic migrations . UUID v4 PKs . DB triggers              |
+---------------------------------------------------------------+
```

**Design Principle:** The backend is the only authority on auth state. React communicates through a typed REST contract defined in `docs/openapi.yaml`. Any frontend (React Native, Next.js) can consume the same API without backend changes.

## Two-Tier Memory System

| Tier | Location | Contains | Owner |
|---|---|---|---|
| **Tier 0 -- Template** | `~/.claude/template-memory/` | Cross-project wisdom | `@memory-curator` |
| **Tier 1 -- Project** | `docs/context/` | This project's state | All agents |

## Project Structure

```
ai-coding-template/
|
+-- CLAUDE.md                    <-- Session identity (<100 lines)
+-- TECHSTACK.md                 <-- Upload to restore any Claude session
|
+-- docs/
|   +-- openapi.yaml             <-- API contract (single source of truth)
|   +-- techstack/               <-- Detailed tech decisions (this dir)
|   +-- dev-guide/               <-- Developer how-to docs
|   +-- pipeline/                <-- AI pipeline, agents, hooks
|   +-- specs/                   <-- Feature implementation plans
|   +-- context/                 <-- Agent memory write-backs
|
+-- server/                      <-- FastAPI (Python 3.12)
|   +-- alembic/                 <-- Migrations
|   +-- app/
|   |   +-- api/v1/endpoints/    <-- Route handlers
|   |   +-- core/                <-- config.py, security.py
|   |   +-- db/                  <-- session.py
|   |   +-- models/              <-- SQLAlchemy models
|   |   +-- schemas/             <-- Pydantic v2 models
|   |   +-- services/            <-- Business logic
|   |   +-- main.py              <-- FastAPI entry
|   +-- tests/
|
+-- client/                      <-- React 18 + TypeScript + Vite
|   +-- src/
|       +-- api/                 <-- axios, cacheConfig, queryKeys, types
|       +-- components/auth/     <-- LoginForm, RegisterForm
|       +-- hooks/               <-- useAuth, useSession
|       +-- pages/               <-- LoginPage, RegisterPage
|       +-- store/               <-- Zustand authStore
|       +-- tests/handlers/      <-- MSW request handlers
|
+-- .claude/
    +-- agents/                  <-- 8 AI subagents
    +-- commands/                <-- Slash commands
    +-- skills/                  <-- Auto-loaded context injectors
    +-- settings.json            <-- Hooks config
```
