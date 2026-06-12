import type { PortfolioRead } from "../../../schemas/portfolio";
import type { PaginatedResponse } from "../../../schemas/common";
import { formatCurrency } from "../../../utils/formatCurrency";

interface PortfoliosListProps {
  data: PaginatedResponse<PortfolioRead>;
  page: number;
  onPageChange: (page: number) => void;
  onSelect: (portfolio: PortfolioRead) => void;
  onCreate: () => void;
}

export default function PortfoliosList({
  data,
  page,
  onPageChange,
  onSelect,
  onCreate,
}: PortfoliosListProps) {
  if (data.items.length === 0) {
    return (
      <div className="c-panel">
        <div className="portfolios-empty">
          <div className="portfolios-empty-icon" aria-hidden="true">
            {"\uD83D\uDCCA"}
          </div>
          <div className="portfolios-empty-title">No portfolios yet</div>
          <div className="portfolios-empty-text">
            Create your first portfolio to start tracking your investments.
          </div>
          <button className="btn btn-primary" onClick={onCreate}>
            + Create Portfolio
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="c-panel-header">
        <div className="c-panel-title">Portfolios ({data.total})</div>
        <button className="btn btn-primary btn-sm" onClick={onCreate}>
          + Create Portfolio
        </button>
      </div>

      <div className="portfolios-grid">
        {data.items.map((portfolio) => (
          <div
            key={portfolio.id}
            className="c-card portfolio-card"
            onClick={() => onSelect(portfolio)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSelect(portfolio);
            }}
            role="button"
          >
            <div className="portfolio-card-name">{portfolio.name}</div>
            {portfolio.description && (
              <div className="portfolio-card-desc">{portfolio.description}</div>
            )}
            <div className="portfolio-card-stats">
              <div className="portfolio-card-stat">
                <span className="portfolio-card-stat-label">Total Value</span>
                <span className="portfolio-card-stat-value">
                  {formatCurrency(portfolio.total_value)}
                </span>
              </div>
              <div className="portfolio-card-stat">
                <span className="portfolio-card-stat-label">Places</span>
                <span className="portfolio-card-stat-value">
                  {portfolio.place_count}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.pages > 1 && (
        <div className="portfolios-pagination">
          <button
            className="btn btn-ghost btn-sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Prev
          </button>
          <span className="portfolios-pagination-info">
            Page {page} of {data.pages}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            disabled={page >= data.pages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
