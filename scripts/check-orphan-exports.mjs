#!/usr/bin/env node
// check-orphan-exports.mjs — orphan-export guard: find exports with unit tests but zero
// production call-sites.
//
// Motivation (domain trap: orphan-tested-function): a function that has a unit test but was
// never wired into any production caller passes every coverage gate while doing nothing at
// runtime. See the `testing-strategy` skill's "orphan-tested-function trap" — this check turns
// that lesson into a runnable guard.
//
// Heuristic (regex, not AST): scan next-app/lib's named exports, count their references in
// "production" files (*.ts/tsx excluding *.test.*) vs "test" files (*.test.*), across the whole
// app (excluding the defining file itself, counted separately). production==0 && test>0 → flag
// as orphan. Expect a few false positives (public API surface, dynamic/string-based references)
// — default is "report" not "fail"; pass --strict to exit 1.
//
// Usage: node scripts/check-orphan-exports.mjs [--strict]
//   (run from repo root; scans next-app/lib — the pure-logic layer most in need of wiring
//   protection)

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
// ORPHAN_CHECK_APP_DIR (E358 regression test): lets a test point this at a throwaway fixture
// directory instead of the real next-app/ tree, so the stateful-regex regression test (see
// scripts/hooks/tests/test-e358-orphan-exports-stateful-regex.sh) never reads or writes real
// repo files — same isolation discipline as E353's PROGRESS_FILE/INDEX_FILE env overrides.
const APP = process.env.ORPHAN_CHECK_APP_DIR ? resolve(process.env.ORPHAN_CHECK_APP_DIR) : join(ROOT, "next-app")
const SCAN_ROOTS = ["lib"] // pure-logic layer — most in need of wiring-tested protection
// Everywhere a lib/ export could legitimately be called from in production: the app tree, plus
// one-off Node scripts (drizzle/seed.ts, scripts/module-validate.ts) that import lib/ helpers
// but aren't part of the Next.js request path.
const SEARCH_ROOTS = ["lib", "actions", "app", "components", "hooks", "drizzle", "scripts"]
// next-app root-level config files (not under SEARCH_ROOTS, but may reference lib exports,
// e.g. next.config.ts using SECURITY_HEADERS) — included so they don't produce false positives.
const ROOT_CONFIG_FILES = [
  "next.config.ts",
  "proxy.ts",
  "auth.config.ts",
  "middleware.ts",
  "instrumentation.ts",
]
// Exports manually triaged as "not dead, intentionally kept" (allowlisted to avoid recurring
// false positives). Add an entry only after confirming it's a genuine keeper — justify inline:
//   - (none yet — add `"exportName", // reason` entries here as real false positives are found)
const ALLOWLIST = new Set([])
// Leading-underscore exports (`_resetFoo`, `__resetBar`) are this codebase's established
// convention for test-only reset/escape hatches (see lib/pending-2fa.ts's `__resetNonces`,
// lib/rate-limit.ts's `__resetRateLimit`, lib/billing/providers/{stripe,ecpay}.ts's
// `_reset*Provider`) — exported solely so their own test file can reset module-level singleton
// state between cases. They will always have test references and zero production references by
// design, so they're structurally exempt rather than individually allowlisted.
const isTestOnlyConvention = (name) => /^_/.test(name)
const STRICT = process.argv.includes("--strict")

const isTest = (f) => /\.test\.(ts|tsx)$/.test(f)
const isTs = (f) => /\.(ts|tsx)$/.test(f)

function walk(dir) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const e of entries) {
    const p = join(dir, e)
    if (e === "node_modules" || e.startsWith(".")) continue
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (isTs(p)) out.push(p)
  }
  return out
}

// Read all file text once (reused across lookups) — including root config files.
const rootConfigs = ROOT_CONFIG_FILES.map((f) => join(APP, f)).filter((f) => {
  try {
    return statSync(f).isFile()
  } catch {
    return false
  }
})
const allFiles = [...SEARCH_ROOTS.flatMap((r) => walk(join(APP, r))), ...rootConfigs]
const fileText = new Map(allFiles.map((f) => [f, readFileSync(f, "utf8")]))

const EXPORT_RE =
  /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)|export\s+const\s+([A-Za-z0-9_]+)\s*[:=]/g

const orphans = []

for (const file of allFiles.filter((f) => SCAN_ROOTS.some((r) => f.startsWith(join(APP, r))) && !isTest(f))) {
  const text = fileText.get(file)
  const names = new Set()
  let m
  while ((m = EXPORT_RE.exec(text))) names.add(m[1] ?? m[2])

  for (const name of names) {
    if (ALLOWLIST.has(name)) continue // already triaged, exempted
    if (isTestOnlyConvention(name)) continue // `_`/`__`-prefixed test-only reset hook
    // No `g` flag: a global regex's `.test()` advances `lastIndex` on every call, so reusing
    // one instance across the loop below made consecutive calls on *different* strings
    // alternate true/false/true (verified — see E358). `.test()` on a non-global regex always
    // matches from index 0, so a single instance is safe to reuse across the loop.
    const ref = new RegExp(`\\b${name}\\b`)
    let prod = 0 // cross-file production references
    let test = 0 // *.test.* references
    for (const [f, t] of fileText) {
      if (f === file) continue // defining file counted separately (below)
      if (!ref.test(t)) continue
      if (isTest(f)) test++
      else prod++
    }
    // Same-file usage: appears more than once (declaration + at least one use) → treat as
    // already wired within the module (avoid flagging "a constant used by an already-wired
    // function in the same file" as an orphan).
    // Separate global instance for `.match()` (needs `g` to collect all hits) — never shared
    // with the `.test()` instance above, which is exactly the bug this file used to have.
    const globalRef = new RegExp(`\\b${name}\\b`, "g")
    const selfHits = (text.match(globalRef) || []).length
    const usedInFile = selfHits > 1

    if (prod === 0 && !usedInFile && test > 0) {
      orphans.push({ name, file: file.replace(APP + "/", ""), testRefs: test })
    }
  }
}

if (orphans.length === 0) {
  console.log("✅ No orphan exports (every lib/ named export has a production reference, or none are tested).")
  process.exit(0)
}

console.log(`⚠️ Found ${orphans.length} export(s) with tests but zero production references (possibly unwired — see the orphan-tested-function trap):\n`)
for (const o of orphans) {
  console.log(`  • ${o.name}  (${o.file})  — ${o.testRefs} test reference(s), 0 production references`)
}
console.log(
  `\nTriage each: a genuinely unwired feature (fix by wiring it in), or a deliberate public-API/test-only ` +
    `utility (allowlist it above with a one-line justification comment)?`,
)
process.exit(STRICT ? 1 : 0)
