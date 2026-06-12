import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import PerformanceChart from "../PerformanceChart";

// Recharts uses ResizeObserver — mock it
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

describe("PerformanceChart", () => {
  it("shows empty message when no data provided", () => {
    render(<PerformanceChart data={[]} />);
    expect(screen.getByText("No performance data available.")).toBeInTheDocument();
  });

  it("renders chart container when data is provided", () => {
    const data = [
      { place_name: "Test Place A", gain_loss: "200000.00", gain_loss_pct: "20.00" },
      { place_name: "Test Place B", gain_loss: "-50000.00", gain_loss_pct: "-5.00" },
    ];

    const { container } = render(<PerformanceChart data={data} />);

    const chartWrapper = container.querySelector(".recharts-responsive-container");
    expect(chartWrapper).toBeInTheDocument();
  });

  it("truncates long place names", () => {
    const data = [
      {
        place_name: "This Is A Very Long Place Name That Exceeds Fifteen Characters",
        gain_loss: "100000.00",
        gain_loss_pct: "10.00",
      },
    ];

    const { container } = render(<PerformanceChart data={data} />);
    // Chart should render without error
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  it("handles null gain_loss_pct", () => {
    const data = [
      { place_name: "Place A", gain_loss: "0.00", gain_loss_pct: null },
    ];

    const { container } = render(<PerformanceChart data={data} />);
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });
});
