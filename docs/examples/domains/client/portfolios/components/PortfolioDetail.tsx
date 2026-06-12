import type { PortfolioDetail as PortfolioDetailType } from "../../../schemas/portfolio";
import type { PlaceRead } from "../../../schemas/place";
import {
  usePortfolioAnalytics,
  useAddPlaceToPortfolio,
  useRemovePlaceFromPortfolio,
} from "../../../hooks/usePortfolios";
import { usePlacesList } from "../../../hooks/usePlaces";
import type { PortfolioPlaceCreate } from "../../../schemas/portfolio";
import PortfolioPlaceManager from "./PortfolioPlaceManager";
import AnalyticsPanel from "./AnalyticsPanel";

interface PortfolioDetailProps {
  portfolio: PortfolioDetailType;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function PortfolioDetailView({
  portfolio,
  onBack,
  onEdit,
  onDelete,
}: PortfolioDetailProps) {
  const { data: analytics } = usePortfolioAnalytics(portfolio.id);
  const { data: allPlacesData } = usePlacesList({ page: 1, page_size: 100 });
  const addMutation = useAddPlaceToPortfolio();
  const removeMutation = useRemovePlaceFromPortfolio();

  const availablePlaces: PlaceRead[] = allPlacesData?.items ?? [];

  const handleAddPlace = (data: PortfolioPlaceCreate) => {
    addMutation.mutate({ portfolioId: portfolio.id, data });
  };

  const handleRemovePlace = (placeId: string) => {
    removeMutation.mutate({ portfolioId: portfolio.id, placeId });
  };

  return (
    <div className="portfolio-detail">
      <div className="portfolio-detail-header">
        <div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onBack}
            style={{ marginBottom: 8 }}
          >
            {"\u2190"} Back to list
          </button>
          <div className="portfolio-detail-title">{portfolio.name}</div>
          {portfolio.description && (
            <div className="portfolio-detail-desc">{portfolio.description}</div>
          )}
        </div>
        <div className="portfolio-detail-actions">
          <button className="btn btn-secondary btn-sm" onClick={onEdit}>
            Edit
          </button>
          <button className="btn btn-danger btn-sm" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      {/* Analytics */}
      {analytics && <AnalyticsPanel analytics={analytics} />}

      {/* Places manager */}
      <PortfolioPlaceManager
        places={portfolio.places}
        availablePlaces={availablePlaces}
        onAdd={handleAddPlace}
        onRemove={handleRemovePlace}
        isAdding={addMutation.isPending}
        isRemoving={removeMutation.isPending}
      />
    </div>
  );
}
