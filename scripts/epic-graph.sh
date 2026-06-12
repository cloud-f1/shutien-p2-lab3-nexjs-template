#!/usr/bin/env bash
# E84 — Epic Dependency Graph & Tier Classifier
# Parses epic-progress.md dependency rules into a DAG, computes execution
# waves (topological sort), and classifies epics into Tier A/B/C.
#
# Compatible with bash 3.2+ (macOS default). Uses awk for associative arrays.
#
# Usage:
#   ./scripts/epic-graph.sh                          # text output, all epics
#   ./scripts/epic-graph.sh --phase 25               # only Phase 25
#   ./scripts/epic-graph.sh --phase 25 --pending-only # exclude completed
#   ./scripts/epic-graph.sh --json                   # machine-readable
#   ./scripts/epic-graph.sh --classify               # with tier labels
#   ./scripts/epic-graph.sh --status                 # counts per phase

set -euo pipefail

# ---------- Resolve paths ----------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROGRESS_FILE="$PROJECT_ROOT/docs/context/epic-progress.md"
EPICS_DIR="$PROJECT_ROOT/docs/epics"

# ---------- Defaults ----------
OUTPUT_FORMAT="text"
PHASE_FILTER=""
PENDING_ONLY="false"
CLASSIFY="false"
STATUS_MODE="false"

# ---------- Parse CLI args ----------
while [ $# -gt 0 ]; do
  case "$1" in
    --json)         OUTPUT_FORMAT="json"; shift ;;
    --text)         OUTPUT_FORMAT="text"; shift ;;
    --phase)        PHASE_FILTER="$2"; shift 2 ;;
    --pending-only) PENDING_ONLY="true"; shift ;;
    --classify)     CLASSIFY="true"; shift ;;
    --status)       STATUS_MODE="true"; shift ;;
    -h|--help)
      echo "Usage: $0 [--json|--text] [--phase N] [--pending-only] [--classify] [--status]"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [ ! -f "$PROGRESS_FILE" ]; then
  echo "Error: $PROGRESS_FILE not found" >&2
  exit 1
fi

# ================================================================
# Count files in "Files to Touch" section of a spec file
# Returns the count via stdout
# ================================================================
count_files_to_touch() {
  local spec_file="$1"
  awk '
    /^## .*Files to Touch/ { in_section=1; next }
    in_section && /^## / { exit }
    !in_section { next }
    /^```/ { in_code = !in_code; next }
    !in_code { next }
    /^[[:space:]]*$/ { next }
    { count++ }
    END { print count+0 }
  ' "$spec_file"
}

# ================================================================
# Main logic in awk — handles all parsing, graph ops, and output
# ================================================================

# Build classify data: for each epic, find its spec and count files
CLASSIFY_FILE=$(mktemp /tmp/epic-classify.XXXXXX)
trap "rm -f '$CLASSIFY_FILE'" EXIT
if [ "$CLASSIFY" = "true" ]; then
  for spec_file in "$EPICS_DIR"/e[0-9]*-*.md; do
    [ -f "$spec_file" ] || continue
    basename_file=$(basename "$spec_file")
    epic_num=$(echo "$basename_file" | sed 's/^e\([0-9]*\)-.*/\1/')
    file_count=$(count_files_to_touch "$spec_file")
    echo "E${epic_num}=${file_count}" >> "$CLASSIFY_FILE"
  done
fi

awk -v phase_filter="$PHASE_FILTER" \
    -v pending_only="$PENDING_ONLY" \
    -v classify="$CLASSIFY" \
    -v output_format="$OUTPUT_FORMAT" \
    -v status_mode="$STATUS_MODE" \
    -v classify_file="$CLASSIFY_FILE" \
'
# ---- Utility: sort epic IDs numerically ----
function epic_num(e) {
  sub(/^E/, "", e)
  return e + 0
}

function swap(arr, i, j,   tmp) {
  tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp
}

function sort_epics(arr, n,   i, j, min_idx, min_val) {
  # Selection sort by numeric value
  for (i = 1; i <= n; i++) {
    min_idx = i
    min_val = epic_num(arr[i])
    for (j = i + 1; j <= n; j++) {
      if (epic_num(arr[j]) < min_val) {
        min_idx = j
        min_val = epic_num(arr[j])
      }
    }
    if (min_idx != i) swap(arr, i, min_idx)
  }
}

BEGIN {
  section = ""
  dep_code = 0
  epic_count = 0
  phase_count = 0

  # Parse classify data from temp file
  if (classify == "true" && classify_file != "") {
    while ((getline line < classify_file) > 0) {
      if (line == "") continue
      split(line, kv, "=")
      file_counts[kv[1]] = kv[2] + 0
      has_spec[kv[1]] = 1
    }
    close(classify_file)
  }
}

# ---- Section detection (single state machine) ----
/^## Phase Status/      { section = "phase"; next }
/^## Epic Step Matrix/  { section = "matrix"; next }
/^## Dependency Rules/  { section = "deps"; next }
/^## / && section != "" { section = ""; next }

# ---- Parse Phase Status table ----
section == "phase" && /^\|[[:space:]]*(Phase [0-9]+|Infra)[[:space:]]*\|/ {
  n = split($0, cols, "|")
  phase_name = cols[2]
  gsub(/^[[:space:]]+|[[:space:]]+$/, "", phase_name)

  epics_cell = cols[3]
  gsub(/^[[:space:]]+|[[:space:]]+$/, "", epics_cell)

  if (match(phase_name, /Phase [0-9]+/)) {
    pnum = phase_name
    gsub(/Phase[[:space:]]*/, "", pnum)
    gsub(/[[:space:]]/, "", pnum)
  } else {
    pnum = "Infra"
  }

  phase_count++
  phase_order[phase_count] = pnum

  gsub(/[[:space:]]/, "", epics_cell)
  n_ep = split(epics_cell, ep_arr, ",")
  phase_epic_list[pnum] = epics_cell
  for (i = 1; i <= n_ep; i++) {
    phase_of[ep_arr[i]] = pnum
  }
}

# ---- Parse Epic Step Matrix ----
section == "matrix" && /^\|[[:space:]]*E[0-9]+[[:space:]]*\|/ {
  n = split($0, cols, "|")
  epic_id = cols[2]
  gsub(/^[[:space:]]+|[[:space:]]+$/, "", epic_id)

  has_pending = 0
  for (i = 3; i <= 7 && i <= n; i++) {
    col = cols[i]
    if (index(col, "⬜") > 0 || index(col, "🔄") > 0 || index(col, "❌") > 0) {
      has_pending = 1
      break
    }
  }
  completed[epic_id] = (has_pending == 0) ? "true" : "false"
}

# ---- Parse Dependency Rules ----
section == "deps" && /^```/ {
  dep_code = !dep_code
  next
}

section == "deps" && dep_code && /^#/ { next }
section == "deps" && dep_code && /^[[:space:]]*$/ { next }

section == "deps" && dep_code && /^E[0-9]+:/ {
  colon_pos = index($0, ":")
  epic = substr($0, 1, colon_pos - 1)
  gsub(/[[:space:]]/, "", epic)
  deps_str = substr($0, colon_pos + 1)
  gsub(/^[[:space:]]+|[[:space:]]+$/, "", deps_str)

  epic_count++
  all_epics[epic_count] = epic
  epic_exists[epic] = 1

  if (deps_str == "no deps") {
    dep_list[epic] = ""
  } else {
    gsub(/[[:space:]]*,[[:space:]]*/, ",", deps_str)
    dep_list[epic] = deps_str
  }
}

# ================================================================
END {
  # ---- Cycle detection (DFS) ----
  # visit_state: 0=unvisited, 1=in-progress, 2=done
  cycle_found = 0
  for (i = 1; i <= epic_count; i++) {
    e = all_epics[i]
    if (visit_state[e] == 0) {
      if (dfs_check(e) == 1) {
        cycle_found = 1
        break
      }
    }
  }
  if (cycle_found) {
    print "Error: Cycle detected in dependency graph" > "/dev/stderr"
    exit 1
  }

  # ---- Tier classification ----
  if (classify == "true") {
    for (i = 1; i <= epic_count; i++) {
      e = all_epics[i]
      if (has_spec[e] != 1) {
        tier[e] = "C"
      } else {
        fc = file_counts[e]
        if (fc < 3) tier[e] = "A"
        else if (fc <= 10) tier[e] = "B"
        else tier[e] = "C"
      }
    }
  }

  # ---- Status mode ----
  if (status_mode == "true") {
    if (output_format == "json") {
      print_status_json()
    } else {
      print_status_text()
    }
    exit 0
  }

  # ---- Compute waves ----
  compute_waves()

  # ---- Output ----
  if (output_format == "json") {
    print_json()
  } else {
    print_text()
  }
}

function dfs_check(node,   dep_str, n, deps, i, d, result) {
  visit_state[node] = 1
  dep_str = dep_list[node]
  if (dep_str != "") {
    n = split(dep_str, deps, ",")
    for (i = 1; i <= n; i++) {
      d = deps[i]
      gsub(/[[:space:]]/, "", d)
      if (d == "") continue
      if (visit_state[d] == 1) return 1  # cycle
      if (visit_state[d] == 0) {
        if (dfs_check(d) == 1) return 1
      }
    }
  }
  visit_state[node] = 2
  return 0
}

function compute_waves(   i, e, in_set, in_degree, adj, dep_str, n, deps, d, \
                          wave_count, current, curr_count, next_arr, next_count, \
                          processed, total, j, neighbors, nn, narr, sorted, sc) {
  # Determine which epics to include
  total = 0
  for (i = 1; i <= epic_count; i++) {
    e = all_epics[i]
    if (phase_filter != "" && phase_of[e] != phase_filter) continue
    if (pending_only == "true" && completed[e] == "true") continue
    total++
    in_set[e] = 1
    in_degree[e] = 0
  }

  if (total == 0) {
    wave_total = 0
    return
  }

  # Compute in-degrees within filtered set
  for (i = 1; i <= epic_count; i++) {
    e = all_epics[i]
    if (in_set[e] != 1) continue
    dep_str = dep_list[e]
    if (dep_str == "") continue
    n = split(dep_str, deps, ",")
    for (j = 1; j <= n; j++) {
      d = deps[j]
      gsub(/[[:space:]]/, "", d)
      if (d == "" || in_set[d] != 1) continue
      in_degree[e]++
      # Build adjacency: adj[d] = "E1,E2,..."
      if (adj[d] == "") adj[d] = e
      else adj[d] = adj[d] "," e
    }
  }

  # Collect initial zero in-degree
  curr_count = 0
  for (i = 1; i <= epic_count; i++) {
    e = all_epics[i]
    if (in_set[e] != 1) continue
    if (in_degree[e] == 0) {
      curr_count++
      current[curr_count] = e
    }
  }

  wave_total = 0
  processed = 0

  while (curr_count > 0) {
    # Sort current wave
    sort_epics(current, curr_count)

    wave_total++
    # Store wave epics
    wave_size[wave_total] = curr_count
    for (i = 1; i <= curr_count; i++) {
      wave_epics[wave_total, i] = current[i]
    }

    processed += curr_count

    # Find next wave
    next_count = 0
    for (i = 1; i <= curr_count; i++) {
      e = current[i]
      if (adj[e] == "") continue
      nn = split(adj[e], narr, ",")
      for (j = 1; j <= nn; j++) {
        d = narr[j]
        gsub(/[[:space:]]/, "", d)
        in_degree[d]--
        if (in_degree[d] == 0) {
          next_count++
          next_arr[next_count] = d
        }
      }
    }

    # Move next to current
    curr_count = next_count
    delete current
    for (i = 1; i <= next_count; i++) {
      current[i] = next_arr[i]
    }
    delete next_arr
  }

  if (processed < total) {
    print "Error: Cycle detected in filtered epic set" > "/dev/stderr"
    exit 1
  }
}

function print_text(   w, i, e, item, items, sep) {
  print "=== Epic Dependency Graph ==="
  print ""

  if (wave_total == 0) {
    print "No epics to display."
    return
  }

  for (w = 1; w <= wave_total; w++) {
    items = ""
    sep = ""
    for (i = 1; i <= wave_size[w]; i++) {
      e = wave_epics[w, i]
      item = e
      if (classify == "true") {
        item = item "(Tier " tier[e] ")"
      }
      if (completed[e] == "true") {
        item = item " ✅"
      }
      items = items sep item
      sep = ", "
    }
    printf "Wave %d: [%s]\n", w, items
  }

  print ""
  printf "Total waves: %d\n", wave_total
}

function print_json(   i, e, w, j, first, dep_str, n, deps, d) {
  # nodes
  printf "{\"nodes\":["
  first = 1
  for (i = 1; i <= epic_count; i++) {
    e = all_epics[i]
    if (phase_filter != "" && phase_of[e] != phase_filter) continue
    if (pending_only == "true" && completed[e] == "true") continue
    if (!first) printf ","
    first = 0
    printf "{\"id\":\"%s\",\"phase\":\"%s\",\"completed\":%s", \
      e, phase_of[e], completed[e]
    if (classify == "true") {
      printf ",\"tier\":\"%s\"", tier[e]
    }
    printf "}"
  }
  printf "],\"edges\":["

  # edges
  first = 1
  for (i = 1; i <= epic_count; i++) {
    e = all_epics[i]
    if (phase_filter != "" && phase_of[e] != phase_filter) continue
    if (pending_only == "true" && completed[e] == "true") continue
    dep_str = dep_list[e]
    if (dep_str == "") continue
    n = split(dep_str, deps, ",")
    for (j = 1; j <= n; j++) {
      d = deps[j]
      gsub(/[[:space:]]/, "", d)
      if (d == "") continue
      if (!first) printf ","
      first = 0
      printf "{\"from\":\"%s\",\"to\":\"%s\"}", d, e
    }
  }
  printf "],\"waves\":["

  # waves
  first = 1
  for (w = 1; w <= wave_total; w++) {
    if (!first) printf ","
    first = 0
    printf "{\"wave\":%d,\"epics\":[", w
    for (j = 1; j <= wave_size[w]; j++) {
      if (j > 1) printf ","
      printf "\"%s\"", wave_epics[w, j]
    }
    printf "]}"
  }
  printf "]}\n"
}

function print_status_text(   p, pnum, epics_cell, n_ep, ep_arr, total, comp, pend, i, e, icon) {
  print "=== Epic Status by Phase ==="
  print ""
  for (p = 1; p <= phase_count; p++) {
    pnum = phase_order[p]
    epics_cell = phase_epic_list[pnum]
    gsub(/[[:space:]]/, "", epics_cell)
    n_ep = split(epics_cell, ep_arr, ",")
    total = n_ep; comp = 0; pend = 0
    for (i = 1; i <= n_ep; i++) {
      e = ep_arr[i]
      if (completed[e] == "true") comp++
      else pend++
    }
    if (comp == total) icon = "✅"
    else if (comp > 0) icon = "🔄"
    else icon = "⬜"

    if (pnum == "Infra")
      printf "%s %-10s  total=%-3d  completed=%-3d  pending=%-3d\n", icon, "Infra", total, comp, pend
    else
      printf "%s %-10s  total=%-3d  completed=%-3d  pending=%-3d\n", icon, "Phase " pnum, total, comp, pend
  }
}

function print_status_json(   p, pnum, epics_cell, n_ep, ep_arr, total, comp, pend, i, e, first) {
  printf "{\"phases\":["
  first = 1
  for (p = 1; p <= phase_count; p++) {
    pnum = phase_order[p]
    epics_cell = phase_epic_list[pnum]
    gsub(/[[:space:]]/, "", epics_cell)
    n_ep = split(epics_cell, ep_arr, ",")
    total = n_ep; comp = 0; pend = 0
    for (i = 1; i <= n_ep; i++) {
      e = ep_arr[i]
      if (completed[e] == "true") comp++
      else pend++
    }
    if (!first) printf ","
    first = 0
    printf "{\"phase\":\"%s\",\"epics\":[", pnum
    for (i = 1; i <= n_ep; i++) {
      if (i > 1) printf ","
      printf "\"%s\"", ep_arr[i]
    }
    printf "],\"total\":%d,\"completed\":%d,\"pending\":%d}", total, comp, pend
  }
  printf "]}\n"
}
' "$PROGRESS_FILE"
