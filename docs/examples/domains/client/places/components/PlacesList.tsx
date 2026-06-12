import type { PlaceRead } from "../../../schemas/place";
import type { PaginatedResponse } from "../../../schemas/common";

interface PlacesListProps {
  data: PaginatedResponse<PlaceRead>;
  page: number;
  onPageChange: (page: number) => void;
  onSelect: (place: PlaceRead) => void;
  onAdd: () => void;
}

export default function PlacesList({
  data,
  page,
  onPageChange,
  onSelect,
  onAdd,
}: PlacesListProps) {
  if (data.items.length === 0) {
    return (
      <div className="c-panel">
        <div className="places-empty">
          <div className="places-empty-icon" aria-hidden="true">
            {"\uD83D\uDCCD"}
          </div>
          <div className="places-empty-title">No places yet</div>
          <div className="places-empty-text">
            Add your first place to start tracking your investments.
          </div>
          <button className="btn btn-primary" onClick={onAdd}>
            + Add Place
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="c-panel">
      <div className="c-panel-header">
        <div className="c-panel-title">Places ({data.total})</div>
        <button className="btn btn-primary btn-sm" onClick={onAdd}>
          + Add Place
        </button>
      </div>

      <div className="places-table-wrap">
        <table className="places-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Address</th>
              <th>Coordinates</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((place) => (
              <tr
                key={place.id}
                onClick={() => onSelect(place)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSelect(place);
                }}
              >
                <td>{place.name}</td>
                <td>
                  {place.category ? (
                    <span className="c-badge c-badge-muted">{place.category}</span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>{"\u2014"}</span>
                  )}
                </td>
                <td>{place.address || "\u2014"}</td>
                <td>
                  <span className="places-coords">
                    {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
                  </span>
                </td>
                <td>{new Date(place.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.pages > 1 && (
        <div className="places-pagination">
          <button
            className="btn btn-ghost btn-sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Prev
          </button>
          <span className="places-pagination-info">
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
    </div>
  );
}
