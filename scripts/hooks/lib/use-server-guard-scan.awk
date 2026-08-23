# scripts/hooks/lib/use-server-guard-scan.awk
#
# E351 — per-export guard scan for a "use server" Server Action file.
# Usage: awk -f use-server-guard-scan.awk <file>
# Output: one line per violation, "<lineno>|<exportName>" (nothing if the file
# is clean, or carries the file-level `// stop-verifier:public-action` marker).
#
# WHY THIS EXISTS (see docs/epics/e351-use-server-guard-rule.md): E346 and E350
# were the SAME root cause twice — an internal-use function living in a
# `"use server"` file, where every export is a public POST endpoint and
# reachability is not decided by author intent. Rule 2 (stop-verifier.sh) is
# FILE-scoped ("does this file contain guard text anywhere") and only fires
# when the file also does a `db.insert/update/delete` — that shape missed both
# incidents: E350's `listSalesPages` was a plain SELECT (out of Rule 2's
# scope), and E346's `recordUsage` DID contain the literal text
# `requireAuth()` — just nested behind an `if (!ownerId)` that an optional
# caller-supplied param could skip, which a file-wide text grep cannot see.
# This scanner is PER-EXPORT.
#
# ============================================================================
# WHAT THIS RULE ACTUALLY CATCHES (read this before trusting it further than
# it goes — an overstated guarantee is worse than an honest narrow one):
# ============================================================================
#
# A recognized guard call is considered VALID only when it is reachable
# without passing through an `if`/`else` branch — including the single-line
# forms (`if (cond) requireAuth()` and `if (cond) { requireAuth() }`), which
# are gated exactly like the multi-line form. try/catch/finally are NOT
# conditional (a guard as the first statement inside `try { }` always runs —
# this repo's real pattern in exportItems/exportApiKeys/exportTeam/
# exportWebhooks/exportAuditLog).
#
# Recognized guards:
#   - Direct: requireAuth / requireEditor / requireAdmin / requireRole /
#     requireFlag / guard (Rule 2's family, E319).
#   - isAdmin(...)/canEdit(...) applied DIRECTLY to a getLiveRole(...) call
#     (e.g. `isAdmin(await getLiveRole(actorId))` — the real
#     actions/admin-revenue.ts `getMemberDetail` shape). Deliberately
#     narrower than a bare `isAdmin(`/`canEdit(` match: those are pure
#     predicates (`lib/is-admin.ts`) that security-audit SKILL.md §2 warns
#     are UI-only — calling them on a stale JWT-snapshotted
#     `session.user.role` instead of a freshly re-read live role is the
#     exact bug that section blocks on, so a bare match would have let that
#     bug hide behind this rule's own "guarded" verdict.
#   - Manual `auth()` + null-check-and-bail — `const s = await auth()` (or
#     `getLiveRole`-free `auth()`) followed, later in the SAME block, by an
#     UNGATED `if (!s?.user?...) { return/redirect ... }` (braced or
#     brace-less single-line) on THAT SAME identifier. This is functionally
#     identical to what `requireAuth()` does internally
#     (`lib/permissions.ts`) — real shape:
#     `next-app/registry/billing-stripe/actions/billing.ts` `createCheckoutSession`.
#   - `defineAction(...)` consts, and a call to one from a wrapper.
#   - A call to a local (possibly unexported) helper function whose OWN body
#     independently satisfies one of the above (e.g. `ensureAdmin()` in
#     actions/webhooks.ts) — ONLY if that helper is actually CALLED from the
#     export being checked (see "Known blind spots" below for what this does
#     NOT cover).
#
# Recognized export shapes: `export async function NAME(...) { ... }` and
# `export const NAME = (async )?(...) => { ... }` (block-bodied arrow only).
#
# ---- Known blind spots (accepted false negatives — grep-level by design,
# not a real parser; see the epic's "judgement" section) ----
#   - Ternary guards: `cond ? requireAuth() : null` are NOT detected as
#     conditional — an ungated ternary containing a guard call currently
#     PASSES. Deliberately not special-cased (chasing ternary/`&&`/`switch`
#     shapes is exactly the completeness the epic said to avoid).
#   - `&&`/`||` short-circuit guards: `cond && requireAuth()` currently
#     PASSES regardless of `cond`.
#   - `switch`/`case` branches are not tracked as conditional at all — a
#     guard inside a `case` block is treated as unconditional.
#   - A guard call sitting in a function that is DECLARED but never called
#     (or only conditionally called) from the export under check is invisible
#     to this rule if the helper itself independently guards — the rule only
#     verifies the callee's OWN body, not whether/how the caller reaches it.
#   - Expression-bodied arrow exports (`export const x = () => expr`, no
#     `{ }` block) are not recognized as an export boundary at all.
#   - A guard reachable only through several layers of indirection beyond one
#     local helper hop is not traced.
#
# False negatives in the list above are expected and accepted. False
# positives are NOT: dismiss a genuine one with the existing
# `// stop-verifier:public-action` marker (file-level, matches Rule 2's
# convention already used by actions/checkout.ts) rather than adding a
# second escape hatch.

BEGIN { n = 0 }
{ n++; line[n] = $0 }
END {
  # ---- 0. File-level public-action marker exempts the WHOLE file ----------
  for (i = 1; i <= n; i++) {
    if (line[i] ~ /\/\/[ \t]*stop-verifier:public-action/) exit 0
  }

  guardRe = "(^|[^A-Za-z0-9_])(requireAuth|requireEditor|requireAdmin|requireRole|requireFlag|guard)\\(" \
            "|(^|[^A-Za-z0-9_])(isAdmin|canEdit)\\([ \t]*(await[ \t]+)?getLiveRole\\("

  # ---- 1. Find all top-level declaration boundaries ------------------------
  bn = 0
  for (i = 1; i <= n; i++) {
    l = line[i]
    if (match(l, /^export[ \t]+(async[ \t]+)?function[ \t]+[A-Za-z_][A-Za-z0-9_]*/) > 0) {
      bn++; bstart[bn] = i; bkind[bn] = "exportfn"; bname[bn] = fname(l)
      continue
    }
    if (match(l, /^(async[ \t]+)?function[ \t]+[A-Za-z_][A-Za-z0-9_]*/) > 0) {
      bn++; bstart[bn] = i; bkind[bn] = "localfn"; bname[bn] = fname(l)
      continue
    }
    if (match(l, /^(export[ \t]+)?const[ \t]+[A-Za-z_][A-Za-z0-9_]*[ \t]*=[ \t]*defineAction[ \t]*[<(]/) > 0) {
      bn++; bstart[bn] = i; bkind[bn] = "defineaction"; bname[bn] = cname(l)
      continue
    }
    # Block-bodied arrow function export: `export const NAME = (async )?(...) => {`
    # (only when the SAME line already opens the arrow body with `{` at EOL —
    # a multi-line param list before `=>` is a documented blind spot, not
    # worth the extra scan pass for a shape no current file uses).
    if (match(l, /^export[ \t]+const[ \t]+[A-Za-z_][A-Za-z0-9_]*[ \t]*=[ \t]*(async[ \t]+)?\(.*\)[ \t]*(:[^=]*)?=>[ \t]*\{[ \t]*$/) > 0) {
      bn++; bstart[bn] = i; bkind[bn] = "exportarrow"; bname[bn] = cname(l)
      continue
    }
    if (match(l, /^(export[ \t]+)?const[ \t]+[A-Za-z_][A-Za-z0-9_]*[ \t]*=/) > 0 ||
        match(l, /^(export[ \t]+)?(interface|type)[ \t]/) > 0) {
      bn++; bstart[bn] = i; bkind[bn] = "other"; bname[bn] = ""
      continue
    }
  }
  if (bn == 0) exit 0

  for (b = 1; b <= bn; b++) {
    bend[b] = (b < bn) ? bstart[b + 1] - 1 : n
  }

  # ---- 2. Seed the guarded-identifier set with defineAction consts ---------
  gcount = 0
  for (b = 1; b <= bn; b++) {
    if (bkind[b] == "defineaction") { gcount++; gname[gcount] = bname[b] }
  }

  # ---- 3. Local (non-exported) helper functions that directly guard -------
  for (b = 1; b <= bn; b++) {
    if (bkind[b] == "localfn") {
      if (bodyDirectlyGuards(bstart[b], bend[b], guardRe)) {
        gcount++; gname[gcount] = bname[b]
      }
    }
  }

  # ---- 4. Check every EXPORTED function / arrow ----------------------------
  for (b = 1; b <= bn; b++) {
    if (bkind[b] != "exportfn" && bkind[b] != "exportarrow") continue
    ok = 0
    if (bodyDirectlyGuards(bstart[b], bend[b], guardRe)) ok = 1
    if (!ok) {
      for (g = 1; g <= gcount; g++) {
        if (bodyCallsIdentifier(bstart[b], bend[b], gname[g])) { ok = 1; break }
      }
    }
    if (!ok) print bstart[b] "|" bname[b]
  }
}

function fname(l,    rest) {
  rest = l
  sub(/^export[ \t]+/, "", rest)
  sub(/^async[ \t]+/, "", rest)
  sub(/^function[ \t]+/, "", rest)
  sub(/[ \t]*\(.*/, "", rest)
  return rest
}

function cname(l,    rest) {
  rest = l
  sub(/^export[ \t]+/, "", rest)
  sub(/^const[ \t]+/, "", rest)
  sub(/[ \t]*=.*/, "", rest)
  return rest
}

function bodyCallsIdentifier(s, e, ident,    i, re) {
  re = "(^|[^A-Za-z0-9_])" ident "[ \t]*\\("
  for (i = s; i <= e; i++) {
    if (line[i] ~ re) return 1
  }
  return 0
}

# Does a guard call found on THIS single line sit in a position that should
# GATE it (E346's shape: the guard is inside the if's CONSEQUENT, reached
# only when the condition holds — `if (!skip) await requireAuth()` /
# `if (!skip) { requireAuth() }`, both on one line with no bail)? Or is it
# a legitimate check-and-bail idiom (the guard call is the if's own
# CONDITION, and the statement exits on failure — e.g. real shape
# `actions/admin-revenue.ts` `getMemberDetail`:
# `if (!isAdmin(await getLiveRole(actorId))) return { error: ... }`)?
#
# Heuristic: a single-line if/else-if/else HEAD (not a multi-line `{`
# opener — that's handled by the stack instead) gates its line UNLESS the
# same line also contains a bail (`return`/`redirect(`/`throw`). In the
# check-and-bail idiom the guard call lives inside the condition and the
# line always bails on failure; in E346's bypass shape there is no bail at
# all on that line — the guard call (if it runs) is followed by nothing,
# execution just continues. This does not attempt to determine whether the
# guard call is textually inside the parens or the consequent (POSIX ERE
# can't reliably paren-match `if (!isAdmin(role)) requireAuth()` — greedy
# `.*` walks past nested parens) — it is a documented blind spot (see header)
# that a same-line bail after a NON-bailing guard call (e.g.
# `if (cond) { requireAuth(); return }`) is not caught.
function singleLineIfGatesGuard(trimmed,    isHead) {
  if (trimmed ~ /\{$/) return 0  # a real multi-line opener — handled by the stack instead
  isHead = 0
  if (trimmed ~ /^if[ \t]*\(/) isHead = 1
  else if (trimmed ~ /^\}[ \t]*else[ \t]+if[ \t]*\(/) isHead = 1
  else if (trimmed ~ /^\}[ \t]*else([ \t]|$)/) isHead = 1
  else if (trimmed ~ /^else[ \t]+if[ \t]*\(/) isHead = 1
  else if (trimmed ~ /^else([ \t]|$)/) isHead = 1
  if (!isHead) return 0
  if (trimmed ~ /(return|redirect\(|throw[ \t])/) return 0  # check-and-bail idiom — not gated
  return 1
}

# Returns 1 if the block [s,e] contains EITHER:
#   (a) a recognized direct guard call that is reachable without passing
#       through an if/else branch (single-line if/else forms count as
#       gating too — see isSingleLineConditionalHead), or
#   (b) a manual `auth()` + null-check-and-bail on the SAME identifier,
#       likewise unconditionally reachable.
# try/catch/finally do not count as conditional (see header comment).
function bodyDirectlyGuards(s, e, guardRe,    i, trimmed, opened, isCloser, sp, k,
                             gated, svn, sv, ident, pendIdent, pendDepth, rest,
                             re, gatedAssign, preGated) {
  sp = 0
  svn = 0            # count of collected "session vars" (const X = await auth())
  pendIdent = ""      # identifier awaiting a bail inside the if-block we just pushed
  pendDepth = 0       # stack depth (sp right after push) that bail must still be inside

  for (i = s; i <= e; i++) {
    trimmed = line[i]
    gsub(/^[ \t]+|[ \t]+$/, "", trimmed)

    opened = ""
    if (trimmed ~ /^\}[ \t]*else[ \t]+if[ \t]*\(.*\)[ \t]*\{$/) opened = "if"
    else if (trimmed ~ /^\}[ \t]*else[ \t]*\{$/) opened = "else"
    else if (trimmed ~ /^\}[ \t]*catch([ \t]*\([^)]*\))?[ \t]*\{$/) opened = "catch"
    else if (trimmed ~ /^\}[ \t]*finally[ \t]*\{$/) opened = "finally"
    else if (trimmed ~ /^if[ \t]*\(.*\)[ \t]*\{$/) opened = "if"
    else if (trimmed ~ /^try[ \t]*\{$/) opened = "try"
    else if (trimmed ~ /\{$/) opened = "other"

    isCloser = (trimmed ~ /^\}[,;)\]]*[ \t]*$/)

    # ---- session-var check-and-bail: does THIS line null-check-and-bail an
    # already-collected auth() identifier? Evaluated on the PRE-push stack
    # state (an ungated if/else-if/else head only), covering both the
    # single-line form (bail on the same line) and the braced multi-line
    # form (bail somewhere inside the block this line is about to open).
    if (svn > 0 && (trimmed ~ /^if[ \t]*\(/ || trimmed ~ /^\}[ \t]*else[ \t]+if[ \t]*\(/)) {
      preGated = 0
      for (k = 1; k <= sp; k++) if (stack[k] == "if" || stack[k] == "else") { preGated = 1; break }
      if (!preGated) {
        for (k = 1; k <= svn; k++) {
          ident = sv[k]
          # NOTE: no trailing word-boundary escape here — `\b` inside an awk
          # STRING literal (as opposed to a /regex/ literal) is lexed as a
          # literal backspace control character, not a word-boundary token,
          # which silently made this regex unmatchable. A bare "user" suffix
          # match is precise enough for this narrow, known property name.
          re = "!" ident "(\\?\\.|\\.)user"
          if (trimmed ~ re) {
            if (trimmed ~ /(return|redirect\()/) return 1   # same-line bail
            if (trimmed ~ /\{$/) { pendIdent = ident; pendDepth = sp + 1 }  # bail expected inside the block about to open
          }
        }
      }
    }

    if (trimmed ~ /^\}/ && opened != "") {
      if (sp > 0) sp--
      sp++; stack[sp] = opened
    } else if (opened != "") {
      sp++; stack[sp] = opened
    } else if (isCloser) {
      if (sp > 0) sp--
    }

    # A pending check-and-bail: satisfied once we see return/redirect while
    # still at/inside the depth it was raised at; abandoned once we pop
    # below that depth without ever seeing one.
    if (pendIdent != "") {
      if (sp < pendDepth) {
        pendIdent = ""
      } else if (line[i] ~ /(return|redirect\()/) {
        return 1
      }
    }

    # ---- collect `IDENT = (await )?auth()` as a session var, only when
    # reached unconditionally (same if/else-stack rule as everything else).
    if (trimmed ~ /^(const|let|var)[ \t]+[A-Za-z_][A-Za-z0-9_]*[ \t]*=[ \t]*(await[ \t]+)?auth\([ \t]*\)[ \t]*$/) {
      gatedAssign = 0
      for (k = 1; k <= sp; k++) if (stack[k] == "if" || stack[k] == "else") { gatedAssign = 1; break }
      if (!gatedAssign) {
        rest = trimmed
        sub(/^(const|let|var)[ \t]+/, "", rest)
        sub(/[ \t]*=.*/, "", rest)
        svn++; sv[svn] = rest
      }
    }

    # ---- recognized direct guard call (requireX/isAdmin+getLiveRole/etc) --
    if (line[i] ~ guardRe) {
      gated = 0
      for (k = 1; k <= sp; k++) {
        if (stack[k] == "if" || stack[k] == "else") { gated = 1; break }
      }
      if (!gated && singleLineIfGatesGuard(trimmed)) gated = 1
      if (!gated) return 1
    }
  }
  return 0
}
