import { describe, expect, it } from "vitest"

import { collectEventSchema } from "./analytics"

describe("collectEventSchema", () => {
  it("accepts a minimal valid beacon", () => {
    const r = collectEventSchema.safeParse({ slug: "launch", event: "page_view" })
    expect(r.success).toBe(true)
  })

  it("accepts the three funnel events + optional utm", () => {
    for (const event of ["page_view", "cta_click", "checkout_started"]) {
      const r = collectEventSchema.safeParse({
        slug: "launch",
        event,
        utm: { source: "ig", medium: "social", campaign: "summer" },
      })
      expect(r.success).toBe(true)
    }
  })

  it("rejects an unknown event", () => {
    expect(collectEventSchema.safeParse({ slug: "x", event: "purchase" }).success).toBe(false)
  })

  it("rejects a missing/empty slug", () => {
    expect(collectEventSchema.safeParse({ event: "page_view" }).success).toBe(false)
    expect(collectEventSchema.safeParse({ slug: "  ", event: "page_view" }).success).toBe(false)
  })

  it("does NOT accept a client-supplied session hash (privacy: derived server-side)", () => {
    const r = collectEventSchema.safeParse({
      slug: "launch",
      event: "page_view",
      sessionHash: "forged",
    })
    // Extra keys are stripped by Zod object parsing — the hash never rides the body.
    expect(r.success).toBe(true)
    if (r.success) expect("sessionHash" in r.data).toBe(false)
  })
})
