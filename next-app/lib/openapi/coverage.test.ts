/**
 * Contract-first coverage guard (E281).
 *
 * The drift gate (scripts/smoke.sh) proves the committed docs/openapi.yaml matches
 * the registry. This test closes the *omission* gap: it proves every real HTTP route
 * handler under app/api/** is actually registered in the OpenAPI contract. Add a
 * route without registering it in lib/openapi/registry.ts → this test fails, with the
 * undocumented path named. That is what enforces "contract-first" when new endpoints
 * are added — not memory or code review.
 */
import { readdirSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { buildOpenApiDocument } from "./registry"

const APP_API = fileURLToPath(new URL("../../app/api", import.meta.url))

// Routes intentionally absent from the contract (matched against the derived API path):
//  - /api/auth/** : Auth.js framework-owned (we don't document its internals)
//  - /api/openapi : the endpoint that *serves* the contract itself
const EXEMPT: RegExp[] = [/^\/api\/auth\//, /^\/api\/openapi$/]

function findRouteFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...findRouteFiles(full))
    else if (entry.name === "route.ts" || entry.name === "route.tsx") out.push(full)
  }
  return out
}

/** app/api/billing/stripe/webhook/route.ts → /api/billing/stripe/webhook ; [id] → {id} */
function toApiPath(routeFile: string): string {
  const rel = relative(APP_API, routeFile).replace(/\/route\.tsx?$/, "")
  const segs = rel ? rel.split("/").map((s) => s.replace(/^\[(?:\.\.\.)?([^\]]+)\]$/, "{$1}")) : []
  return ["/api", ...segs].join("/")
}

describe("OpenAPI route coverage (contract-first guard)", () => {
  it("every app/api route handler is registered in the OpenAPI contract", () => {
    const documented = new Set(Object.keys(buildOpenApiDocument().paths ?? {}))
    const undocumented = findRouteFiles(APP_API)
      .map(toApiPath)
      .filter((p) => !EXEMPT.some((re) => re.test(p)))
      .filter((p) => !documented.has(p))
      .sort()

    expect(
      undocumented,
      `Undocumented HTTP route(s). Contract-first: register each in lib/openapi/registry.ts ` +
        `and run \`pnpm openapi:generate\` before merging → ${undocumented.join(", ")}`,
    ).toEqual([])
  })
})
