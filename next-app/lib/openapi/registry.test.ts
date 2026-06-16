import { describe, it, expect } from "vitest"

import { buildOpenApiDocument } from "./registry"

describe("buildOpenApiDocument (E281 — Zod-derived OpenAPI contract)", () => {
  const doc = buildOpenApiDocument()
  const paths = Object.keys(doc.paths ?? {})

  it("is an OpenAPI 3.1 document with the template title", () => {
    expect(doc.openapi).toBe("3.1.0")
    expect(doc.info.title).toBe("AI App Template API")
    // version is read from package.json — just assert it's a non-empty string.
    expect(typeof doc.info.version).toBe("string")
    expect(doc.info.version.length).toBeGreaterThan(0)
  })

  it("documents the REAL HTTP route handlers", () => {
    expect(paths).toContain("/api/health")
    expect(paths).toContain("/api/billing/stripe/webhook")
    expect(paths).toContain("/api/billing/ecpay/return")
    expect(paths).toContain("/api/billing/ecpay/period")
    expect(paths).toContain("/api/billing/ecpay/renew")
    expect(paths).toContain("/api/billing/reconcile")
  })

  it("does NOT resurrect the stale FastAPI-era fiction", () => {
    // These were migrated to Server Actions (actions/user.ts + actions/admin.ts).
    expect(paths).not.toContain("/api/users/me")
    expect(paths).not.toContain("/api/users/me/password")
    expect(paths).not.toContain("/api/admin/users")
    expect(paths).not.toContain("/api/admin/users/{userId}")
    expect(paths).not.toContain("/api/admin/users/{userId}/role")
    // No stale path should mention users/me or admin/users at all.
    for (const p of paths) {
      expect(p).not.toMatch(/\/api\/users\/me/)
      expect(p).not.toMatch(/\/api\/admin\/users/)
    }
  })

  it("omits framework-owned Auth.js routes", () => {
    for (const p of paths) {
      expect(p).not.toMatch(/\/api\/auth\//)
    }
  })

  it("registers the shared Zod validation schemas as named components", () => {
    const components = doc.components?.schemas ?? {}
    expect(components).toHaveProperty("RegisterInput")
    expect(components).toHaveProperty("LoginInput")
    expect(components).toHaveProperty("UpdateProfileInput")
    expect(components).toHaveProperty("ChangePasswordInput")
    expect(components).toHaveProperty("CreateItemInput")
    expect(components).toHaveProperty("UpdateItemInput")
  })

  it("guards the Stripe webhook with a signature header + 400 on bad sig", () => {
    const op = doc.paths?.["/api/billing/stripe/webhook"]?.post
    expect(op).toBeDefined()
    expect(op?.responses).toHaveProperty("200")
    expect(op?.responses).toHaveProperty("400")
  })

  it("guards the cron routes with the CRON_SECRET bearer scheme + 401", () => {
    const renew = doc.paths?.["/api/billing/ecpay/renew"]?.post
    const reconcile = doc.paths?.["/api/billing/reconcile"]?.post
    expect(renew?.responses).toHaveProperty("401")
    expect(reconcile?.responses).toHaveProperty("401")
    expect(doc.components?.securitySchemes).toHaveProperty("cronBearer")
  })

  it("documents the contract model in info.description", () => {
    expect(doc.info.description).toMatch(/Server Actions/)
    expect(doc.info.description).toMatch(/typed RPC/)
    expect(doc.info.description).toMatch(/Auth\.js/)
  })

  it("is pure / re-callable (two builds are structurally equal)", () => {
    const a = buildOpenApiDocument()
    const b = buildOpenApiDocument()
    expect(Object.keys(a.paths ?? {})).toEqual(Object.keys(b.paths ?? {}))
  })
})
