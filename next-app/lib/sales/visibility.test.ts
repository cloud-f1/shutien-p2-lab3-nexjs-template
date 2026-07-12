/**
 * E332 — pure visibility decision for the structured sales-page renderer.
 */
import { describe, expect, it } from "vitest"

import { canServeSalesPageRow } from "./visibility"

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
