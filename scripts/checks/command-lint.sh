#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# command-lint.sh — lint .claude/commands/**/*.md + .claude/agents/*.md
#
# Checks:
#   (a) FATAL — YAML frontmatter parses: the file starts with a `---` line, a
#       second `---` line closes the block, and any single-line double-quoted
#       `description: "..."` value has no unescaped `"` inside it.
#   (b) WARN  — stale-stack tokens found outside code-history context:
#       `uv run pytest`, `uvicorn`, `alembic`, `VITE_`, `schemathesis`
#       (word-boundary at the start of the token). Many hits are legitimate —
#       this repo's docs deliberately explain "the FastAPI server / Vite SPA
#       was removed in the Phase 53 migration" using these exact words. Escape
#       hatch: append `# lint-allow-stale-stack` to the specific line to mark
#       it as an intentional historical reference.
#   (c) WARN  — legacy tool name `Task` (not `TaskCreate`/`TaskUpdate`/
#       `TaskStop`/`Agent`) referenced on a `tools:`/`allowed-tools:`
#       frontmatter line.
#   (d) FATAL — any `scripts/*.sh` path referenced in the file body that does
#       not exist on disk (relative to repo root).
#
# Limitations (documented, not fixed here — a real YAML parser is out of scope
# for a pre-merge shell gate; see the header note in the task this shipped
# under):
#   - (a) is a pragmatic grep-level check, not a real YAML parser. It catches
#     "no frontmatter block at all" and "no closing '---'" and "an unescaped
#     quote inside a single-line double-quoted description:" — it does NOT
#     validate general YAML syntax (nested flow mappings, multi-line block
#     scalars, anchors/aliases, etc.).
#   - (d) only recognizes literal `scripts/<path>.sh` substrings; a path built
#     from a shell variable (e.g. `scripts/$FOO.sh`) is not resolvable and is
#     silently skipped, not flagged as either present or missing.
#
# Usage:
#   scripts/checks/command-lint.sh              # lint (a)/(d) fatal, (b)/(c) warn
#   scripts/checks/command-lint.sh --strict      # also fail the run on WARN findings
#
# Exit: 0 = clean (or only warnings in non-strict mode); 1 = any FATAL finding,
# or any finding at all in --strict mode.
# -----------------------------------------------------------------------------
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 1

STRICT=0
for arg in "$@"; do
  case "$arg" in
    --strict) STRICT=1 ;;
  esac
done

FATAL_COUNT=0
WARN_COUNT=0

FILES=$(find .claude/commands .claude/agents -type f -name "*.md" 2>/dev/null | sort)

if [ -z "$FILES" ]; then
  echo "command-lint.sh: no .claude/commands or .claude/agents *.md files found — nothing to lint."
  exit 0
fi

report_fatal() { printf '  \033[31m✗ FATAL [%s]\033[0m %s: %s\n' "$1" "$2" "$3"; FATAL_COUNT=$((FATAL_COUNT + 1)); }
report_warn()  { printf '  \033[33m! WARN  [%s]\033[0m %s: %s\n' "$1" "$2" "$3"; WARN_COUNT=$((WARN_COUNT + 1)); }

while IFS= read -r f; do
  [ -f "$f" ] || continue

  # ── (a) FATAL: frontmatter block exists + closes + description quoting ──
  first_line=$(head -1 "$f")
  if [ "$first_line" != "---" ]; then
    report_fatal a "$f" "no YAML frontmatter block (file does not start with '---')"
  else
    closing_line=$(awk 'NR>1 && $0=="---" {print NR; exit}' "$f")
    if [ -z "$closing_line" ]; then
      report_fatal a "$f" "YAML frontmatter never closes (no second '---' line found)"
    else
      desc_line=$(awk -v end="$closing_line" 'NR>1 && NR<end && /^description:[[:space:]]*"/' "$f")
      if [ -n "$desc_line" ]; then
        # Strip the `description: "` prefix and one trailing `"`; if a bare
        # (non-backslash-escaped) `"` remains in what's left, the value has
        # an unescaped quote that would break YAML parsing.
        inner=$(printf '%s' "$desc_line" | sed -E 's/^description:[[:space:]]*"//; s/"[[:space:]]*$//')
        if printf '%s' "$inner" | grep -qE '(^|[^\\])"'; then
          report_fatal a "$f" "description: field has an unescaped \" inside a double-quoted value"
        fi
      fi
    fi
  fi

  # ── (b) WARN: stale-stack tokens (escape hatch: # lint-allow-stale-stack) ──
  while IFS=: read -r lineno line; do
    [ -z "$lineno" ] && continue
    printf '%s' "$line" | grep -q "lint-allow-stale-stack" && continue
    trimmed=$(printf '%s' "$line" | sed -E 's/^[[:space:]]+//' | cut -c1-100)
    report_warn b "$f:$lineno" "stale-stack token — $trimmed"
  done < <(grep -nE '\b(uv run pytest|uvicorn|alembic|VITE_|schemathesis)' "$f" 2>/dev/null || true)

  # ── (c) WARN: legacy tool name `Task` on a tools:/allowed-tools: line ──
  while IFS=: read -r lineno line; do
    [ -z "$lineno" ] && continue
    trimmed=$(printf '%s' "$line" | sed -E 's/^[[:space:]]+//' | cut -c1-100)
    report_warn c "$f:$lineno" "legacy tool name 'Task' (use Agent/TaskCreate/TaskUpdate/TaskStop) — $trimmed"
  done < <(grep -nE '^(tools|allowed-tools):' "$f" 2>/dev/null | grep -E '\bTask\b' || true)

  # ── (d) FATAL: referenced scripts/*.sh paths that don't exist on disk ──
  while IFS= read -r path; do
    [ -z "$path" ] && continue
    [ -f "$ROOT/$path" ] && continue
    report_fatal d "$f" "references missing script: $path"
  done < <(grep -oE 'scripts/[A-Za-z0-9_./-]+\.sh' "$f" 2>/dev/null | sort -u)

done <<< "$FILES"

FILE_COUNT=$(printf '%s\n' "$FILES" | grep -vc '^\s*$')

echo ""
echo "command-lint.sh: ${FATAL_COUNT} fatal, ${WARN_COUNT} warning(s) across ${FILE_COUNT} files."

if [ "$FATAL_COUNT" -gt 0 ]; then
  exit 1
fi
if [ "$STRICT" -eq 1 ] && [ "$WARN_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0
