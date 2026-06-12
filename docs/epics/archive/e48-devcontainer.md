# E48 — Dev Container & Codespaces Support

> **Size**: M (13 SP) | **Priority**: P1 | **Phase**: 17
> **Dependencies**: none

---

## Problem Statement

No `.devcontainer/` or Codespaces config exists. Cloud IDE users (40%+ of new contributors) get a blank environment. The Docker dev profile from E41 exists but doesn't integrate with Codespaces port-forwarding or lifecycle.

## Stories

### S1: Dev Container Configuration
**Acceptance Criteria**:
- [ ] `.devcontainer/devcontainer.json` created
- [ ] Uses existing `docker-compose.yml` dev profile
- [ ] Includes VS Code extensions: ESLint, Python, Vite, Prettier
- [ ] Port forwarding: 5173 (client), 8000 (server), 8025 (mailpit)
- [ ] `postCreateCommand` runs `make go` equivalent

### S2: Codespaces Integration
**Acceptance Criteria**:
- [ ] "Open in Codespaces" button added to README
- [ ] Codespaces auto-starts all services on creation
- [ ] `VITE_API_URL` configured for Codespaces port forwarding
- [ ] Health check passes after container creation

### S3: Gitpod Support
**Acceptance Criteria**:
- [ ] `.gitpod.yml` created with equivalent config
- [ ] "Open in Gitpod" button added to README
- [ ] Services auto-start in Gitpod workspace

## Technical Notes

- Dev container can extend the existing `docker-compose.yml` dev profile
- Codespaces port forwarding uses `CODESPACE_NAME` env var for URL construction
- `VITE_API_URL` needs dynamic resolution in Codespaces (not `localhost:8000`)
- Keep dev container lightweight — use feature-based installs over custom Dockerfile
