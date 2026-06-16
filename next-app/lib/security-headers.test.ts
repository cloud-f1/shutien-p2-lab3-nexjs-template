import { describe, it, expect } from "vitest"
import { SECURITY_HEADERS } from "./security-headers"

/** Names that MUST be present in the exported header list. */
const EXPECTED_HEADER_NAMES = [
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "X-DNS-Prefetch-Control",
  "Permissions-Policy",
  "Content-Security-Policy",
]

describe("SECURITY_HEADERS", () => {
  const headerKeys = SECURITY_HEADERS.map((h) => h.key)

  it("exports an array", () => {
    expect(Array.isArray(SECURITY_HEADERS)).toBe(true)
    expect(SECURITY_HEADERS.length).toBeGreaterThan(0)
  })

  it("every entry has a non-empty key and value", () => {
    for (const header of SECURITY_HEADERS) {
      expect(typeof header.key).toBe("string")
      expect(header.key.length).toBeGreaterThan(0)
      expect(typeof header.value).toBe("string")
      expect(header.value.length).toBeGreaterThan(0)
    }
  })

  for (const name of EXPECTED_HEADER_NAMES) {
    it(`includes the ${name} header`, () => {
      expect(headerKeys).toContain(name)
    })
  }

  it("Strict-Transport-Security has max-age and includeSubDomains", () => {
    const hsts = SECURITY_HEADERS.find(
      (h) => h.key === "Strict-Transport-Security"
    )
    expect(hsts?.value).toMatch(/max-age=\d+/)
    expect(hsts?.value).toContain("includeSubDomains")
  })

  it("X-Content-Type-Options is nosniff", () => {
    const h = SECURITY_HEADERS.find((h) => h.key === "X-Content-Type-Options")
    expect(h?.value).toBe("nosniff")
  })

  it("X-Frame-Options is DENY", () => {
    const h = SECURITY_HEADERS.find((h) => h.key === "X-Frame-Options")
    expect(h?.value).toBe("DENY")
  })

  it("CSP contains default-src 'self'", () => {
    const csp = SECURITY_HEADERS.find(
      (h) => h.key === "Content-Security-Policy"
    )
    expect(csp?.value).toContain("default-src 'self'")
  })

  it("CSP blocks object-src", () => {
    const csp = SECURITY_HEADERS.find(
      (h) => h.key === "Content-Security-Policy"
    )
    expect(csp?.value).toContain("object-src 'none'")
  })

  it("Permissions-Policy disables camera, microphone, geolocation", () => {
    const h = SECURITY_HEADERS.find((h) => h.key === "Permissions-Policy")
    expect(h?.value).toContain("camera=()")
    expect(h?.value).toContain("microphone=()")
    expect(h?.value).toContain("geolocation=()")
  })

  it("no duplicate header keys", () => {
    const seen = new Set<string>()
    for (const { key } of SECURITY_HEADERS) {
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })
})
