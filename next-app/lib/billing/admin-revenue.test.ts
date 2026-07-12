import { describe, expect, it } from "vitest"

import { canMarkRefunded, canResendActivation } from "@/lib/billing/admin-revenue"

describe("canMarkRefunded", () => {
  it("allows refunding a paid order", () => {
    expect(canMarkRefunded("paid")).toEqual({ ok: true })
  })

  it("rejects an already-refunded order (no double-audit)", () => {
    expect(canMarkRefunded("refunded")).toMatchObject({ error: expect.any(String) })
  })

  it("rejects a pending order (never charged)", () => {
    expect(canMarkRefunded("pending")).toMatchObject({ error: expect.any(String) })
  })

  it("rejects a failed order", () => {
    expect(canMarkRefunded("failed")).toMatchObject({ error: expect.any(String) })
  })
})

describe("canResendActivation", () => {
  it("allows resending when the account has no usable password (activation pending)", () => {
    expect(canResendActivation({ passwordHash: null })).toEqual({ ok: true })
  })

  it("refuses resending once a password is set (idempotent guard, no token spam)", () => {
    expect(canResendActivation({ passwordHash: "$2a$hash" })).toMatchObject({
      error: expect.any(String),
    })
  })

  it("treats an empty-string hash as no usable password", () => {
    // A "" hash is falsy → still activation-pending (never a valid bcrypt hash).
    expect(canResendActivation({ passwordHash: "" })).toEqual({ ok: true })
  })
})
