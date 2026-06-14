#!/usr/bin/env bash
# install-deploy-tools.sh — one-command quick-start for the deploy toolchain.
#
# Idempotent: re-running is safe. Installs what's missing, skips what's present,
# and prints a per-tool status summary at the end.
#
#   Installs : Zeabur Claude plugin (zeabur@zeabur), Zeabur CLI (npm -g zeabur)
#   Checks   : node>=20, pnpm, docker, gcloud (NOT auto-installed — link printed)
#
# Usage:
#   bash scripts/install-deploy-tools.sh        # install + check
#   make install-deploy-tools                   # same, via Makefile
#
# See docs/guides/deployment.md for the deploy roads this enables.
set -uo pipefail

# ── pretty output ────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; B=$'\033[34m'; D=$'\033[0m'
else
  G=""; Y=""; R=""; B=""; D=""
fi
ok()   { printf '%s✔%s %s\n'  "$G" "$D" "$1"; }
warn() { printf '%s▲%s %s\n'  "$Y" "$D" "$1"; }
err()  { printf '%s✖%s %s\n'  "$R" "$D" "$1"; }
step() { printf '\n%s→ %s%s\n' "$B" "$1" "$D"; }
has()  { command -v "$1" >/dev/null 2>&1; }

STATUS=()       # collected "<tool>|<state>" for the final summary
record() { STATUS+=("$1|$2"); }

CORE_OK=1       # node/pnpm present == core satisfied → exit 0

# ── prerequisites (check only) ───────────────────────────────────────────────
step "Prerequisites"

if has node; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "${NODE_MAJOR:-0}" -ge 20 ]; then
    ok "node $(node -v) (>= 20)"; record node ok
  else
    err "node $(node -v) — need >= 20"; record node old; CORE_OK=0
  fi
else
  err "node missing — install Node >= 20: https://nodejs.org"; record node missing; CORE_OK=0
fi

if has pnpm; then ok "pnpm $(pnpm -v)"; record pnpm ok
else warn "pnpm missing — 'corepack enable' or https://pnpm.io/installation"; record pnpm missing; CORE_OK=0; fi

if has docker; then ok "docker present"; record docker ok
else warn "docker missing — optional for local stack: https://docs.docker.com/get-docker/ (or OrbStack)"; record docker missing; fi

# ── Zeabur Claude plugin (Road 1 assistant) ──────────────────────────────────
step "Zeabur Claude plugin (zeabur@zeabur)"
if has claude; then
  if claude plugin list 2>/dev/null | grep -qi 'zeabur@zeabur'; then
    ok "plugin already installed"; record zeabur-plugin present
  else
    claude plugin marketplace add zeabur/agent-skills >/dev/null 2>&1 || true
    if claude plugin install zeabur@zeabur >/dev/null 2>&1; then
      ok "plugin installed"; record zeabur-plugin installed
    else
      warn "plugin install failed — run: claude plugin install zeabur@zeabur"; record zeabur-plugin failed
    fi
  fi
else
  warn "claude CLI not found — skip plugin (install Claude Code, then re-run)"; record zeabur-plugin skipped
fi

# ── Zeabur CLI (Road 1 deploy) ───────────────────────────────────────────────
step "Zeabur CLI"
if has zeabur; then
  ok "zeabur CLI present ($(zeabur version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo installed))"
  record zeabur-cli present
elif has npm; then
  if npm i -g zeabur >/dev/null 2>&1; then
    ok "zeabur CLI installed ($(zeabur version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo ok))"
    record zeabur-cli installed
  else
    warn "npm i -g zeabur failed — try with sudo or a Node version manager"; record zeabur-cli failed
  fi
else
  warn "npm missing — cannot install Zeabur CLI"; record zeabur-cli skipped
fi

# ── gcloud (Road 2 — check only, never auto-install the SDK) ──────────────────
step "Google Cloud SDK (Road 2 — GCP Cloud Run + Cloud SQL)"
if has gcloud; then
  ok "gcloud present ($(gcloud version 2>/dev/null | head -1))"
  record gcloud present
  gcloud components list --filter='id=cloud-run-proxy OR id=cloud_sql_proxy' --format='value(id)' >/dev/null 2>&1 || true
  printf '   %s(login + project: gcloud auth login && gcloud config set project <PROJECT_ID>)%s\n' "$Y" "$D"
else
  warn "gcloud missing — Road 2 only. Install: https://cloud.google.com/sdk/docs/install"
  record gcloud missing
fi

# ── summary ──────────────────────────────────────────────────────────────────
step "Summary"
for entry in "${STATUS[@]}"; do
  tool="${entry%%|*}"; state="${entry##*|}"
  case "$state" in
    ok|present|installed) ok   "$tool — $state" ;;
    skipped|missing|old)  warn "$tool — $state" ;;
    *)                    err  "$tool — $state" ;;
  esac
done

echo
if [ "$CORE_OK" -eq 1 ]; then
  ok "Core toolchain ready. Next: see docs/guides/deployment.md (Road 1 Zeabur · Road 2 GCP)."
  exit 0
else
  err "Core toolchain incomplete (node>=20 + pnpm required). Fix the ▲/✖ items above and re-run."
  exit 1
fi
