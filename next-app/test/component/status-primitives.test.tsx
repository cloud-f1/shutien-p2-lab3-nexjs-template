// @vitest-environment jsdom
/**
 * status-primitives.test.tsx (E338) — accessibility + boundary-clamping for
 * the four new status primitives: `<StatusLight>`, `<ProgressBar>`,
 * `<TypeChip>`, `<RoleBadge>`.
 */
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import { StatusLight } from "@/components/status-light"
import { ProgressBar } from "@/components/progress-bar"
import { TypeChip } from "@/components/type-chip"
import { RoleBadge } from "@/components/role-badge"

describe("StatusLight", () => {
  it("carries an aria-label describing the status", () => {
    render(<StatusLight tone="success" label="運作中" />)
    expect(screen.getByLabelText("運作中")).toBeInTheDocument()
  })
})

describe("ProgressBar — boundary clamping", () => {
  it("0% renders aria-valuenow=0", () => {
    render(<ProgressBar pct={0} />)
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0")
  })

  it("100% renders aria-valuenow=100", () => {
    render(<ProgressBar pct={100} />)
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100")
  })

  it("a negative pct clamps to 0, not a negative aria-valuenow", () => {
    render(<ProgressBar pct={-42} />)
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0")
  })

  it("a pct over 100 clamps to 100, not overflowing", () => {
    render(<ProgressBar pct={250} />)
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100")
  })

  it("always carries aria-valuemin=0 and aria-valuemax=100", () => {
    render(<ProgressBar pct={55} />)
    const bar = screen.getByRole("progressbar")
    expect(bar).toHaveAttribute("aria-valuemin", "0")
    expect(bar).toHaveAttribute("aria-valuemax", "100")
  })

  it("showLabel renders the clamped percentage as text", () => {
    render(<ProgressBar pct={140} showLabel />)
    expect(screen.getByText("100%")).toBeInTheDocument()
  })
})

describe("TypeChip", () => {
  it("renders the code and name", () => {
    render(<TypeChip code="A1" name="設計監造" />)
    expect(screen.getByText("A1")).toBeInTheDocument()
    expect(screen.getByText("設計監造")).toBeInTheDocument()
  })
})

describe("RoleBadge", () => {
  it("renders the Chinese label for each role from the single lookup table", () => {
    render(
      <>
        <RoleBadge role="admin" />
        <RoleBadge role="editor" />
        <RoleBadge role="viewer" />
      </>,
    )
    expect(screen.getByText("管理員")).toBeInTheDocument()
    expect(screen.getByText("編輯者")).toBeInTheDocument()
    expect(screen.getByText("檢視者")).toBeInTheDocument()
  })
})
