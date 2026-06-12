import type { PortfolioAnalytics } from "../../../schemas/portfolio";
import { formatCurrency, formatPercent, gainDirection } from "../../../utils/formatCurrency";
import AllocationChart from "./AllocationChart";
import PerformanceChart from "./PerformanceChart";

interface AnalyticsPanelProps {
  analytics: PortfolioAnalytics;
}

export default function AnalyticsPanel({ analytics }: AnalyticsPanelProps) {
  const glDir = gainDirection(analytics.gain_loss);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Stats row */}
      <div className="portfolio-stats-row">
        <div className="c-card c-stat">
          <span className="c-stat-label">Total Value</span>
          <span className="c-stat-value">
            {formatCurrency(analytics.total_value)}
          </span>
        </div>
        <div className="c-card c-stat">
          <span className="c-stat-label">Total Purchase</span>
          <span className="c-stat-value">
            {formatCurrency(analytics.total_purchase)}
          </span>
        </div>
        <div className="c-card c-stat">
          <span className="c-stat-label">Gain/Loss</span>
          <span className={`c-stat-value gain-${glDir}`}>
            {formatCurrency(analytics.gain_loss)}
          </span>
        </div>
        <div className="c-card c-stat">
          <span className="c-stat-label">Return</span>
          <span className={`c-stat-value gain-${glDir}`}>
            {formatPercent(analytics.gain_loss_pct)}
          </span>
        </div>
      </div>

      {/* Charts */}
      <div className="portfolio-charts">
        <div className="c-panel">
          <div className="portfolio-chart-title">Category Allocation</div>
          <AllocationChart data={analytics.category_allocation} />
        </div>
        <div className="c-panel">
          <div className="portfolio-chart-title">Top Performers</div>
          <PerformanceChart data={analytics.top_performers} />
        </div>
      </div>
    </div>
  );
}
