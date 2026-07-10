#!/bin/bash
# Runs on every user prompt. Detects write-back requests and injects
# the agent's designated doc path as additionalContext.
# stdout → added as additionalContext to Claude's session.
INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty' 2>/dev/null | tr '[:upper:]' '[:lower:]')

# Detect write-back phrases (see docs/techstack/agent-teams.md for full list)
#
# Narrowed (was: generic "(update|write|save|checkpoint).*(doc|memory|context|
# file|log)" — matched on verb+noun co-occurrence ANYWHERE in the prompt, so
# an ordinary request like "update the login file" or "write a file for auth"
# false-positived the banner). Now requires an explicit agent/memory cue:
# a possessive "your <doc-noun>", the literal write-back phrase, the
# /athena:save command, the word "checkpoint", the Chinese write-back cue
# 記錄到, or an @agent mention (@qa, @debugger, ...).
#
# SHOULD trigger:
#   "update your document with the new schema"   -> "your" + doc noun
#   "write back the findings when you're done"    -> write-back phrase
#   "@debugger checkpoint your progress"           -> agent name + checkpoint
# should NOT trigger:
#   "update the login file"                        -> no "your", no cue
#   "write a file for the auth flow"                -> generic write, no cue
#   "save the changes and run tests"                -> generic save, no cue
if echo "$PROMPT" | grep -qE "(update|write|save)[[:space:]]+your[[:space:]]+(doc|document|memory|context|log|file)s?|write.?back|/athena:save|checkpoint|記錄到|@(spec-writer|reviewer|qa|evaluator|best-practice|debugger|deployer|memory-curator|strategist|orchestrator|designer|dba|tony)"; then
  echo "=== WRITE-BACK REQUESTED ==="
  echo "Agent document targets:"
  echo "  @spec-writer     → docs/context/spec-log.md"
  echo "  @qa              → docs/context/review-log.md + docs/context/test-status.md"
  echo "  @best-practice   → docs/context/decisions.md"
  echo "  @debugger        → docs/context/debug-log.md (tag [GENERALIZABLE] if applicable)"
  echo "  @deployer        → docs/context/deploy-log.md"
  echo "  @memory-curator  → ~/.claude/template-memory/"
  echo "If addressed to one agent: write that doc only."
  echo "If general: run /athena:save for all agents."
  exit 0
fi
exit 0
