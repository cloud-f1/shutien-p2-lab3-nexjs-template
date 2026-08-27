import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const APP = join(ROOT, "next-app")
const SEARCH_ROOTS = ["lib", "actions", "app", "components", "hooks", "drizzle", "scripts"]
const TARGET_NAMES = process.argv.slice(2)

const isTs = (f) => /\.(ts|tsx)$/.test(f)
const isTest = (f) => /\.test\.(ts|tsx)$/.test(f)

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

const allFiles = SEARCH_ROOTS.flatMap((r) => walk(join(APP, r)))
const fileText = new Map(allFiles.map((f) => [f, readFileSync(f, "utf8")]))

for (const name of TARGET_NAMES) {
  console.log(`\n=== ${name} ===`)
  const ref = new RegExp(`\\b${name}\\b`, "g") // BUGGY version (shared, global)
  let prod = 0
  let test = 0
  let seq = []
  for (const [f, t] of fileText) {
    const before = ref.lastIndex
    const r = ref.test(t)
    const after = ref.lastIndex
    if (r) {
      seq.push(`${r}(li:${before}->${after}) ${f.replace(APP + "/", "")} len=${t.length}`)
      if (isTest(f)) test++
      else prod++
    }
  }
  console.log(`BUGGY total: prod=${prod} test=${test}`)
  seq.forEach((s) => console.log("  " + s))

  const ref2 = new RegExp(`\\b${name}\\b`) // FIXED version (non-global, fresh reuse ok)
  let prod2 = 0
  let test2 = 0
  for (const [f, t] of fileText) {
    if (!ref2.test(t)) continue
    if (isTest(f)) test2++
    else prod2++
  }
  console.log(`FIXED total: prod=${prod2} test=${test2}`)
}
