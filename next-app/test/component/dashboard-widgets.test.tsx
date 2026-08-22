// @vitest-environment jsdom
/**
 * dashboard-widgets.test.tsx (E337) — coverage for the domain-neutral
 * dashboard widget kit: `StatCard` tone→class mapping, `AttentionCard`'s
 * empty state, and `GreetingHeader`'s `formatLongDate` across month/year
 * boundaries. `RowLink` (a real `next/link`) renders fine under jsdom without
 * a mounted App Router — Next's `<Link>` degrades to a plain anchor outside
 * a router context, which is exactly the behavior these href-focus tests
 * rely on.
 */
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import { StatCard } from "@/components/dashboard/stat-card"
import { AttentionCard } from "@/components/dashboard/attention-card"
import { GreetingHeader, formatLongDate } from "@/components/dashboard/greeting-header"

describe("StatCard — tone → class mapping", () => {
  it("success tone renders the success text color, untinted background", () => {
    render(<StatCard tone="success" label="已完成" value={12} />)
    expect(screen.getByText("12")).toHaveClass("text-success")
  })

  it("warning tone with a positive value gets the warning tint background", () => {
    render(<StatCard tone="warning" label="待處理" value={3} />)
    const value = screen.getByText("3")
    expect(value).toHaveClass("text-warning")
    // The tint lives on the Card wrapper, two levels up from the value text.
    expect(value.parentElement).toHaveClass("bg-warning/8")
  })

  it("warning tone with a zero value does NOT get tinted (only real counts get painted)", () => {
    render(<StatCard tone="warning" label="待處理" value={0} />)
    const value = screen.getByText("0")
    expect(value.parentElement).not.toHaveClass("bg-warning/8")
  })

  it("danger tone with a positive value gets the destructive tint background", () => {
    render(<StatCard tone="danger" label="逾期" value={5} />)
    const value = screen.getByText("5")
    expect(value).toHaveClass("text-destructive")
    expect(value.parentElement).toHaveClass("bg-destructive/8")
  })

  it("muted tone renders the muted-foreground text color", () => {
    render(<StatCard tone="muted" label="未編輯" value={7} />)
    expect(screen.getByText("7")).toHaveClass("text-muted-foreground")
  })

  it("info tone renders the info text color", () => {
    render(<StatCard tone="info" label="已編輯" value={9} />)
    expect(screen.getByText("9")).toHaveClass("text-info")
  })

  it("with an href, the whole card is wrapped in a real, keyboard-focusable link", () => {
    render(<StatCard tone="info" label="項目" value={42} href="/dashboard/items" ariaLabel="項目 42" />)
    const link = screen.getByRole("link", { name: "項目 42" })
    expect(link.tagName).toBe("A")
    expect(link).toHaveAttribute("href", "/dashboard/items")
    expect(link).toContainElement(screen.getByText("42"))
  })

  it("without an href, no link is rendered", () => {
    render(<StatCard tone="info" label="項目" value={42} />)
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
})

describe("AttentionCard — empty state", () => {
  it("shows emptyText instead of a blank card when every group has no rows", () => {
    render(
      <AttentionCard
        title="需要注意"
        groups={[{ tone: "warning", heading: "逾期", rows: [] }]}
        emptyText="目前沒有需要注意的項目"
      />,
    )
    expect(screen.getByText("目前沒有需要注意的項目")).toBeInTheDocument()
    expect(screen.queryByText("逾期")).not.toBeInTheDocument()
  })

  it("renders group headings and rows when data is present", () => {
    render(
      <AttentionCard
        title="需要注意"
        groups={[
          {
            tone: "warning",
            heading: "逾期",
            rows: [{ id: "1", label: "案件 A", meta: "3 天未更新", href: "/dashboard/items?edit=1" }],
          },
        ]}
        emptyText="目前沒有需要注意的項目"
      />,
    )
    expect(screen.getByText("逾期")).toBeInTheDocument()
    expect(screen.getByText("案件 A")).toBeInTheDocument()
    expect(screen.getByText("3 天未更新")).toBeInTheDocument()
    expect(screen.queryByText("目前沒有需要注意的項目")).not.toBeInTheDocument()
  })
})

describe("GreetingHeader — formatLongDate", () => {
  it("formats a plain mid-month date with the correct weekday", () => {
    // 2026-08-22 is a Saturday.
    expect(formatLongDate("2026-08-22")).toBe("2026 年 8 月 22 日（六）")
  })

  it("handles a month boundary (last day of a 30-day month → does not roll over)", () => {
    // 2026-06-30 is a Tuesday.
    expect(formatLongDate("2026-06-30")).toBe("2026 年 6 月 30 日（二）")
  })

  it("handles a year boundary (Dec 31 → Jan 1)", () => {
    // 2026-12-31 is a Thursday; 2027-01-01 is a Friday.
    expect(formatLongDate("2026-12-31")).toBe("2026 年 12 月 31 日（四）")
    expect(formatLongDate("2027-01-01")).toBe("2027 年 1 月 1 日（五）")
  })

  it("renders the greeting heading and the formatted date", () => {
    render(<GreetingHeader name="測試使用者" today="2026-08-22" />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("測試使用者")
    expect(screen.getByText("2026 年 8 月 22 日（六）")).toBeInTheDocument()
  })
})
