#!/bin/bash
# E186 — Memory Metrics Dashboard.
#
# Read-only aggregator over the Phase 45 audit-event catalog. Produces a
# single human-readable report covering:
#
#   1. Top-N retrieved lessons   — agent_cited + tier0_loaded + rule_fired
#   2. Strength histogram        — Tier 0 frontmatter `strength` distribution
#   3. Citation map              — per-agent breakdown of cited lessons
#   4. Archive churn             — lesson_archived / lesson_revived ratio +
#                                  average time-to-revive
#   5. Strength activity         — strength_reinforced + strength_decayed counts
#   6. Inject hit-rate           — % of tier0_loaded events from selective-inject
#                                  Block B vs always-on Block A (PRIMER)
#   7. Stale promotions          — count of premature-promotion candidates from
#                                  promotion-follow-through.sh
#
# Wiring:
#   - Reads `.claude/audit.jsonl` (E180 retrieval surface)
#   - Reads `~/.claude/template-memory/*.md` frontmatter (delegated to
#     `scripts/memory/score.sh get` so the parser never drifts)
#   - Shells out to `scripts/memory/promotion-follow-through.sh --json | jq length`
#
# This script is READ-ONLY. It NEVER writes to Tier 0 files, NEVER mutates the
# audit log, and NEVER calls git mutators. Pure aggregation.
#
# Usage:
#   scripts/memory/metrics.sh                                # full report
#   scripts/memory/metrics.sh --since 2026-04-01             # time filter
#   scripts/memory/metrics.sh --epic E180                    # epic filter
#   scripts/memory/metrics.sh --top 5                        # change top-N (default 10)
#   scripts/memory/metrics.sh --json                         # JSON output
#
# Env overrides (test injection):
#   AUDIT_LOG_PATH         override .claude/audit.jsonl
#   TEMPLATE_MEMORY_DIR    override default ~/.claude/template-memory
#   PROMOTION_FT_SH        override path to promotion-follow-through.sh
#   SCORE_SH               override path to score.sh
#   STRENGTH_NOW           override "today" ISO date (testing)

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
AUDIT_LOG="${AUDIT_LOG_PATH:-$REPO_ROOT/.claude/audit.jsonl}"
TIER0_DIR="${TEMPLATE_MEMORY_DIR:-$HOME/.claude/template-memory}"
SCORE_SH="${SCORE_SH:-$REPO_ROOT/scripts/memory/score.sh}"
PROMOTION_FT_SH="${PROMOTION_FT_SH:-$REPO_ROOT/scripts/memory/promotion-follow-through.sh}"

EPIC_FILTER=""
SINCE_FILTER=""
TOP_N=10
OUTPUT_FORMAT="markdown"

EFFORT_MODE=0

usage() {
  cat >&2 <<'EOF'
Usage: metrics.sh [--epic E{n}] [--since YYYY-MM-DD] [--top N] [--json] [--effort]

Aggregates Phase 45 memory audit events into a single read-only report.

  --epic E{n}          Only include events whose .epic equals the given ID
  --since YYYY-MM-DD   Only include events at or after this UTC date
  --top N              Top-N retrieved lessons (default 10)
  --json               Emit machine-readable JSON instead of markdown
  --effort             Add effort metrics section (E199): tier distribution,
                       coverage-drop frequency, and effort-vs-review_loop correlation
  -h, --help           This help
EOF
  exit 2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --epic)   EPIC_FILTER="$2"; shift 2 ;;
    --since)  SINCE_FILTER="$2"; shift 2 ;;
    --top)    TOP_N="$2"; shift 2 ;;
    --json)   OUTPUT_FORMAT="json"; shift ;;
    --effort) EFFORT_MODE=1; shift ;;
    -h|--help) usage ;;
    *) echo "unknown arg: $1" >&2; usage ;;
  esac
done

# Validate --top is a positive integer.
if ! [ "$TOP_N" -eq "$TOP_N" ] 2>/dev/null || [ "$TOP_N" -lt 1 ]; then
  echo "error: --top must be a positive integer (got: $TOP_N)" >&2
  exit 2
fi

today_iso() {
  if [ -n "${STRENGTH_NOW:-}" ]; then
    echo "$STRENGTH_NOW"
  else
    date -u +"%Y-%m-%d"
  fi
}

# ---- guardrails ------------------------------------------------------------

have_jq=1
command -v jq >/dev/null 2>&1 || have_jq=0

# Build the shared filter expression once so every section uses identical
# epic/since gating. Defaulting to true means "no filter".
build_filter() {
  local f='true'
  if [ -n "$EPIC_FILTER" ]; then
    f="$f and (.epic == \"$EPIC_FILTER\")"
  fi
  if [ -n "$SINCE_FILTER" ]; then
    f="$f and (.ts >= \"${SINCE_FILTER}T00:00:00Z\")"
  fi
  echo "$f"
}

FILTER="$(build_filter)"

# ---- section 1: Top-N retrieved lessons -----------------------------------
#
# Group by `lesson` field across `agent_cited` + `tier0_loaded` + `rule_fired`
# events; rank by total hits descending.
top_n_retrieved_json() {
  [ -f "$AUDIT_LOG" ] && [ -s "$AUDIT_LOG" ] || { echo "[]"; return; }
  [ "$have_jq" = "1" ] || { echo "[]"; return; }

  jq -s --argjson top "$TOP_N" "
    map(select(
      (.event == \"agent_cited\" or .event == \"tier0_loaded\" or .event == \"rule_fired\")
      and ($FILTER)
      and (.lesson != null and .lesson != \"\")
    ))
    | group_by(.lesson)
    | map({lesson: .[0].lesson, hits: length})
    | sort_by(-.hits)
    | .[0:\$top]
  " "$AUDIT_LOG" 2>/dev/null || echo "[]"
}

# ---- section 2: Strength histogram ----------------------------------------
#
# Walks every Tier 0 lesson file (excluding meta files + archives), reads the
# strength score via score.sh, buckets into 5 ranges:
#   [0.0, 0.1)   weak     -> /athena:forget candidate
#   [0.1, 0.3)  decay
#   [0.3, 0.6)  active
#   [0.6, 0.9)  strong
#   [0.9, 1.0]  saturated
strength_histogram_json() {
  if [ ! -d "$TIER0_DIR" ]; then
    echo '{"buckets":[],"total":0,"missing":true}'
    return
  fi
  local tmp; tmp=$(mktemp)
  : > "$tmp"

  shopt -s nullglob 2>/dev/null || true
  for path in "$TIER0_DIR"/*.md; do
    [ -f "$path" ] || continue
    local base; base=$(basename "$path")
    case "$base" in
      README.md|CLAUDE.md|NEW_PROJECT_PRIMER.md) continue ;;
      *-archive-*.md|archive-*.md) continue ;;
    esac
    local s
    if [ -x "$SCORE_SH" ]; then
      s=$("$SCORE_SH" get "$path" 2>/dev/null || echo "0.5000")
    else
      s="0.5000"
    fi
    echo "$base $s" >> "$tmp"
  done

  if [ "$have_jq" != "1" ]; then
    rm -f "$tmp"
    echo '{"buckets":[],"total":0}'
    return
  fi

  awk '
    BEGIN { b0=0; b1=0; b2=0; b3=0; b4=0; total=0 }
    {
      s = $2 + 0
      total++
      if (s < 0.1)        b0++
      else if (s < 0.3)   b1++
      else if (s < 0.6)   b2++
      else if (s < 0.9)   b3++
      else                 b4++
    }
    END {
      printf "{\"buckets\":["
      printf "{\"range\":\"[0.0,0.1)\",\"label\":\"weak\",\"count\":%d},", b0
      printf "{\"range\":\"[0.1,0.3)\",\"label\":\"decay\",\"count\":%d},", b1
      printf "{\"range\":\"[0.3,0.6)\",\"label\":\"active\",\"count\":%d},", b2
      printf "{\"range\":\"[0.6,0.9)\",\"label\":\"strong\",\"count\":%d},", b3
      printf "{\"range\":\"[0.9,1.0]\",\"label\":\"saturated\",\"count\":%d}", b4
      printf "],\"total\":%d}", total
    }
  ' "$tmp"
  rm -f "$tmp"
}

# ---- section 3: Citation map (per-agent) ----------------------------------
#
# Per-agent breakdown of which lessons each agent has cited. Built from
# `agent_cited.agent` × `agent_cited.lesson` cross product.
citation_map_json() {
  [ -f "$AUDIT_LOG" ] && [ -s "$AUDIT_LOG" ] || { echo "[]"; return; }
  [ "$have_jq" = "1" ] || { echo "[]"; return; }

  jq -s "
    map(select(
      .event == \"agent_cited\"
      and ($FILTER)
      and (.agent != null and .agent != \"\")
      and (.lesson != null and .lesson != \"\")
    ))
    | group_by(.agent)
    | map({
        agent: .[0].agent,
        total_citations: length,
        lessons: (
          group_by(.lesson)
          | map({lesson: .[0].lesson, count: length})
          | sort_by(-.count)
        )
      })
    | sort_by(-.total_citations)
  " "$AUDIT_LOG" 2>/dev/null || echo "[]"
}

# ---- section 4: Archive churn --------------------------------------------
#
# count(lesson_archived) / count(lesson_revived) ratio + average time-to-revive
# (in days) when revives exist.
archive_churn_json() {
  [ -f "$AUDIT_LOG" ] && [ -s "$AUDIT_LOG" ] || {
    echo '{"archived":0,"revived":0,"avg_revive_days":null}'
    return
  }
  [ "$have_jq" = "1" ] || {
    echo '{"archived":0,"revived":0,"avg_revive_days":null}'
    return
  }

  jq -s "
    . as \$all
    | (\$all | map(select(.event == \"lesson_archived\" and ($FILTER)))) as \$arch
    | (\$all | map(select(.event == \"lesson_revived\"  and ($FILTER)))) as \$rev
    | {
        archived: (\$arch | length),
        revived:  (\$rev  | length),
        avg_revive_days: (
          if (\$rev | length) == 0 then null
          else
            \$rev
            | map(. as \$r
                  | (\$arch
                      | map(select(.lesson == \$r.lesson and .ts <= \$r.ts))
                      | sort_by(.ts) | last) as \$a
                  | if \$a == null then null
                    else
                      ((\$r.ts[0:10] | strptime(\"%Y-%m-%d\") | mktime)
                       - (\$a.ts[0:10] | strptime(\"%Y-%m-%d\") | mktime))
                      / 86400
                    end
                  )
            | map(select(. != null))
            | if length == 0 then null else (add / length) end
          end
        )
      }
  " "$AUDIT_LOG" 2>/dev/null || echo '{"archived":0,"revived":0,"avg_revive_days":null}'
}

# ---- section 5: Strength activity ----------------------------------------
#
# Counts of strength_reinforced + strength_decayed events.
strength_activity_json() {
  [ -f "$AUDIT_LOG" ] && [ -s "$AUDIT_LOG" ] || {
    echo '{"reinforced":0,"decayed":0,"by_signal":[]}'
    return
  }
  [ "$have_jq" = "1" ] || {
    echo '{"reinforced":0,"decayed":0,"by_signal":[]}'
    return
  }

  jq -s "
    . as \$all
    | (\$all | map(select(.event == \"strength_reinforced\" and ($FILTER)))) as \$r
    | (\$all | map(select(.event == \"strength_decayed\"   and ($FILTER)))) as \$d
    | {
        reinforced: (\$r | length),
        decayed:    (\$d | length),
        by_signal:  (
          \$r
          | map(.signal // \"unknown\")
          | group_by(.)
          | map({signal: .[0], count: length})
          | sort_by(-.count)
        )
      }
  " "$AUDIT_LOG" 2>/dev/null || echo '{"reinforced":0,"decayed":0,"by_signal":[]}'
}

# ---- section 6: Inject hit-rate (Block A vs Block B) ---------------------
#
# Per E182, SessionStart injects in two blocks:
#   - Block A — always-on PRIMER (lesson == "NEW_PROJECT_PRIMER.md")
#   - Block B — selective-inject cued category excerpts (any other lesson)
#
# Hit-rate = % of tier0_loaded events that came from Block B.
inject_hit_rate_json() {
  [ -f "$AUDIT_LOG" ] && [ -s "$AUDIT_LOG" ] || {
    echo '{"block_a":0,"block_b":0,"hit_rate_pct":null}'
    return
  }
  [ "$have_jq" = "1" ] || {
    echo '{"block_a":0,"block_b":0,"hit_rate_pct":null}'
    return
  }

  jq -s "
    map(select(.event == \"tier0_loaded\" and ($FILTER)))
    | . as \$all
    | (\$all | map(select(.lesson == \"NEW_PROJECT_PRIMER.md\")) | length) as \$a
    | (\$all | map(select(.lesson != \"NEW_PROJECT_PRIMER.md\")) | length) as \$b
    | {
        block_a: \$a,
        block_b: \$b,
        hit_rate_pct: (
          if (\$a + \$b) == 0 then null
          else ((\$b * 100.0) / (\$a + \$b)) end
        )
      }
  " "$AUDIT_LOG" 2>/dev/null || echo '{"block_a":0,"block_b":0,"hit_rate_pct":null}'
}

# ---- section 8: Arc Liveness (E197) --------------------------------------
#
# For each of the 4 arc event types, counts occurrences in the past 30 days.
# If count == 0: flag as STALE, else OK.
#
# Arc event types:
#   agent_cited       — lesson was cited by an agent (reinforce arc)
#   rule_fired        — stop-verifier rule fired (retrieve arc)
#   strength_decayed  — lesson was decayed (decay arc)
#   lesson_archived   — lesson was archived (forget arc)
arc_liveness_json() {
  [ -f "$AUDIT_LOG" ] && [ -s "$AUDIT_LOG" ] || {
    echo '{"arcs":[]}'
    return
  }
  [ "$have_jq" = "1" ] || { echo '{"arcs":[]}'; return; }

  local today_str; today_str=$(today_iso)
  # 30-day lookback window (ISO date string comparison — lexicographic sort works)
  local since_str
  since_str=$(python3 -c "
import datetime
d = datetime.date.today() - datetime.timedelta(days=30)
print(d.strftime('%Y-%m-%d'))
" 2>/dev/null || \
    awk -v today="$today_str" 'BEGIN {
      # Fallback: subtract 30 from day part only (good enough for testing)
      split(today, a, "-")
      y = a[1]; m = a[2]; d = a[3] - 30
      if (d < 1) { d = d + 30; m = m - 1; if (m < 1) { m = 12; y = y - 1 } }
      printf "%04d-%02d-%02d\n", y, m, d
    }')

  jq -n \
    --argjson audit "$(jq -s '.' "$AUDIT_LOG" 2>/dev/null || echo '[]')" \
    --arg since "${since_str}T00:00:00Z" \
    --arg arc0 "agent_cited" \
    --arg arc1 "rule_fired" \
    --arg arc2 "strength_decayed" \
    --arg arc3 "lesson_archived" \
    '{
      arcs: [
        {arc: $arc0, count: ($audit | map(select(.event == $arc0 and .ts >= $since)) | length)},
        {arc: $arc1, count: ($audit | map(select(.event == $arc1 and .ts >= $since)) | length)},
        {arc: $arc2, count: ($audit | map(select(.event == $arc2 and .ts >= $since)) | length)},
        {arc: $arc3, count: ($audit | map(select(.event == $arc3 and .ts >= $since)) | length)}
      ]
      | map(. + {status: (if .count == 0 then "STALE" else "OK" end)})
    }' 2>/dev/null || echo '{"arcs":[]}'
}

# ---- section 7: Stale-promotion count ------------------------------------
#
# Delegates entirely to promotion-follow-through.sh (E183) for the candidate
# list. Pure passthrough — we just count.
stale_promotions_count() {
  if [ ! -x "$PROMOTION_FT_SH" ]; then
    echo "0"
    return
  fi
  if [ "$have_jq" != "1" ]; then
    echo "0"
    return
  fi
  local out
  out=$(TEMPLATE_MEMORY_DIR="$TIER0_DIR" \
        AUDIT_LOG_PATH="$AUDIT_LOG" \
        "$PROMOTION_FT_SH" --json 2>/dev/null || echo "[]")
  echo "$out" | jq 'length' 2>/dev/null || echo "0"
}

# ---- section E199: Effort Metrics ------------------------------------------
#
# Three sub-sections sourced from .claude/audit.jsonl:
#   a. Effort tier distribution   — count effort_resolved events by tier
#   b. Coverage-drop frequency    — count coverage_dropped events grouped by .tier, last 30 days
#   c. Effort vs review_loop verdict correlation — join effort_resolved + review_loop
#      events by epic, show CONVERGED/STUCK/MAX_REACHED breakdown per effort tier
effort_metrics_json() {
  [ -f "$AUDIT_LOG" ] && [ -s "$AUDIT_LOG" ] || {
    echo '{"tier_distribution":[],"coverage_drop_freq":[],"effort_verdict_correlation":[]}'
    return
  }
  [ "$have_jq" = "1" ] || {
    echo '{"tier_distribution":[],"coverage_drop_freq":[],"effort_verdict_correlation":[]}'
    return
  }

  # Compute 30-day lookback ISO string for coverage-drop frequency
  local since_30d
  since_30d=$(python3 -c "
import datetime
d = datetime.date.today() - datetime.timedelta(days=30)
print(d.strftime('%Y-%m-%d') + 'T00:00:00Z')
" 2>/dev/null || date -u -v-30d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "1970-01-01T00:00:00Z")

  jq -s \
    --arg filter "$FILTER" \
    --arg since30d "$since_30d" \
    '. as $all
    # ---- a. Effort tier distribution ----
    | ($all
       | map(select(.event == "effort_resolved"))
       | group_by(.tier // "unknown")
       | map({tier: (.[0].tier // "unknown"), count: length})
       | sort_by(-.count)
      ) as $tier_dist
    # ---- b. Coverage-drop frequency (last 30 days, grouped by .tier) ----
    | ($all
       | map(select(.event == "coverage_dropped" and .ts >= $since30d))
       | group_by(.tier // "unknown")
       | map({tier: (.[0].tier // "unknown"), drops: length})
       | sort_by(-.drops)
      ) as $drop_freq
    # ---- c. Effort-vs-review_loop verdict correlation ----
    # For each epic that has both effort_resolved and review_loop events,
    # pair the most recent effort_resolved tier with the review_loop verdict.
    | ($all | map(select(.event == "effort_resolved" and .epic != null and .epic != "none"))) as $efforts
    | ($all | map(select(.event == "review_loop"     and .epic != null and .epic != "none"))) as $reviews
    | ($efforts
       | group_by(.epic)
       | map(
           (.[0].epic) as $ep
           | (. | sort_by(.ts) | last | .tier // "unknown") as $eff_tier
           | ($reviews | map(select(.epic == $ep)) | .[0].verdict // null) as $verdict
           | if $verdict != null
             then {epic: $ep, effort_tier: $eff_tier, verdict: $verdict}
             else empty
             end
         )
       | group_by(.effort_tier)
       | map({
           effort_tier: .[0].effort_tier,
           CONVERGED:  (map(select(.verdict == "CONVERGED"))  | length),
           STUCK:      (map(select(.verdict == "STUCK"))      | length),
           MAX_REACHED:(map(select(.verdict == "MAX_REACHED"))| length),
           total:      length
         })
       | sort_by(-.total)
      ) as $correlation
    # ---- d. Effort Cost Proxy (E207) ----
    # Only process enriched (post-E207) events that have model_map + max_concurrent.
    # Cost weights: haiku=1, sonnet=5, opus=25
    # Formula: cost_proxy_per_run = (reviewer_weight + evaluator_weight) × max_concurrent
    # Pre-E207 events (missing model_map) are excluded from cost-proxy sum.
    | ($all
       | map(select(
           .event == "effort_resolved"
           and .model_map != null and .model_map != "unknown"
           and .max_concurrent != null
         ))
       | map(
           # Parse reviewer model from model_map field (e.g. "reviewer=sonnet,evaluator=opus")
           (.model_map // "reviewer=unknown,evaluator=unknown") as $mm
           | ($mm | split(",") | map(select(startswith("reviewer="))) | .[0] // "reviewer=unknown" | split("=") | .[1] // "unknown") as $reviewer_model
           | ($mm | split(",") | map(select(startswith("evaluator="))) | .[0] // "evaluator=unknown" | split("=") | .[1] // "unknown") as $evaluator_model
           | (if $reviewer_model == "haiku"  then 1
              elif $reviewer_model == "sonnet" then 5
              elif $reviewer_model == "opus"   then 25
              else 0 end) as $reviewer_weight
           | (if $evaluator_model == "haiku"  then 1
              elif $evaluator_model == "sonnet" then 5
              elif $evaluator_model == "opus"   then 25
              else 0 end) as $evaluator_weight
           | (.max_concurrent // 1) as $conc
           | {
               tier: (.tier // "unknown"),
               model_map: $mm,
               max_concurrent: $conc,
               reviewer_model: $reviewer_model,
               evaluator_model: $evaluator_model,
               cost_proxy_per_run: (($reviewer_weight + $evaluator_weight) * $conc)
             }
         )
       | group_by(.tier)
       | map({
           tier: .[0].tier,
           invocations: length,
           model_map: .[0].model_map,
           max_concurrent: .[0].max_concurrent,
           cost_proxy_per_run: .[0].cost_proxy_per_run,
           total_cost_proxy: (map(.cost_proxy_per_run) | add // 0)
         })
       | sort_by(-.cost_proxy_per_run)
      ) as $cost_proxy
    | {
        tier_distribution: $tier_dist,
        coverage_drop_freq: $drop_freq,
        effort_verdict_correlation: $correlation,
        effort_cost_proxy: $cost_proxy
      }
    ' "$AUDIT_LOG" 2>/dev/null || \
    echo '{"tier_distribution":[],"coverage_drop_freq":[],"effort_verdict_correlation":[],"effort_cost_proxy":[]}'
}

# ---- aggregation -----------------------------------------------------------

TOP_RETRIEVED_JSON=$(top_n_retrieved_json)
HISTOGRAM_JSON=$(strength_histogram_json)
CITATION_JSON=$(citation_map_json)
CHURN_JSON=$(archive_churn_json)
STRENGTH_ACTIVITY_JSON=$(strength_activity_json)
INJECT_RATE_JSON=$(inject_hit_rate_json)
STALE_COUNT=$(stale_promotions_count)
ARC_LIVENESS_JSON=$(arc_liveness_json)
if [ "$EFFORT_MODE" = "1" ]; then
  EFFORT_JSON=$(effort_metrics_json)
fi

# ---- emit: JSON branch ----------------------------------------------------

if [ "$OUTPUT_FORMAT" = "json" ]; then
  if [ "$have_jq" = "1" ]; then
    EFFORT_JSON_ARG="${EFFORT_JSON:-null}"
    jq -n \
      --arg generated_at "$(today_iso)" \
      --arg epic "${EPIC_FILTER:-all}" \
      --arg since "${SINCE_FILTER:-all-time}" \
      --argjson top_n "$TOP_N" \
      --argjson top_retrieved "$TOP_RETRIEVED_JSON" \
      --argjson strength_histogram "$HISTOGRAM_JSON" \
      --argjson citation_map "$CITATION_JSON" \
      --argjson archive_churn "$CHURN_JSON" \
      --argjson strength_activity "$STRENGTH_ACTIVITY_JSON" \
      --argjson inject_hit_rate "$INJECT_RATE_JSON" \
      --argjson stale_promotions "$STALE_COUNT" \
      --argjson arc_liveness "$ARC_LIVENESS_JSON" \
      --argjson effort_metrics "$EFFORT_JSON_ARG" \
      '{
        generated_at: $generated_at,
        filters: {epic: $epic, since: $since, top: $top_n},
        top_retrieved: $top_retrieved,
        strength_histogram: $strength_histogram,
        citation_map: $citation_map,
        archive_churn: $archive_churn,
        strength_activity: $strength_activity,
        inject_hit_rate: $inject_hit_rate,
        stale_promotions_count: $stale_promotions,
        arc_liveness: $arc_liveness,
        effort_metrics: $effort_metrics
      }'
    # Note: effort_metrics now includes effort_cost_proxy (E207) in addition
    # to tier_distribution, coverage_drop_freq, and effort_verdict_correlation (E199).
  else
    echo '{"error":"jq required for --json output"}'
    exit 1
  fi
  exit 0
fi

# ---- emit: markdown branch ------------------------------------------------

echo "# Memory Metrics — $(today_iso)"
echo ""
echo "Source: $AUDIT_LOG"
echo "Filters: epic=${EPIC_FILTER:-all}, since=${SINCE_FILTER:-all-time}, top=${TOP_N}"
echo ""

# Empty-state shortcut.
if [ ! -f "$AUDIT_LOG" ] || [ ! -s "$AUDIT_LOG" ]; then
  echo "_No memory metrics recorded yet — \`.claude/audit.jsonl\` is missing or empty._"
  exit 0
fi

# --- 1: Top-N retrieved ---
echo "## Top ${TOP_N} Retrieved Lessons"
echo ""
if [ "$have_jq" = "1" ]; then
  count=$(echo "$TOP_RETRIEVED_JSON" | jq 'length')
else
  count=0
fi
if [ "$count" = "0" ]; then
  echo "_No retrieval events match the given filters._"
else
  echo "| Rank | Lesson | Hits |"
  echo "|------|--------|------|"
  echo "$TOP_RETRIEVED_JSON" \
    | jq -r 'to_entries | .[] | "| \(.key + 1) | \(.value.lesson) | \(.value.hits) |"'
fi
echo ""

# --- 2: Strength histogram ---
echo "## Strength Histogram (Tier 0 lessons)"
echo ""
if [ "$have_jq" = "1" ]; then
  total=$(echo "$HISTOGRAM_JSON" | jq '.total')
else
  total=0
fi
if [ "$total" = "0" ]; then
  echo "_No Tier 0 lessons found in $TIER0_DIR — nothing to bucket._"
else
  echo "| Range | Label | Count | Bar |"
  echo "|-------|-------|-------|-----|"
  echo "$HISTOGRAM_JSON" \
    | jq -r '.buckets[] | "\(.range)\t\(.label)\t\(.count)"' \
    | while IFS=$'\t' read -r range label cnt; do
        bar=""
        i=0
        while [ "$i" -lt "$cnt" ] && [ "$i" -lt 30 ]; do
          bar="${bar}#"
          i=$((i + 1))
        done
        printf "| %s | %s | %d | %s |\n" "$range" "$label" "$cnt" "$bar"
      done
fi
echo ""

# --- 3: Citation map ---
echo "## Citation Map (per agent)"
echo ""
if [ "$have_jq" = "1" ]; then
  agents=$(echo "$CITATION_JSON" | jq 'length')
else
  agents=0
fi
if [ "$agents" = "0" ]; then
  echo "_No \`agent_cited\` events match the given filters._"
else
  echo "$CITATION_JSON" | jq -r '.[] |
    "### @\(.agent) — \(.total_citations) total citations\n",
    "| Lesson | Count |",
    "|--------|-------|",
    (.lessons[] | "| \(.lesson) | \(.count) |"),
    ""'
fi
echo ""

# --- 4: Archive churn ---
echo "## Archive Churn"
echo ""
if [ "$have_jq" = "1" ]; then
  arch=$(echo "$CHURN_JSON" | jq '.archived')
  rev=$(echo "$CHURN_JSON" | jq '.revived')
  avg=$(echo "$CHURN_JSON" | jq -r '.avg_revive_days')
else
  arch=0; rev=0; avg=null
fi
echo "- Archived: ${arch}"
echo "- Revived: ${rev}"
if [ "$rev" = "0" ] || [ "$rev" = "null" ]; then
  echo "- Ratio (archive/revive): N/A (no revives)"
  echo "- Avg time-to-revive: N/A"
else
  ratio=$(awk -v a="$arch" -v r="$rev" 'BEGIN { if (r > 0) printf "%.2f", a / r; else print "N/A" }')
  echo "- Ratio (archive/revive): ${ratio}"
  if [ "$avg" = "null" ]; then
    echo "- Avg time-to-revive: N/A (no matched archive→revive pairs)"
  else
    avg_fmt=$(awk -v v="$avg" 'BEGIN { printf "%.1f days", v }')
    echo "- Avg time-to-revive: ${avg_fmt}"
  fi
fi
echo ""

# --- 5: Strength activity ---
echo "## Strength Activity"
echo ""
if [ "$have_jq" = "1" ]; then
  reinforced=$(echo "$STRENGTH_ACTIVITY_JSON" | jq '.reinforced')
  decayed=$(echo "$STRENGTH_ACTIVITY_JSON" | jq '.decayed')
else
  reinforced=0; decayed=0
fi
echo "- Reinforced: ${reinforced}"
echo "- Decayed: ${decayed}"
if [ "$have_jq" = "1" ] && [ "$reinforced" != "0" ]; then
  echo ""
  echo "### Reinforce signal breakdown"
  echo ""
  echo "| Signal | Count |"
  echo "|--------|-------|"
  echo "$STRENGTH_ACTIVITY_JSON" | jq -r '.by_signal[] | "| \(.signal) | \(.count) |"'
fi
echo ""

# --- 6: Inject hit-rate ---
echo "## SessionStart Inject Hit-Rate (E182)"
echo ""
if [ "$have_jq" = "1" ]; then
  block_a=$(echo "$INJECT_RATE_JSON" | jq '.block_a')
  block_b=$(echo "$INJECT_RATE_JSON" | jq '.block_b')
  rate=$(echo "$INJECT_RATE_JSON" | jq -r '.hit_rate_pct')
else
  block_a=0; block_b=0; rate=null
fi
echo "- Block A (always-on PRIMER): ${block_a}"
echo "- Block B (selective-inject):  ${block_b}"
if [ "$rate" = "null" ]; then
  echo "- Hit-rate (Block B / total): N/A (no \`tier0_loaded\` events)"
else
  rate_fmt=$(awk -v v="$rate" 'BEGIN { printf "%.1f%%", v }')
  echo "- Hit-rate (Block B / total): ${rate_fmt}"
fi
echo ""

# --- 7: Stale promotions ---
echo "## Premature-Promotion Candidates"
echo ""
echo "- Count: ${STALE_COUNT}"
echo ""
echo "_Run \`scripts/memory/promotion-follow-through.sh\` for the full list._"
echo ""

# --- 8: Arc Liveness (E197) ---
echo "## Arc Liveness (30-day window)"
echo ""
echo "| Arc | Event | Count (30d) | Status |"
echo "|-----|-------|-------------|--------|"
if [ "$have_jq" = "1" ]; then
  arc_rows=$(echo "$ARC_LIVENESS_JSON" | jq -r '
    .arcs[]? |
    [
      (if .arc == "agent_cited" then "Reinforce"
       elif .arc == "rule_fired" then "Retrieve"
       elif .arc == "strength_decayed" then "Decay"
       elif .arc == "lesson_archived" then "Forget"
       else .arc end),
      .arc, (.count | tostring), .status
    ] | "| \(.[0]) | \(.[1]) | \(.[2]) | \(.[3]) |"
  ' 2>/dev/null)
  if [ -n "$arc_rows" ]; then
    echo "$arc_rows"
  else
    echo "_No arc data available._"
  fi
else
  echo "_jq not available — arc liveness requires jq._"
fi
echo ""
echo "_STALE = zero events in the past 30 days. OK = at least one event._"

# --- E199: Effort Metrics (only when --effort flag is set) ---
if [ "$EFFORT_MODE" = "1" ]; then
  echo ""
  echo "## Section: Effort Metrics (E199)"
  echo ""

  # a. Effort tier distribution
  echo "### a. Effort Tier Distribution"
  echo ""
  if [ "$have_jq" = "1" ]; then
    dist_count=$(echo "$EFFORT_JSON" | jq '.tier_distribution | length' 2>/dev/null || echo "0")
  else
    dist_count=0
  fi
  if [ "$dist_count" = "0" ]; then
    echo "_No \`effort_resolved\` events in audit log._"
  else
    echo "| Effort Tier | Events |"
    echo "|-------------|--------|"
    echo "$EFFORT_JSON" | jq -r '.tier_distribution[] | "| \(.tier) | \(.count) |"' 2>/dev/null \
      || echo "_jq error reading tier distribution._"
  fi
  echo ""

  # b. Coverage-drop frequency (last 30 days)
  echo "### b. Coverage-Drop Frequency (last 30 days)"
  echo ""
  if [ "$have_jq" = "1" ]; then
    drop_count=$(echo "$EFFORT_JSON" | jq '.coverage_drop_freq | length' 2>/dev/null || echo "0")
  else
    drop_count=0
  fi
  if [ "$drop_count" = "0" ]; then
    echo "_No \`coverage_dropped\` events in the last 30 days._"
  else
    echo "| Tier | Drops (30d) |"
    echo "|------|-------------|"
    echo "$EFFORT_JSON" | jq -r '.coverage_drop_freq[] | "| \(.tier) | \(.drops) |"' 2>/dev/null \
      || echo "_jq error reading coverage-drop frequency._"
  fi
  echo ""

  # c. Effort vs review_loop verdict correlation
  echo "### c. Effort vs review_loop Verdict Correlation"
  echo ""
  if [ "$have_jq" = "1" ]; then
    corr_count=$(echo "$EFFORT_JSON" | jq '.effort_verdict_correlation | length' 2>/dev/null || echo "0")
  else
    corr_count=0
  fi
  if [ "$corr_count" = "0" ]; then
    echo "_No paired \`effort_resolved\` + \`review_loop\` events found._"
    echo "_Correlation requires at least one epic with both event types._"
  else
    echo "| Effort Tier | CONVERGED | STUCK | MAX_REACHED | Total |"
    echo "|-------------|-----------|-------|-------------|-------|"
    echo "$EFFORT_JSON" | jq -r '
      .effort_verdict_correlation[] |
      "| \(.effort_tier) | \(.CONVERGED) | \(.STUCK) | \(.MAX_REACHED) | \(.total) |"
    ' 2>/dev/null || echo "_jq error reading effort-verdict correlation._"
  fi
  echo ""

  # d. Effort Cost Proxy (E207)
  echo "### d. Effort Cost Proxy (E207)"
  echo ""
  echo "_Relative weights: haiku=1 / sonnet=5 / opus=25. Formula: (reviewer\_weight + evaluator\_weight) × max\_concurrent._"
  echo "_These are relative proxies — not dollar amounts. Use for \"ultra is ~Nx the per-run cost of standard\" comparisons._"
  echo ""
  if [ "$have_jq" = "1" ]; then
    proxy_count=$(echo "$EFFORT_JSON" | jq '.effort_cost_proxy | length' 2>/dev/null || echo "0")
  else
    proxy_count=0
  fi
  if [ "$proxy_count" = "0" ]; then
    echo "_No enriched \`effort_resolved\` events found (post-E207 events include model\_map + max\_concurrent)._"
    echo "_Pre-E207 events are counted in tier distribution but excluded from cost-proxy computation._"
  else
    echo "| Tier | Invocations | Model Map | Max Concurrent | Cost Proxy/Run | Total Cost Proxy |"
    echo "|------|-------------|-----------|----------------|----------------|------------------|"
    echo "$EFFORT_JSON" | jq -r '
      .effort_cost_proxy[] |
      "| \(.tier) | \(.invocations) | \(.model_map) | \(.max_concurrent) | \(.cost_proxy_per_run) | \(.total_cost_proxy) |"
    ' 2>/dev/null || echo "_jq error reading effort cost proxy._"
  fi
  echo ""
fi

exit 0
