/**
 * E369 — the shadow validators these schemas replace, pinned as behaviour.
 *
 * E348/E352 removed `validateItemTitle()` because a hand-rolled checker had
 * drifted from its schema. That fix landed on items only; these cases pin the
 * same treatment for the API-key / webhook / team entry points, and in
 * particular the one that was not merely drift but a silent privilege change.
 */
import { describe, expect, it } from "vitest"

import {
  createApiKeySchema,
  createSystemWebhookSchema,
  createWebhookSchema,
  inviteMemberSchema,
} from "./system"

const URL_OK = "https://hooks.example.com/endpoint"

describe("createWebhookSchema — events are rejected, never rewritten", () => {
  it("REJECTS an invalid event name instead of substituting ['*']", () => {
    // The old sanitizeEvents() filtered unknown names out and, finding the set
    // empty, returned ["*"] — turning one typo into a subscription to EVERY
    // event on an endpoint that ships data to a third-party URL. Silently.
    const res = createWebhookSchema.safeParse({ url: URL_OK, events: ["user.craeted"] })
    expect(res.success).toBe(false)
  })

  it("REJECTS an empty event list instead of substituting ['*']", () => {
    expect(createWebhookSchema.safeParse({ url: URL_OK, events: [] }).success).toBe(false)
  })

  it("accepts '*' only when the caller asks for it EXPLICITLY", () => {
    const res = createWebhookSchema.safeParse({ url: URL_OK, events: ["*"] })
    expect(res.success).toBe(true)
    expect(res.success && res.data.events).toEqual(["*"])
  })

  it("collapses duplicates", () => {
    const res = createWebhookSchema.safeParse({
      url: URL_OK,
      events: ["user.created", "user.created"],
    })
    expect(res.success && res.data.events).toEqual(["user.created"])
  })

  it("rejects non-HTTPS and over-long URLs", () => {
    expect(createWebhookSchema.safeParse({ url: "http://x.example", events: ["*"] }).success).toBe(false)
    expect(createWebhookSchema.safeParse({ url: "not a url", events: ["*"] }).success).toBe(false)
    const long = `https://x.example/${"a".repeat(2100)}`
    expect(createWebhookSchema.safeParse({ url: long, events: ["*"] }).success).toBe(false)
  })
})

describe("createSystemWebhookSchema", () => {
  it("defaults to order.completed only when events is ABSENT", () => {
    const res = createSystemWebhookSchema.safeParse({ url: URL_OK })
    expect(res.success && res.data.events).toEqual(["order.completed"])
  })

  it("still REJECTS an explicitly-supplied invalid list", () => {
    expect(createSystemWebhookSchema.safeParse({ url: URL_OK, events: ["nope"] }).success).toBe(false)
  })

  it("does not accept user-scope events", () => {
    expect(
      createSystemWebhookSchema.safeParse({ url: URL_OK, events: ["user.created"] }).success,
    ).toBe(false)
  })
})

describe("inviteMemberSchema — one definition of a valid email", () => {
  // The regex actions/team.ts used before E369. Reproduced here so the drift it
  // caused is demonstrated rather than asserted — a test that merely compared
  // the new schema against z.string().email() would be tautological (they are
  // the same call) and could never fail.
  const OLD_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  it("closes a real disagreement between the old regex and the project rule", () => {
    // At least one input the old local regex accepted and the project-wide rule
    // rejects. Both halves are asserted, so this fails if either side changes.
    const disagreements = ["a@b.c", "user@localhost.x", "a@b..c"].filter(
      (v) => OLD_EMAIL_RE.test(v) !== z_email_ok(v),
    )
    expect(disagreements.length).toBeGreaterThan(0)

    // The schema now follows the project rule for every one of them.
    for (const v of disagreements) {
      const viaSchema = inviteMemberSchema.safeParse({ email: v, role: "editor" }).success
      expect(viaSchema).toBe(z_email_ok(v))
      expect(viaSchema).not.toBe(OLD_EMAIL_RE.test(v))
    }
  })

  it("normalises case and whitespace", () => {
    const res = inviteMemberSchema.safeParse({ email: "  Ada@Example.COM ", role: "admin" })
    expect(res.success && res.data.email).toBe("ada@example.com")
  })

  it("rejects an unknown role", () => {
    expect(inviteMemberSchema.safeParse({ email: "a@example.com", role: "root" }).success).toBe(false)
  })
})

describe("createApiKeySchema", () => {
  it("trims and requires a name", () => {
    expect(createApiKeySchema.safeParse({ name: "   " }).success).toBe(false)
    const res = createApiKeySchema.safeParse({ name: "  prod key  " })
    expect(res.success && res.data.name).toBe("prod key")
  })

  it("caps the length at 100", () => {
    expect(createApiKeySchema.safeParse({ name: "a".repeat(101) }).success).toBe(false)
    expect(createApiKeySchema.safeParse({ name: "a".repeat(100) }).success).toBe(true)
  })

  it("rejects non-string input (FormData.get can return File | null)", () => {
    expect(createApiKeySchema.safeParse({ name: null }).success).toBe(false)
  })
})

/** The project-wide email rule, evaluated independently of the schema above. */
function z_email_ok(value: string): boolean {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { z } = require("zod") as typeof import("zod")
  return z.string().email().safeParse(value).success
}
