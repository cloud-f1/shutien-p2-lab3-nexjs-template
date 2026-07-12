/**
 * E332 — draft preview token tests. Pure HMAC + expiry logic (no DB).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  DEFAULT_PREVIEW_TTL_MS,
  createPreviewToken,
  verifyPreviewToken,
} from "./preview-token"

const NOW = 1_000_000_000_000 // fixed epoch for determinism

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret"
})
afterEach(() => {
  delete process.env.AUTH_SECRET
})

describe("createPreviewToken", () => {
  it("is deterministic for the same (slug, expiry)", () => {
    expect(createPreviewToken("s", DEFAULT_PREVIEW_TTL_MS, NOW)).toBe(
      createPreviewToken("s", DEFAULT_PREVIEW_TTL_MS, NOW),
    )
  })

  it("embeds a future expiry as the first dotted segment", () => {
    const token = createPreviewToken("s", 60_000, NOW)
    const [expiry] = token.split(".")
    expect(Number(expiry)).toBe(NOW + 60_000)
  })

  it("differs for a different slug", () => {
    expect(createPreviewToken("a", DEFAULT_PREVIEW_TTL_MS, NOW)).not.toBe(
      createPreviewToken("b", DEFAULT_PREVIEW_TTL_MS, NOW),
    )
  })
})

describe("verifyPreviewToken", () => {
  it("accepts a freshly minted, unexpired token", () => {
    const token = createPreviewToken("course", 60_000, NOW)
    expect(verifyPreviewToken("course", token, NOW + 30_000)).toBe(true)
  })

  it("rejects a token past its expiry", () => {
    const token = createPreviewToken("course", 60_000, NOW)
    expect(verifyPreviewToken("course", token, NOW + 60_001)).toBe(false)
  })

  it("rejects a token minted for a different slug", () => {
    const token = createPreviewToken("course", 60_000, NOW)
    expect(verifyPreviewToken("other", token, NOW + 1_000)).toBe(false)
  })

  it("rejects a tampered signature", () => {
    const token = createPreviewToken("course", 60_000, NOW)
    const [expiry] = token.split(".")
    expect(verifyPreviewToken("course", `${expiry}.deadbeef`, NOW + 1_000)).toBe(false)
  })

  it("rejects a tampered expiry (re-signed against original)", () => {
    const token = createPreviewToken("course", 60_000, NOW)
    const sig = token.split(".")[1]
    // bump the expiry but keep the old signature → mismatch
    expect(verifyPreviewToken("course", `${NOW + 999_999}.${sig}`, NOW + 1_000)).toBe(false)
  })

  it.each(["", "no-dot", ".", "abc.def", "-5.deadbeef"])(
    "rejects malformed token %j",
    (bad) => {
      expect(verifyPreviewToken("course", bad, NOW)).toBe(false)
    },
  )

  it("rejects undefined / null", () => {
    expect(verifyPreviewToken("course", undefined, NOW)).toBe(false)
    expect(verifyPreviewToken("course", null, NOW)).toBe(false)
  })

  it("a token is invalid under a different AUTH_SECRET", () => {
    const token = createPreviewToken("course", 60_000, NOW)
    process.env.AUTH_SECRET = "different-secret"
    expect(verifyPreviewToken("course", token, NOW + 1_000)).toBe(false)
  })
})
