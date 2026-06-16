import { describe, expect, it } from "vitest"

import { extractBearer, hasScope, requireScope } from "./api-auth-utils"

describe("extractBearer", () => {
  it("extracts the token from a well-formed Bearer header", () => {
    expect(extractBearer("Bearer sk_a1b2c3d4_secret")).toBe("sk_a1b2c3d4_secret")
  })

  it("is case-insensitive on the scheme and tolerates extra whitespace", () => {
    expect(extractBearer("bearer  sk_x_y  ")).toBe("sk_x_y")
    expect(extractBearer("  Bearer sk_x_y")).toBe("sk_x_y")
  })

  it("returns null for missing / empty / non-bearer headers", () => {
    expect(extractBearer(null)).toBeNull()
    expect(extractBearer(undefined)).toBeNull()
    expect(extractBearer("")).toBeNull()
    expect(extractBearer("Bearer ")).toBeNull()
    expect(extractBearer("Basic abc123")).toBeNull()
    expect(extractBearer("sk_no_scheme")).toBeNull()
  })
})

describe("hasScope", () => {
  it("is true only when the scope is present", () => {
    expect(hasScope(["read", "write"], "read")).toBe(true)
    expect(hasScope(["read"], "write")).toBe(false)
    expect(hasScope([], "read")).toBe(false)
  })

  it("is false for null / undefined / non-array scopes", () => {
    expect(hasScope(null, "read")).toBe(false)
    expect(hasScope(undefined, "write")).toBe(false)
  })
})

describe("requireScope", () => {
  it("returns null when the scope is granted", () => {
    expect(requireScope(["read"], "read")).toBeNull()
  })

  it("returns a 403 descriptor naming the missing scope", () => {
    expect(requireScope(["read"], "write")).toEqual({
      error: "Missing required scope: write",
      status: 403,
    })
    expect(requireScope(null, "read")).toEqual({
      error: "Missing required scope: read",
      status: 403,
    })
  })
})
