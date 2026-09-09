# rows-affected-scan.awk — Rule 26 (E368).
#
# Finds functions in a Server-Action file that perform an ownership-scoped
# db.update()/db.delete() AND write an audit event, but never inspect the
# rows-affected count.
#
# Why this class matters: a Server Action is a public POST endpoint. When the
# WHERE clause is owner-scoped and matches ZERO rows (someone else's id, or a
# nonexistent one), the write is a no-op — but an unconditional logAudit() still
# fires. That lets any authenticated caller inject a forged audit entry naming a
# resource they cannot touch, into the compliance surface E356/E359 hardened.
#
# `actions/items.ts` was already correct; the five sites E368 fixed were not.
# The fix had been applied per-case rather than to the pattern — this rule is
# what makes the pattern hold.
#
# Output: one "LINE|FUNCTION" record per offending function (empty = clean).
#
# Deliberately line-based and conservative: it reports only functions where the
# write, the audit, and the ABSENCE of a count check all co-occur. A function
# that checks `.count`, uses `.returning()` with a null test, proves existence
# with a prior SELECT + missing-row guard, carries an explicit
# `// stop-verifier:rows-affected-ok` marker, or writes no audit at all is not
# reported.
#
# NOTE — drizzle chains across LINES:
#     await db
#       .update(apiKeysTable)
# so a single-line /db\s*\.\s*update\(/ pattern matches nothing at all. The
# first draft of this scanner did exactly that and reported zero hits against
# the five known-bad functions — a scanner that cannot fail is worth less than
# no scanner, because it reads as a clean bill of health. Hence the leading-dot
# form below, and the fixture test that pins non-emptiness.

function flush(   ) {
  if (fname != "" && has_write && has_audit && !has_count && !has_select_guard && !has_optout) {
    print fstart "|" fname
  }
  fname = ""; has_write = 0; has_audit = 0; has_count = 0
  has_select_guard = 0; has_optout = 0; saw_select = 0; fstart = 0
}

BEGIN { fname = ""; depth_seen = 0 }

# A new top-level function/action block starts — close the previous one.
/^export[[:space:]]+(async[[:space:]]+)?function[[:space:]]+[A-Za-z0-9_]+/ {
  flush()
  match($0, /function[[:space:]]+[A-Za-z0-9_]+/)
  fname = substr($0, RSTART, RLENGTH)
  sub(/^function[[:space:]]+/, "", fname)
  fstart = NR
  next
}

# `const fooAction = defineAction<...>({` — the E323 factory form.
/^const[[:space:]]+[A-Za-z0-9_]+[[:space:]]*=[[:space:]]*defineAction/ {
  flush()
  match($0, /const[[:space:]]+[A-Za-z0-9_]+/)
  fname = substr($0, RSTART, RLENGTH)
  sub(/^const[[:space:]]+/, "", fname)
  fstart = NR
  next
}

# The opt-out marker must be read BEFORE comments are skipped.
fname != "" && /stop-verifier:rows-affected-ok/ { has_optout = 1 }

# Ignore comment lines entirely — a commented-out example must not count as a
# write, and prose mentioning `.count` must not count as a check. (E366 found
# the inverse mistake: a same-file scan that counted comments as real usage and
# thereby exempted documented code from dead-code detection.)
/^[[:space:]]*(\/\/|\*|\/\*)/ { next }

fname != "" {
  # Both the one-line form and drizzle's line-broken chain (a leading `.update(`
  # / `.delete(` continuing an `await db` on the previous line).
  if ($0 ~ /db[[:space:]]*\.[[:space:]]*(update|delete)[[:space:]]*\(/) has_write = 1
  if ($0 ~ /^[[:space:]]*\.[[:space:]]*(update|delete)[[:space:]]*\(/) has_write = 1
  if ($0 ~ /logAudit[[:space:]]*\(/ || $0 ~ /^[[:space:]]*audit:[[:space:]]*\{/) has_audit = 1
  if ($0 ~ /\.count/ || $0 ~ /\.returning[[:space:]]*\(/) has_count = 1

  # A function that first SELECTs the row and bails when it is missing has
  # already proven existence; its later write cannot be a silent no-op and its
  # audit event is honest. `actions/team.ts acceptInvitation` is the canonical
  # example — it selects the invite, returns an error when absent, validates the
  # invited email, and only then updates by the proven id. Without this branch
  # the rule flags it, and a rule that cries wolf on correct code gets disabled.
  if ($0 ~ /db[[:space:]]*\.[[:space:]]*select[[:space:]]*\(/) saw_select = 1
  if ($0 ~ /^[[:space:]]*\.[[:space:]]*select[[:space:]]*\(/) saw_select = 1
  # ...including a SELECT hidden behind a query helper. `actions/auth.ts
  # loginAction` proves the user exists via getUserByEmail() + an `if (!user)`
  # bail (the E356 no-audit-for-unknown-account policy), so its later
  # lockout-clearing UPDATE cannot be a silent no-op.
  if ($0 ~ /await[[:space:]]+get[A-Z][A-Za-z0-9_]*[[:space:]]*\(/) saw_select = 1
  if (saw_select && $0 ~ /if[[:space:]]*\([[:space:]]*!/ && $0 ~ /return/) has_select_guard = 1
  if (saw_select && $0 ~ /^[[:space:]]*if[[:space:]]*\([[:space:]]*!/) pending_guard = 1
  if (pending_guard && $0 ~ /return/) { has_select_guard = 1; pending_guard = 0 }
}

END { flush() }
