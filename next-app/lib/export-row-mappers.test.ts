import { describe, expect, it } from "vitest"

import {
  apiKeyToExportRow,
  invitationToExportRow,
  teamMemberToExportRow,
  webhookToExportRow,
} from "./export-row-mappers"

// ---------------------------------------------------------------------------
// webhookToExportRow
// ---------------------------------------------------------------------------

describe("webhookToExportRow", () => {
  const base = {
    id: "wh-1",
    userId: "user-1",
    url: "https://example.com/hook",
    events: ["user.created", "api_key.created"],
    active: true,
    createdAt: new Date("2024-01-15T10:00:00Z"),
  }

  it("maps fields correctly", () => {
    const row = webhookToExportRow(base)
    expect(row.id).toBe("wh-1")
    expect(row.userId).toBe("user-1")
    expect(row.url).toBe("https://example.com/hook")
    expect(row.active).toBe(true)
    expect(row.createdAt).toBe("2024-01-15T10:00:00.000Z")
  })

  it("joins events with pipe delimiter", () => {
    const row = webhookToExportRow(base)
    expect(row.events).toBe("user.created|api_key.created")
  })

  it("handles wildcard events", () => {
    const row = webhookToExportRow({ ...base, events: ["*"] })
    expect(row.events).toBe("*")
  })

  it("never includes a 'secret' field", () => {
    const row = webhookToExportRow(base)
    expect(Object.keys(row)).not.toContain("secret")
  })
})

// ---------------------------------------------------------------------------
// apiKeyToExportRow — SECURITY: no raw secret or hash
// ---------------------------------------------------------------------------

describe("apiKeyToExportRow", () => {
  const base = {
    id: "key-1",
    userId: "user-1",
    name: "prod-server",
    prefix: "abcd1234",
    scopes: ["read", "write"],
    lastUsedAt: new Date("2024-03-01T08:00:00Z"),
    revokedAt: null,
    createdAt: new Date("2024-01-01T00:00:00Z"),
  }

  it("maps prefix with sk_ prefix and ellipsis", () => {
    const row = apiKeyToExportRow(base)
    expect(row.prefix).toBe("sk_abcd1234…")
  })

  it("does NOT contain hashedKey or any raw secret", () => {
    const row = apiKeyToExportRow(base)
    const keys = Object.keys(row)
    expect(keys).not.toContain("hashedKey")
    expect(keys).not.toContain("secret")
    expect(keys).not.toContain("hash")
    // The value of prefix must be only the short prefix, never a full key
    expect(String(row.prefix).length).toBeLessThan(30)
  })

  it("joins scopes with pipe delimiter", () => {
    const row = apiKeyToExportRow(base)
    expect(row.scopes).toBe("read|write")
  })

  it("exports empty string for null lastUsedAt and revokedAt", () => {
    const row = apiKeyToExportRow({ ...base, lastUsedAt: null, revokedAt: null })
    expect(row.lastUsedAt).toBe("")
    expect(row.revokedAt).toBe("")
  })

  it("exports ISO strings for non-null date fields", () => {
    const row = apiKeyToExportRow(base)
    expect(row.lastUsedAt).toBe("2024-03-01T08:00:00.000Z")
    expect(row.createdAt).toBe("2024-01-01T00:00:00.000Z")
  })

  it("exports revokedAt as ISO string when set", () => {
    const revoked = new Date("2024-06-01T12:00:00Z")
    const row = apiKeyToExportRow({ ...base, revokedAt: revoked })
    expect(row.revokedAt).toBe("2024-06-01T12:00:00.000Z")
  })
})

// ---------------------------------------------------------------------------
// teamMemberToExportRow
// ---------------------------------------------------------------------------

describe("teamMemberToExportRow", () => {
  const base = {
    id: "user-1",
    name: "Alice",
    email: "alice@example.com",
    role: "admin",
    status: "active",
    createdAt: new Date("2024-01-01T00:00:00Z"),
  }

  it("maps all fields correctly", () => {
    const row = teamMemberToExportRow(base)
    expect(row.id).toBe("user-1")
    expect(row.name).toBe("Alice")
    expect(row.email).toBe("alice@example.com")
    expect(row.role).toBe("admin")
    expect(row.status).toBe("active")
    expect(row.createdAt).toBe("2024-01-01T00:00:00.000Z")
  })

  it("exports empty string for null name", () => {
    const row = teamMemberToExportRow({ ...base, name: null })
    expect(row.name).toBe("")
  })
})

// ---------------------------------------------------------------------------
// invitationToExportRow
// ---------------------------------------------------------------------------

describe("invitationToExportRow", () => {
  const base = {
    id: "inv-1",
    email: "bob@example.com",
    role: "editor",
    status: "pending",
    expiresAt: new Date("2024-02-01T00:00:00Z"),
    createdAt: new Date("2024-01-25T00:00:00Z"),
  }

  it("maps all fields correctly", () => {
    const row = invitationToExportRow(base)
    expect(row.id).toBe("inv-1")
    expect(row.email).toBe("bob@example.com")
    expect(row.role).toBe("editor")
    expect(row.status).toBe("pending")
    expect(row.expiresAt).toBe("2024-02-01T00:00:00.000Z")
    expect(row.createdAt).toBe("2024-01-25T00:00:00.000Z")
  })

  it("does not contain a token field", () => {
    const row = invitationToExportRow(base)
    expect(Object.keys(row)).not.toContain("token")
  })
})
