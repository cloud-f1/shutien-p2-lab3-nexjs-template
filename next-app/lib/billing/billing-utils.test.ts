import { describe, expect, it } from "vitest"

import { formatAmount, subscriptionStatusLabel } from "./billing-utils"

describe("billing-utils", () => {
  describe("formatAmount", () => {
    it("formats whole-dollar USD amounts without decimals", () => {
      expect(formatAmount(2000)).toBe("$20")
      expect(formatAmount(0)).toBe("$0")
    })

    it("shows two decimals when the cents amount is not a whole major unit", () => {
      expect(formatAmount(1999)).toBe("$19.99")
    })

    it("uses NT$ for TWD and groups thousands", () => {
      expect(formatAmount(100000, "twd")).toBe("NT$1,000")
      expect(formatAmount(100000, "TWD")).toBe("NT$1,000")
    })

    it("defaults to USD when no currency is supplied", () => {
      expect(formatAmount(500)).toBe("$5")
    })
  })

  describe("subscriptionStatusLabel", () => {
    it("maps known statuses to a localized label + tone", () => {
      expect(subscriptionStatusLabel("active")).toEqual({ label: "使用中", tone: "success" })
      expect(subscriptionStatusLabel("past_due")).toEqual({ label: "逾期", tone: "warning" })
      expect(subscriptionStatusLabel("unpaid")).toEqual({ label: "未付款", tone: "danger" })
      expect(subscriptionStatusLabel("canceled")).toEqual({ label: "已取消", tone: "muted" })
    })

    it("falls back to the raw status with a muted tone when unknown", () => {
      expect(subscriptionStatusLabel("something_new")).toEqual({
        label: "something_new",
        tone: "muted",
      })
    })
  })
})
