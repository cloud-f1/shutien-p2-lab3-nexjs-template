import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import AllocationChart from "../AllocationChart";

// Recharts uses ResizeObserver — mock it
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

describe("AllocationChart", () => {
  it("shows empty message when no data provided", () => {
    render(<AllocationChart data={[]} />);
    expect(screen.getByText("No allocation data available.")).toBeInTheDocument();
  });

  it("renders chart container when data is provided", () => {
    const data = [
      { category: "residential", percentage: "75.00", value: "1200000.00", count: 1 },
      { category: "commercial", percentage: "25.00", value: "400000.00", count: 1 },
    ];

    const { container } = render(<AllocationChart data={data} />);

    // ResponsiveContainer renders a div wrapper
    const chartWrapper = container.querySelector(".recharts-responsive-container");
    expect(chartWrapper).toBeInTheDocument();
  });
});
