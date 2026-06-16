/**
 * E291 — public REST API integration tests.
 *
 * Verifies the bearer-key auth gate + per-scope enforcement + user-scoped queries:
 *   401 no/invalid key · 403 wrong scope · 200 list · 201 create · 400 bad body.
 *
 * verifyApiKey + the db are mocked so the route logic is exercised without a DB.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// --- Mocks ------------------------------------------------------------------

const mockVerifyApiKey = vi.fn()
vi.mock("@/lib/api-keys", () => ({
  verifyApiKey: (...a: unknown[]) => mockVerifyApiKey(...a),
}))

const selectRows: Array<Record<string, unknown>> = []
const inserted: Array<Record<string, unknown>> = []
let whereArg: unknown = undefined

vi.mock("@/lib/db", () => {
  const select = () => ({
    from: () => ({
      where: (w: unknown) => {
        whereArg = w
        return { orderBy: async () => selectRows }
      },
    }),
  })
  const insert = () => ({
    values: (vals: Record<string, unknown>) => ({
      returning: async () => {
        const row = { id: "item-new", createdAt: new Date(0), updatedAt: new Date(0), ...vals }
        inserted.push(row)
        return [row]
      },
    }),
  })
  return { db: { select, insert } }
})

vi.mock("@/lib/schema", () => ({
  itemsTable: {
    id: "id",
    title: "title",
    userId: "user_id",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
}))

vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ __eq: a }),
  desc: (...a: unknown[]) => ({ __desc: a }),
}))

// --- Import SUT after mocks -------------------------------------------------

import { GET, POST } from "./route"

function req(
  init: { headers?: Record<string, string>; body?: unknown } = {},
): import("next/server").NextRequest {
  return new Request("http://localhost/api/v1/items", {
    method: init.body !== undefined ? "POST" : "GET",
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  }) as unknown as import("next/server").NextRequest
}

beforeEach(() => {
  vi.clearAllMocks()
  selectRows.length = 0
  inserted.length = 0
  whereArg = undefined
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("auth gate", () => {
  it("401s GET with no Authorization header", async () => {
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(mockVerifyApiKey).not.toHaveBeenCalled()
  })

  it("401s POST with no Authorization header", async () => {
    const res = await POST(req({ body: { title: "x" } }))
    expect(res.status).toBe(401)
  })

  it("401s when the key is invalid/revoked (verifyApiKey → null)", async () => {
    mockVerifyApiKey.mockResolvedValue(null)
    const res = await GET(req({ headers: { authorization: "Bearer sk_bad_key" } }))
    expect(res.status).toBe(401)
    expect(mockVerifyApiKey).toHaveBeenCalledWith("sk_bad_key")
  })
})

describe("scope enforcement", () => {
  it("403s GET when the key lacks the read scope", async () => {
    mockVerifyApiKey.mockResolvedValue({ userId: "u1", role: "viewer", scopes: ["write"] })
    const res = await GET(req({ headers: { authorization: "Bearer sk_x_y" } }))
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.error).toContain("read")
  })

  it("403s POST when the key lacks the write scope", async () => {
    mockVerifyApiKey.mockResolvedValue({ userId: "u1", role: "viewer", scopes: ["read"] })
    const res = await POST(req({ headers: { authorization: "Bearer sk_x_y" }, body: { title: "x" } }))
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.error).toContain("write")
  })
})

describe("GET /api/v1/items", () => {
  it("200s and returns the key-owner's items", async () => {
    mockVerifyApiKey.mockResolvedValue({ userId: "u1", role: "editor", scopes: ["read"] })
    selectRows.push({ id: "i1", title: "Hello", createdAt: new Date(0), updatedAt: new Date(0) })

    const res = await GET(req({ headers: { authorization: "Bearer sk_x_y" } }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(body.items[0]).toMatchObject({ id: "i1", title: "Hello" })
    // Query was scoped to the resolved owner id.
    expect(whereArg).toEqual({ __eq: ["user_id", "u1"] })
  })
})

describe("POST /api/v1/items", () => {
  it("201s and creates an item for the key owner", async () => {
    mockVerifyApiKey.mockResolvedValue({ userId: "u1", role: "editor", scopes: ["read", "write"] })

    const res = await POST(
      req({ headers: { authorization: "Bearer sk_x_y" }, body: { title: "  New item  " } }),
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.item).toMatchObject({ id: "item-new", title: "New item" })
    // Inserted with the trimmed title + the resolved owner id.
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({ title: "New item", userId: "u1" })
  })

  it("400s on an invalid body (empty title)", async () => {
    mockVerifyApiKey.mockResolvedValue({ userId: "u1", role: "editor", scopes: ["write"] })
    const res = await POST(req({ headers: { authorization: "Bearer sk_x_y" }, body: { title: "" } }))
    expect(res.status).toBe(400)
    expect(inserted).toHaveLength(0)
  })

  it("400s on a too-long title (>255)", async () => {
    mockVerifyApiKey.mockResolvedValue({ userId: "u1", role: "editor", scopes: ["write"] })
    const res = await POST(
      req({ headers: { authorization: "Bearer sk_x_y" }, body: { title: "a".repeat(256) } }),
    )
    expect(res.status).toBe(400)
    expect(inserted).toHaveLength(0)
  })
})
