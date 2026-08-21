import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import os from "node:os"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { getPlanLimit } from "@/lib/usage-utils"
import { PRICING_CURRENCY, PRICING_TIERS, type PricingTier } from "@/lib/billing/pricing"
import { roleEnum } from "@/lib/schema"
import { CAPABILITIES, PERMISSION_MATRIX } from "@/lib/team-utils"

/**
 * Doc↔code contract — the drift guard (E341).
 *
 * A handful of constants in this template are stated in code AND restated in prose
 * elsewhere (a markdown doc, a skill, a comment block). Prose can't be type-checked, so
 * it silently rots the moment the code changes and nobody remembers to update the page.
 *
 * This test pins the DOCUMENTED value onto the CODE constant it claims to describe.
 * If it FAILS, the two have diverged — fix BOTH: update the code constant AND the doc/
 * skill that quotes it, don't just edit this test to make it green again. Each assertion
 * below carries an inline comment naming the doc source (file + section) so whoever this
 * turns red on knows which page to go fix.
 *
 * This is the executable half of `/athena:audit` Step 6a ("doc↔code constant drift") —
 * see `.claude/commands/athena/audit.md`. Only pin constants that are genuinely restated
 * in prose AND whose drift would NOT already turn some other test red (see
 * `docs/context/qa-patterns.md` § "doc↔code 契約測試" for the 判準).
 *
 * One exception, labeled honestly where it happens (§3 below): `config/pricing.json`'s
 * tier slugs/prices/currency have NO independent prose restatement anywhere in this repo
 * (searched — see the note at §3), so pinning them against `PRICING_TIERS` is a plain
 * content-regression pin, not a doc↔code contract — it is named and commented as such,
 * not mixed in with the real contracts.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")

// ---------------------------------------------------------------------------
// 1. Effort tiers — scripts/effort/resolve.sh vs CLAUDE.md § "Effort Tiers (E198)"
// ---------------------------------------------------------------------------

interface ResolvedTier {
  MAX_CONCURRENT: number
  MAX_ITERATIONS: number
  REVIEW_LOOP_BUDGET: number
  AUTOPILOT_THRESHOLD: number
}

/** Run the real resolve.sh (not a re-implementation) and parse its export lines. */
function resolveTier(tier: string): ResolvedTier {
  const scriptPath = resolve(REPO_ROOT, "scripts/effort/resolve.sh")
  const out = execFileSync("bash", [scriptPath, "--effort", tier], {
    encoding: "utf8",
    // AUDIT_LOG_PATH override keeps this test from writing to the real
    // .claude/audit.jsonl (resolve.sh supports this for exactly this reason).
    // ATHENA_EFFORT="" ensures the --effort flag we pass always wins.
    env: { ...process.env, ATHENA_EFFORT: "", AUDIT_LOG_PATH: "/dev/null" },
  })
  const num = (name: string): number => {
    const m = out.match(new RegExp(`export ${name}=([0-9.]+)`))
    if (!m) {
      throw new Error(
        `resolve.sh output is missing "${name}" — its export contract changed, update doc-contract.test.ts`,
      )
    }
    return Number(m[1])
  }
  return {
    MAX_CONCURRENT: num("MAX_CONCURRENT"),
    MAX_ITERATIONS: num("MAX_ITERATIONS"),
    REVIEW_LOOP_BUDGET: num("REVIEW_LOOP_BUDGET"),
    AUTOPILOT_THRESHOLD: num("AUTOPILOT_THRESHOLD"),
  }
}

describe("doc↔code contract: effort tiers (scripts/effort/resolve.sh vs CLAUDE.md § Effort Tiers)", () => {
  // CLAUDE.md, root of repo, "## Effort Tiers (E198)" table — read + verified against the
  // actual `case "$TIER" in …)` block in scripts/effort/resolve.sh on 2026-08-22:
  //   quick    1 / 1 / 15000  / 0.80
  //   standard 4 / 4 / 50000  / 0.85
  //   thorough 4 / 6 / 150000 / 0.90
  //   ultra    min(16,cores-2) / 8 / 500000 / 0.95   (MAX_CONCURRENT is dynamic — see below)
  it.each([
    ["quick", 1, 1, 15000, 0.8],
    ["standard", 4, 4, 50000, 0.85],
    ["thorough", 4, 6, 150000, 0.9],
  ] as const)(
    "%s tier: MAX_CONCURRENT=%i MAX_ITERATIONS=%i REVIEW_LOOP_BUDGET=%i AUTOPILOT_THRESHOLD=%f",
    (tier, maxConcurrent, maxIterations, reviewLoopBudget, autopilotThreshold) => {
      const resolved = resolveTier(tier)
      expect(resolved.MAX_CONCURRENT).toBe(maxConcurrent)
      expect(resolved.MAX_ITERATIONS).toBe(maxIterations)
      expect(resolved.REVIEW_LOOP_BUDGET).toBe(reviewLoopBudget)
      expect(resolved.AUTOPILOT_THRESHOLD).toBeCloseTo(autopilotThreshold, 5)
    },
  )

  it("ultra tier: fixed knobs match CLAUDE.md, MAX_CONCURRENT follows the documented min(16, cores-2) formula", () => {
    const resolved = resolveTier("ultra")
    expect(resolved.MAX_ITERATIONS).toBe(8)
    expect(resolved.REVIEW_LOOP_BUDGET).toBe(500000)
    expect(resolved.AUTOPILOT_THRESHOLD).toBeCloseTo(0.95, 5)

    // CLAUDE.md documents ultra's MAX_CONCURRENT as prose "min(16,cores-2)" rather than a
    // fixed number — pin the FORMULA, computed independently here, against resolve.sh's
    // actual (cores-aware) output.
    const cores = os.cpus().length
    const expectedConcurrent = Math.min(16, Math.max(1, cores - 2))
    expect(resolved.MAX_CONCURRENT).toBe(expectedConcurrent)
  })
})

// ---------------------------------------------------------------------------
// 2. RBAC capability matrix — lib/team-utils.ts vs docs/qa/manual-test-plan/README.md § 4
// ---------------------------------------------------------------------------

describe("doc↔code contract: RBAC capability matrix (lib/team-utils.ts vs docs/qa/manual-test-plan/README.md § 4)", () => {
  // docs/qa/manual-test-plan/README.md § "4. Role × capability quick-reference" states:
  // "Single source of truth: next-app/lib/team-utils.ts (PERMISSION_MATRIX), rendered
  // read-only in-app at Dashboard → Admin → Permission Matrix." — followed by a ✓/✗ table.
  it("CAPABILITIES key set matches the 6 capabilities documented in the quick-reference table", () => {
    expect(CAPABILITIES.map((c) => c.key).sort()).toEqual(
      [
        "items.read", // "View items"
        "items.write", // "Create / edit items"
        "items.delete", // "Delete items"
        "members.manage", // "Manage members & roles"
        "billing.manage", // "Manage billing"
        "system.audit", // "View audit log"
      ].sort(),
    )
  })

  // Transcribed verbatim (✓=true / ✗=false) from the README § 4 table.
  const DOCUMENTED_MATRIX: Record<string, Record<string, boolean>> = {
    admin: {
      "items.read": true,
      "items.write": true,
      "items.delete": true,
      "members.manage": true,
      "billing.manage": true,
      "system.audit": true,
    },
    editor: {
      "items.read": true,
      "items.write": true,
      "items.delete": true,
      "members.manage": false,
      "billing.manage": false,
      "system.audit": false,
    },
    viewer: {
      "items.read": true,
      "items.write": false,
      "items.delete": false,
      "members.manage": false,
      "billing.manage": false,
      "system.audit": false,
    },
  }

  it.each(Object.entries(DOCUMENTED_MATRIX))(
    "role %s: PERMISSION_MATRIX row matches the documented row exactly",
    (role, expectedRow) => {
      expect(PERMISSION_MATRIX[role as keyof typeof PERMISSION_MATRIX]).toEqual(expectedRow)
    },
  )

  it("PERMISSION_MATRIX's role key set exactly equals the Role union (lib/schema roleEnum.enumValues)", () => {
    // `Role` (lib/schema/auth.ts) is a type-only union with no runtime representation.
    // `roleEnum` (the Drizzle pgEnum defined right next to it, same source values) DOES
    // carry its members at runtime via `.enumValues` — that's the real, observable stand-in
    // for the type. Add a role to roleEnum/Role without adding a PERMISSION_MATRIX row (or
    // vice versa) and this goes red.
    expect(Object.keys(PERMISSION_MATRIX).sort()).toEqual([...roleEnum.enumValues].sort())
  })
})

// ---------------------------------------------------------------------------
// 3. Plans / pricing — lib/billing/pricing.ts + config/pricing.json + lib/usage-utils.ts
//
// NOTE (E341 QA follow-up): searched README.md, docs/**, dev-docs/** (incl. the
// `@saas/landing` module docs, which only point at `pricing.tsx`/`DEFAULT_PRICING_TIERS`
// by name, never restating a slug/price), and next-app/lib/sales/** (a DIFFERENT domain —
// the E326/E332 custom `/p/[slug]` sales-page builder, unrelated to plan pricing). None of
// them restate the free/pro/scale slugs, $29/$99 prices, or "usd" currency in independent,
// human-maintained prose. `config/pricing.json`'s own `$comment` states a POLICY ("edit
// here, single source of truth"), not a value. So there is currently no independent-prose
// doc↔code contract for the tier table itself — only the marketing-wiring check below is a
// genuine one. See docs/context/qa-patterns.md § "doc↔code 契約測試" #1 for the 判準 this
// follows, and its "pricing has no independent prose source" note if that ever changes.
// ---------------------------------------------------------------------------

describe("regression pin (NOT a doc↔code contract): config/pricing.json tier content", () => {
  // This is a plain content-regression pin, not a doc↔code contract: PRICING_TIERS
  // (lib/billing/pricing.ts) is a near-identity pass-through of config/pricing.json, so
  // this compares the file against a hardcoded snapshot of its OWN current content — there
  // is no independent prose source to pin against (see the NOTE above). Kept anyway because
  // an accidental slug/price/currency edit in config/pricing.json is still worth catching;
  // labeled honestly so nobody mistakes it for E341's real doc↔code guarantee.
  it("tier slugs, monthly prices, and currency match the last-known-good config/pricing.json snapshot", () => {
    expect(PRICING_CURRENCY).toBe("usd")
    expect(
      PRICING_TIERS.map((t) => ({
        slug: t.slug,
        monthlyPrice: t.monthlyPrice,
        purchasable: t.providerPriceId !== null,
      })),
    ).toEqual([
      { slug: "free", monthlyPrice: 0, purchasable: false },
      { slug: "pro", monthlyPrice: 29, purchasable: true },
      { slug: "scale", monthlyPrice: 99, purchasable: true },
    ])
  })
})

describe("doc↔code contract: marketing pricing page wiring (components/marketing/pricing.tsx vs config/pricing.json)", () => {
  // This one IS a genuine doc↔code contract — the "行銷頁引用一致" (marketing page stays
  // consistent with the pricing source) requirement means the page must be WIRED to
  // PRICING_TIERS, not hand-copy tier data that could drift from config/pricing.json
  // silently. components/marketing/pricing.tsx is a "use client" component with no
  // test-friendly export, so the wiring check is source-parsed rather than imported.
  it("the marketing pricing page imports PRICING_TIERS instead of duplicating a literal tier table", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "next-app/components/marketing/pricing.tsx"),
      "utf8",
    )
    expect(src).toMatch(
      /import\s*\{[^}]*PRICING_TIERS[^}]*\}\s*from\s*["']@\/lib\/billing\/pricing["']/,
    )
  })
})

describe("doc↔code contract: usage-limits UNLIMITED-by-default convention (lib/usage-utils.ts docstring)", () => {
  // lib/usage-utils.ts `getPlanLimit` docstring states the UNLIMITED-by-default convention:
  // unknown tier slug / tier with no `limits` key / metric absent from `limits` / a
  // non-finite-or-negative value → null (unlimited). config/pricing.json's scale tier
  // carries a `$limits_comment` making the same claim for its (deliberately absent) `limits`
  // key — this is the real fixture that convention depends on.
  it("UNLIMITED-by-default convention holds for every documented case", () => {
    expect(getPlanLimit("does-not-exist", "api_request")).toBeNull() // unknown tier slug
    expect(getPlanLimit("scale", "api_request")).toBeNull() // scale has no `limits` key at all
    expect(getPlanLimit("free", "not_a_real_metric")).toBeNull() // metric absent from limits
    expect(getPlanLimit("pro", "api_request")).toBe(50000) // sanity: a real finite cap still enforces

    const negativeLimitTier = { slug: "fake", limits: { m: -5 } } as unknown as PricingTier
    expect(getPlanLimit(negativeLimitTier, "m")).toBeNull() // non-finite/negative → defensive null
  })
})

// ---------------------------------------------------------------------------
// 4. Status tones — components/status-badge.tsx TONES vs design-system skill
// ---------------------------------------------------------------------------

/**
 * `TONES` is a module-private const in components/status-badge.tsx (not exported —
 * that file is outside this epic's touch scope), so the code side is source-parsed
 * rather than imported.
 */
function extractToneKeys(): string[] {
  const src = readFileSync(
    resolve(REPO_ROOT, "next-app/components/status-badge.tsx"),
    "utf8",
  )
  const match = src.match(/const TONES = \{([\s\S]*?)\} as const/)
  if (!match) {
    throw new Error(
      "status-badge.tsx: `const TONES = {...} as const` block not found — source shape changed, update doc-contract.test.ts",
    )
  }
  return [...match[1].matchAll(/^\s*(\w+):/gm)].map((m) => m[1])
}

describe("doc↔code contract: status tones (components/status-badge.tsx TONES vs design-system skill)", () => {
  // .claude/skills/design-system/SKILL.md § "StatusBadge Tones" — added by this epic (the
  // skill did not previously enumerate the tone set at all, which is exactly the kind of
  // drift this test exists to catch going forward).
  const DOCUMENTED_TONES = ["success", "warning", "info", "danger", "muted"]

  it("TONES key set matches the tone list documented in the design-system skill", () => {
    expect(extractToneKeys().sort()).toEqual([...DOCUMENTED_TONES].sort())
  })
})
