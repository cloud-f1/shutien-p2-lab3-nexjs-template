import { describe, expect, it } from "vitest"

import { unreadCountFrom } from "./notifications-utils"

describe("unreadCountFrom", () => {
  it("counts only unread (readAt == null) notifications", () => {
    const now = new Date()
    const list = [
      { readAt: null },
      { readAt: now },
      { readAt: null },
      { readAt: null },
      { readAt: now },
    ]
    expect(unreadCountFrom(list)).toBe(3)
  })

  it("returns 0 for an empty list", () => {
    expect(unreadCountFrom([])).toBe(0)
  })

  it("returns 0 when all are read", () => {
    const d = new Date()
    expect(unreadCountFrom([{ readAt: d }, { readAt: d }])).toBe(0)
  })
})
