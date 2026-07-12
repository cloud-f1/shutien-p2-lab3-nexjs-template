/**
 * Pure pagination math (E331) — NO db import, so it is unit-testable in isolation
 * (mirrors lib/billing/billing-utils.ts). The admin revenue queries
 * (listAllOrders / listAllSubscriptions in lib/billing/queries.ts) resolve their
 * SQL `limit`/`offset` through `resolvePagination` so the bounds logic lives in
 * one tested place instead of being re-derived at each call site.
 */

/** Requested page (1-based) + page size. Both optional; defaults applied. */
export interface PageParams {
  /** 1-based page number. Values < 1, NaN, or non-finite fall back to page 1. */
  page?: number
  /** Rows per page. Clamped to [1, MAX_PAGE_SIZE]; NaN/absent → DEFAULT_PAGE_SIZE. */
  pageSize?: number
}

/** Resolved SQL bounds + the normalized page/pageSize they were derived from. */
export interface PageRange {
  limit: number
  offset: number
  page: number
  pageSize: number
}

export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 500

/** Coerce to a finite integer, falling back when undefined/NaN/±Infinity. */
function toInt(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.floor(value)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Resolve `{ page, pageSize }` into concrete `{ limit, offset, page, pageSize }`.
 * Defensive against bad input (a Server Action is a public POST endpoint): page
 * is floored to >= 1, pageSize is clamped into [1, MAX_PAGE_SIZE].
 */
export function resolvePagination(params: PageParams = {}): PageRange {
  const pageSize = clamp(toInt(params.pageSize, DEFAULT_PAGE_SIZE), 1, MAX_PAGE_SIZE)
  const page = Math.max(1, toInt(params.page, 1))
  return { limit: pageSize, offset: (page - 1) * pageSize, page, pageSize }
}

/** Number of pages needed to show `total` rows at `pageSize` (0 for empty). */
export function totalPages(total: number, pageSize: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0
  if (!Number.isFinite(pageSize) || pageSize <= 0) return 0
  return Math.ceil(total / pageSize)
}
