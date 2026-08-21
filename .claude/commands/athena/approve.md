---
description: "(planning) Approve a gated phase → flip 🟡 PROPOSED / ⛔ CR-pending → 🟢 APPROVED across ALL four state surfaces. Usage: `<phase-number> [--note \"…\"]`"
allowed-tools: Read, Edit, Bash, Glob, Grep
---

# Phase Approval — the 🟡/⛔ → 🟢 transition, mechanized

You flip a proposed or contract-gated phase to APPROVED. This exists because the
transition spans **four separate surfaces**, and missing any ONE of them produces a
silent failure downstream — not an error, "nothing happened," so the next session
still thinks the phase is running:

| # | Surface | Misses cause |
|---|---------|--------------|
| 1 | `docs/context/epic-progress.md` → **Phase Status** row | `epic-graph.sh` exits 3 (`phase_blocked`) / `batch auto` skips the phase forever |
| 2 | `docs/context/epic-progress.md` → **Dependency Rules** block (+ Epic Step Matrix rows) | `epic-graph.sh --phase N` has no nodes → exit 2 `unknown_phase` (or an empty wave) |
| 3 | `docs/epics/EPIC_INDEX.md` phase row + epic rows | catalog contradicts state; humans misread progress |
| 4 | `docs/epics/e{n}-*.md` **spec headers** | the pre-dispatch spec-header gate skips the epic; an implement agent that does get the file refuses mid-run |

fork 在先前一次手動核准中四個面全部踩過一次（見 `docs/context/fork-sync-audit-2026-07-10.md`），
之後才寫了這支命令。記憶檔 `epic-phase-status-table-registration` 記的就是同一個坑的其中一面。

## Hard rules

- **Approval is a HUMAN act.** Run this command only when the user has explicitly
  said to approve the phase in this conversation. NEVER invoke it from cron, `/loop`,
  `/athena:batch auto`, or on your own initiative. If you arrived here without an
  explicit user approval statement, STOP and ask.
- **Record the approval as what it is.** Write down the user's actual stated reason —
  do NOT upgrade it into a fact that didn't happen (e.g. don't write "contract signed"
  unless the user said the contract/CR is actually signed). Future sessions read these
  tables as ground truth.
- **Scope strictly.** Approving phase N says nothing about phase N+1. Do not touch any
  other phase's status.

## Protocol

Parse `$ARGUMENTS`: first token = phase number (required); `--note "…"` = extra
context to record (e.g. the approval reason or a CR reference).

1. **Read current state.** `docs/context/epic-progress.md` → confirm the phase row
   exists and its status is 🟡 PROPOSED or ⛔ CR-pending. Already 🟢/✅ → report
   "nothing to do" and STOP. Not found → STOP (register the phase via `/athena:plan`
   first).
2. **Surface 1 — Phase Status row:** rewrite the status cell to
   `🟢 APPROVED ({YYYY-MM-DD}) — {note}`. Preserve any wave-plan / descope text
   already in the cell — approval lifts the gate, it does not erase scope decisions.
3. **Surface 2 — graph registration:** ensure the Dependency Rules fenced block has
   one `E{n}: <deps|no deps>` line per epic (source deps from EPIC_INDEX / the spec
   files), and the Epic Step Matrix has a row per epic (typically
   `| E{n} | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | Phase {N} — 🟢 APPROVED ({date}). … |` when specs
   already exist). Do not overwrite rows that already exist.
4. **Surface 3 — EPIC_INDEX.md:** update the phase row status + each epic row's phase
   marker to `🟢 APPROVED ({date})`, and update the Next Action line if it pointed at
   the gate.
5. **Surface 4 — spec headers:** for each epic, rewrite the header gate marker in
   `docs/epics/e{n}-*.md` (a `🟡 **PROPOSED — do not implement yet**` /
   `⛔ **CR-pending — …**` fragment) to `🟢 **APPROVED — approved by the user on
   {date}{, note}**`. Only the header line — leave body scope/criteria untouched.
6. **Verify — the gates must now agree:**
   ```bash
   bash scripts/epic-graph.sh --phase {N} --pending-only --json   # exit 0, waves non-empty
   for f in docs/epics/e{n}-*.md; do head -5 "$f" | grep -E "do not implement|CR-pending|PROPOSED" && echo "STILL GATED: $f"; done   # no output
   ```
   Either check failing → fix before reporting done.
7. **Commit** (both docs files + spec headers) as
   `chore(state): approve Phase {N} ({E-list}) — {date}`, and report: the wave plan
   from step 6's JSON + the reminder that dispatch is now `/athena:batch --phase {N}`
   (scoped — auto mode would also pick it up, but scoping can't leak into later gated
   phases).

## What this command does NOT do

- Does not dispatch any work (that's `/athena:batch` / `/athena:loop`, separately).
- Does not create epics or specs (that's `/athena:plan`).
- Does not reverse an approval (🟢 → 🟡) — that's a manual, deliberate edit.
