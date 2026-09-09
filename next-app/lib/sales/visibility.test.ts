/**
 * E332 — pure visibility decision for the structured sales-page renderer.
 */
import { describe, expect, it } from "vitest"

import { canServeSalesPageRow, isSalesPageStatusVisible } from "./visibility"

describe("canServeSalesPageRow", () => {
  it("serves a published structured page regardless of preview token", () => {
    expect(canServeSalesPageRow({ status: "published", renderMode: "structured" }, false)).toBe(true)
    expect(canServeSalesPageRow({ status: "published", renderMode: "structured" }, true)).toBe(true)
  })

  it("hides a draft page without a valid preview token", () => {
    expect(canServeSalesPageRow({ status: "draft", renderMode: "structured" }, false)).toBe(false)
  })

  it("serves a draft page with a valid preview token", () => {
    expect(canServeSalesPageRow({ status: "draft", renderMode: "structured" }, true)).toBe(true)
  })

  it("never serves a custom render-mode page from the structured renderer", () => {
    expect(canServeSalesPageRow({ status: "published", renderMode: "custom" }, true)).toBe(false)
    expect(canServeSalesPageRow({ status: "draft", renderMode: "custom" }, true)).toBe(false)
  })
})

/**
 * E367 — the status rule is now SHARED by both render paths. Before E367 it
 * lived only inside canServeSalesPageRow, which short-circuits `custom` to
 * false; the custom route therefore consulted no status gate at all and served
 * draft pages publicly. These cases pin the extracted rule.
 */
describe("isSalesPageStatusVisible (E367 — shared by structured AND custom)", () => {
  it("serves published regardless of preview token", () => {
    expect(isSalesPageStatusVisible("published", false)).toBe(true)
    expect(isSalesPageStatusVisible("published", true)).toBe(true)
  })

  it("hides draft without a valid preview token", () => {
    expect(isSalesPageStatusVisible("draft", false)).toBe(false)
  })

  it("serves draft with a valid preview token", () => {
    expect(isSalesPageStatusVisible("draft", true)).toBe(true)
  })
})

describe("canServeSalesPageRow — custom × status × preview (AC 7)", () => {
  // The structured renderer must refuse custom rows in ALL six combinations:
  // that guard is about WHICH renderer runs, and is independent of status.
  for (const status of ["published", "draft"] as const) {
    for (const preview of [true, false]) {
      it(`custom/${status}/preview=${preview} is never served by the structured renderer`, () => {
        expect(canServeSalesPageRow({ status, renderMode: "custom" }, preview)).toBe(false)
      })
    }
  }

  // ...while the structured path keeps honouring status exactly as before.
  it("structured rows still follow the status rule", () => {
    expect(canServeSalesPageRow({ status: "published", renderMode: "structured" }, false)).toBe(true)
    expect(canServeSalesPageRow({ status: "draft", renderMode: "structured" }, false)).toBe(false)
  })
})
