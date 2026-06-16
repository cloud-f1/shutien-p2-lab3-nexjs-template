import { describe, expect, it } from "vitest"

import {
  diffSubscription,
  reconcileBatch,
  type GatewaySubState,
  type StoredSubState,
} from "./reconcile-utils"

const EPOCH = 1_700_000_000
const EPOCH_DATE = new Date(EPOCH * 1000)

describe("reconcile-utils", () => {
  describe("diffSubscription", () => {
    it("reports no update when stored matches gateway", () => {
      const stored: StoredSubState = {
        providerSubId: "sub_1",
        status: "active",
        currentPeriodEnd: EPOCH_DATE,
        cancelAt: null,
      }
      const gateway: GatewaySubState = {
        providerSubId: "sub_1",
        status: "active",
        currentPeriodEnd: EPOCH,
        cancelAt: null,
      }
      const d = diffSubscription(stored, gateway)
      expect(d.needsUpdate).toBe(false)
      expect(d.patch).toBeUndefined()
      expect(d.reasons).toEqual([])
    })

    it("detects a status drift (missed webhook → past_due)", () => {
      const stored: StoredSubState = {
        providerSubId: "sub_2",
        status: "active",
        currentPeriodEnd: EPOCH_DATE,
        cancelAt: null,
      }
      const gateway: GatewaySubState = {
        providerSubId: "sub_2",
        status: "past_due",
        currentPeriodEnd: EPOCH,
        cancelAt: null,
      }
      const d = diffSubscription(stored, gateway)
      expect(d.needsUpdate).toBe(true)
      expect(d.patch?.status).toBe("past_due")
      expect(d.reasons.some((r) => r.includes("status"))).toBe(true)
    })

    it("detects a current_period_end drift and yields the repaired Date", () => {
      const stored: StoredSubState = {
        providerSubId: "sub_3",
        status: "active",
        currentPeriodEnd: EPOCH_DATE,
        cancelAt: null,
      }
      const newEpoch = EPOCH + 30 * 86_400
      const gateway: GatewaySubState = {
        providerSubId: "sub_3",
        status: "active",
        currentPeriodEnd: newEpoch,
        cancelAt: null,
      }
      const d = diffSubscription(stored, gateway)
      expect(d.needsUpdate).toBe(true)
      expect(d.patch?.currentPeriodEnd?.getTime()).toBe(newEpoch * 1000)
    })

    it("detects a cancel_at being set", () => {
      const stored: StoredSubState = {
        providerSubId: "sub_4",
        status: "active",
        currentPeriodEnd: EPOCH_DATE,
        cancelAt: null,
      }
      const gateway: GatewaySubState = {
        providerSubId: "sub_4",
        status: "active",
        currentPeriodEnd: EPOCH,
        cancelAt: EPOCH + 86_400,
      }
      const d = diffSubscription(stored, gateway)
      expect(d.needsUpdate).toBe(true)
      expect(d.patch?.cancelAt?.getTime()).toBe((EPOCH + 86_400) * 1000)
    })

    it("treats both-null period ends as equal (no drift)", () => {
      const stored: StoredSubState = {
        providerSubId: "sub_5",
        status: "active",
        currentPeriodEnd: null,
        cancelAt: null,
      }
      const gateway: GatewaySubState = {
        providerSubId: "sub_5",
        status: "active",
        currentPeriodEnd: null,
        cancelAt: null,
      }
      expect(diffSubscription(stored, gateway).needsUpdate).toBe(false)
    })
  })

  describe("reconcileBatch", () => {
    it("counts checked + updated across a batch", () => {
      const stored: StoredSubState[] = [
        { providerSubId: "a", status: "active", currentPeriodEnd: EPOCH_DATE, cancelAt: null },
        { providerSubId: "b", status: "active", currentPeriodEnd: EPOCH_DATE, cancelAt: null },
      ]
      const gateway: GatewaySubState[] = [
        { providerSubId: "a", status: "active", currentPeriodEnd: EPOCH, cancelAt: null },
        { providerSubId: "b", status: "canceled", currentPeriodEnd: EPOCH, cancelAt: null },
      ]
      const summary = reconcileBatch(stored, gateway)
      expect(summary.checked).toBe(2)
      expect(summary.updated).toBe(1)
    })

    it("skips rows missing from the gateway snapshot (counts as checked, not updated)", () => {
      const stored: StoredSubState[] = [
        { providerSubId: "x", status: "active", currentPeriodEnd: EPOCH_DATE, cancelAt: null },
      ]
      const summary = reconcileBatch(stored, [])
      expect(summary.checked).toBe(1)
      expect(summary.updated).toBe(0)
      expect(summary.decisions[0]!.reasons[0]).toContain("not found in gateway")
    })
  })
})
