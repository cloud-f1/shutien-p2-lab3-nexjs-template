import { describe, expect, it } from "vitest"

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  resolvePagination,
  totalPages,
} from "@/lib/billing/pagination"

describe("resolvePagination", () => {
  it("applies defaults for empty params", () => {
    expect(resolvePagination()).toEqual({
      limit: DEFAULT_PAGE_SIZE,
      offset: 0,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    })
  })

  it("computes offset from a 1-based page", () => {
    expect(resolvePagination({ page: 3, pageSize: 20 })).toEqual({
      limit: 20,
      offset: 40,
      page: 3,
      pageSize: 20,
    })
  })

  it("floors page below 1 up to 1 (no negative offset)", () => {
    expect(resolvePagination({ page: 0 }).offset).toBe(0)
    expect(resolvePagination({ page: -5 }).page).toBe(1)
  })

  it("clamps pageSize to MAX_PAGE_SIZE", () => {
    expect(resolvePagination({ pageSize: 10_000 }).pageSize).toBe(MAX_PAGE_SIZE)
  })

  it("clamps pageSize below 1 up to 1", () => {
    expect(resolvePagination({ pageSize: 0 }).pageSize).toBe(1)
    expect(resolvePagination({ pageSize: -3 }).pageSize).toBe(1)
  })

  it("floors fractional page/pageSize", () => {
    const r = resolvePagination({ page: 2.9, pageSize: 15.7 })
    expect(r.page).toBe(2)
    expect(r.pageSize).toBe(15)
    expect(r.offset).toBe(15)
  })

  it("falls back to defaults for NaN / Infinity", () => {
    expect(resolvePagination({ page: NaN, pageSize: NaN })).toEqual({
      limit: DEFAULT_PAGE_SIZE,
      offset: 0,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    })
    expect(resolvePagination({ page: Infinity, pageSize: Infinity }).pageSize).toBe(
      DEFAULT_PAGE_SIZE,
    )
  })
})

describe("totalPages", () => {
  it("rounds up partial pages", () => {
    expect(totalPages(101, 50)).toBe(3)
    expect(totalPages(100, 50)).toBe(2)
    expect(totalPages(1, 50)).toBe(1)
  })

  it("is 0 for an empty or invalid set", () => {
    expect(totalPages(0, 50)).toBe(0)
    expect(totalPages(-5, 50)).toBe(0)
    expect(totalPages(100, 0)).toBe(0)
    expect(totalPages(NaN, 50)).toBe(0)
  })
})
