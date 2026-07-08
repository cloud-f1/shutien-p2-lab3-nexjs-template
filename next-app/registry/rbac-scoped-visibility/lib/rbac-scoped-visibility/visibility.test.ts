import { describe, expect, it } from "vitest"

import { canSeeAssignedRow, filterAssignedRows } from "./visibility"

type Role = "admin" | "editor" | "viewer"

const hasFullVisibility = (role: Role | null | undefined) => role === "admin"

describe("canSeeAssignedRow", () => {
  it("is false with no user", () => {
    expect(canSeeAssignedRow(null, ["u1"], { hasFullVisibility })).toBe(false)
    expect(canSeeAssignedRow(undefined, ["u1"], { hasFullVisibility })).toBe(false)
  })

  it("is false when the user has no id", () => {
    expect(
      canSeeAssignedRow({ id: "", role: "viewer" as Role }, ["u1"], { hasFullVisibility }),
    ).toBe(false)
  })

  it("is true for a full-visibility role regardless of assignment", () => {
    expect(
      canSeeAssignedRow({ id: "u9", role: "admin" as Role }, ["u1", "u2"], { hasFullVisibility }),
    ).toBe(true)
    expect(canSeeAssignedRow({ id: "u9", role: "admin" as Role }, null, { hasFullVisibility })).toBe(
      true,
    )
  })

  it("is fail-closed for a scoped role with no assigneeIds", () => {
    expect(
      canSeeAssignedRow({ id: "u1", role: "editor" as Role }, null, { hasFullVisibility }),
    ).toBe(false)
    expect(
      canSeeAssignedRow({ id: "u1", role: "editor" as Role }, undefined, { hasFullVisibility }),
    ).toBe(false)
  })

  it("is true only when the scoped user's id is in assigneeIds", () => {
    expect(
      canSeeAssignedRow({ id: "u1", role: "editor" as Role }, ["u1", "u2"], { hasFullVisibility }),
    ).toBe(true)
    expect(
      canSeeAssignedRow({ id: "u3", role: "editor" as Role }, ["u1", "u2"], { hasFullVisibility }),
    ).toBe(false)
  })
})

describe("filterAssignedRows", () => {
  it("keeps only rows the user may see", () => {
    const rows = [
      { id: "r1", assigneeIds: ["u1"] },
      { id: "r2", assigneeIds: ["u2"] },
      { id: "r3", assigneeIds: null },
    ]
    const result = filterAssignedRows(rows, { id: "u1", role: "editor" as Role }, {
      hasFullVisibility,
    })
    expect(result.map((r) => r.id)).toEqual(["r1"])
  })

  it("keeps every row for a full-visibility role", () => {
    const rows = [
      { id: "r1", assigneeIds: ["u1"] },
      { id: "r2", assigneeIds: null },
    ]
    const result = filterAssignedRows(rows, { id: "u9", role: "admin" as Role }, {
      hasFullVisibility,
    })
    expect(result.map((r) => r.id)).toEqual(["r1", "r2"])
  })
})
