import { describe, expect, it } from "vitest"

import { isUniqueViolation, PG_UNIQUE_VIOLATION } from "./db-errors"

describe("db-errors", () => {
  describe("isUniqueViolation", () => {
    it("detects a Postgres unique violation by SQLSTATE 23505", () => {
      expect(isUniqueViolation({ code: PG_UNIQUE_VIOLATION })).toBe(true)
      expect(isUniqueViolation({ code: "23505" })).toBe(true)
    })

    it("does NOT match on message text (code-based detection only)", () => {
      // A wording change / localized message must not flip detection.
      expect(isUniqueViolation(new Error("duplicate key value violates unique constraint"))).toBe(
        false,
      )
      expect(isUniqueViolation({ message: "unique violation" })).toBe(false)
    })

    it("returns false for other PG error codes", () => {
      expect(isUniqueViolation({ code: "23503" })).toBe(false) // FK violation
      expect(isUniqueViolation({ code: "42P01" })).toBe(false) // undefined table
    })

    it("returns false for null / undefined / primitives", () => {
      expect(isUniqueViolation(null)).toBe(false)
      expect(isUniqueViolation(undefined)).toBe(false)
      expect(isUniqueViolation("23505")).toBe(false)
      expect(isUniqueViolation(23505)).toBe(false)
    })
  })
})
