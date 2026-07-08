/**
 * define-action.test.ts — unit tests for the Server-Action factory (E323).
 *
 * The whole pipeline is exercised with the auth/role/audit/revalidate seams mocked,
 * so no DB is touched — this runs in the default `pnpm test` (node env). The
 * integration test (test/int/define-action.int.test.ts) covers the real DB + audit
 * write end-to-end.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"

// Mutable auth/role state the mocks read lazily, flipped per test.
let sessionUserId: string | null = "actor-1"
let liveRole: "admin" | "editor" | "viewer" | undefined = "editor"

vi.mock("@/lib/auth", () => ({
  auth: async () => (sessionUserId ? { user: { id: sessionUserId } } : null),
}))
// Mocking @/lib/permissions wholesale also cuts its transitive @/lib/db import.
vi.mock("@/lib/permissions", () => ({
  getLiveRole: async () => liveRole,
}))
// vi.mock factories are hoisted above const declarations — build the spies with
// vi.hoisted so the factories can reference them.
const { logAudit, revalidatePath } = vi.hoisted(() => ({
  logAudit: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock("@/lib/audit", () => ({ logAudit }))
vi.mock("next/cache", () => ({ revalidatePath }))

const { defineAction } = await import("@/lib/define-action")

beforeEach(() => {
  sessionUserId = "actor-1"
  liveRole = "editor"
})
afterEach(() => {
  logAudit.mockClear()
  revalidatePath.mockClear()
})

describe("defineAction", () => {
  it("rejects an unauthenticated caller before validating or running the handler", async () => {
    sessionUserId = null
    const handler = vi.fn()
    const action = defineAction({ schema: z.object({ x: z.string() }), handler })
    const result = await action({ x: "hi" })
    expect(result).toMatchObject({ error: expect.any(String) })
    expect(handler).not.toHaveBeenCalled()
  })

  it("rejects a caller whose live role was revoked (deleted account)", async () => {
    liveRole = undefined
    const action = defineAction({
      schema: z.object({ x: z.string() }),
      handler: async () => ({ data: {}, audit: null }),
    })
    expect(await action({ x: "hi" })).toMatchObject({ error: expect.any(String) })
  })

  it("enforces the role gate with the configured deny message", async () => {
    liveRole = "viewer"
    const handler = vi.fn()
    const action = defineAction({
      allow: (role) => role === "admin",
      denyMessage: "admins only",
      schema: z.object({ x: z.string() }),
      handler,
    })
    expect(await action({ x: "hi" })).toEqual({ error: "admins only" })
    expect(handler).not.toHaveBeenCalled()
  })

  it("returns the first Zod issue message and never runs the handler on invalid input", async () => {
    const handler = vi.fn()
    const action = defineAction({
      schema: z.object({ x: z.string().min(3, "too short") }),
      handler,
    })
    expect(await action({ x: "a" })).toEqual({ error: "too short" })
    expect(handler).not.toHaveBeenCalled()
  })

  it("runs the resource authorize hook, passing its resource into the handler", async () => {
    const action = defineAction({
      schema: z.object({ x: z.string() }),
      authorize: async () => ({ ok: { owned: true } }),
      handler: async (_input, _ctx, resource) => ({
        data: { owned: resource.owned },
        audit: null,
      }),
    })
    expect(await action({ x: "hi" })).toEqual({ ok: true, owned: true })
  })

  it("short-circuits when the authorize hook rejects — no handler, no audit", async () => {
    const handler = vi.fn()
    const action = defineAction({
      schema: z.object({ x: z.string() }),
      authorize: async () => ({ error: "not yours" }),
      handler,
    })
    expect(await action({ x: "hi" })).toEqual({ error: "not yours" })
    expect(handler).not.toHaveBeenCalled()
    expect(logAudit).not.toHaveBeenCalled()
  })

  it("on success: writes the audit entry, revalidates, and returns { ok, ...data }", async () => {
    const action = defineAction({
      allow: (role) => role === "editor" || role === "admin",
      schema: z.object({ title: z.string() }),
      revalidate: ["/a", "/b"],
      handler: async ({ title }, ctx) => ({
        data: { title },
        audit: { actorId: ctx.actorId, action: "thing.created", targetType: "thing" },
      }),
    })
    const result = await action({ title: "Widget" })
    expect(result).toEqual({ ok: true, title: "Widget" })
    expect(logAudit).toHaveBeenCalledTimes(1)
    expect(logAudit).toHaveBeenCalledWith({ actorId: "actor-1", action: "thing.created", targetType: "thing" })
    expect(revalidatePath).toHaveBeenCalledTimes(2)
  })

  it("audit:null explicitly exempts — success without any audit write", async () => {
    const action = defineAction({
      schema: z.object({ x: z.string() }),
      handler: async () => ({ data: {}, audit: null }),
    })
    expect(await action({ x: "hi" })).toEqual({ ok: true })
    expect(logAudit).not.toHaveBeenCalled()
  })

  it("a handler {error} fails cleanly — no audit, no revalidate", async () => {
    const action = defineAction({
      schema: z.object({ x: z.string() }),
      revalidate: ["/a"],
      handler: async () => ({ error: "not found" }),
    })
    expect(await action({ x: "hi" })).toEqual({ error: "not found" })
    expect(logAudit).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
