import type { PlaceRead } from "../../../schemas/place";

interface PlaceDetailProps {
  place: PlaceRead;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function PlaceDetail({
  place,
  onBack,
  onEdit,
  onDelete,
}: PlaceDetailProps) {
  return (
    <div className="place-detail">
      <div className="place-detail-header">
        <div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onBack}
            style={{ marginBottom: 8 }}
          >
            <span aria-hidden="true">{"\u2190"}</span> Back to list
          </button>
          <div className="place-detail-title">{place.name}</div>
          {place.category && (
            <span className="c-badge c-badge-muted" style={{ marginTop: 8 }}>
              {place.category}
            </span>
          )}
        </div>
        <div className="place-detail-actions">
          <button className="btn btn-secondary btn-sm" onClick={onEdit}>
            Edit
          </button>
          <button className="btn btn-danger btn-sm" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      <div className="c-panel">
        <div className="place-detail-fields">
          <div className="place-detail-field">
            <span className="place-detail-label">Address</span>
            <span className="place-detail-value">
              {place.address || "\u2014"}
            </span>
          </div>

          <div className="place-detail-field">
            <span className="place-detail-label">Description</span>
            <span className="place-detail-value">
              {place.description || "\u2014"}
            </span>
          </div>

          <div className="place-detail-field">
            <span className="place-detail-label">Latitude</span>
            <span className="place-detail-value places-coords">
              {place.latitude}
            </span>
          </div>

          <div className="place-detail-field">
            <span className="place-detail-label">Longitude</span>
            <span className="place-detail-value places-coords">
              {place.longitude}
            </span>
          </div>

          <div className="place-detail-field">
            <span className="place-detail-label">Created</span>
            <span className="place-detail-value">
              {new Date(place.created_at).toLocaleString()}
            </span>
          </div>

          <div className="place-detail-field">
            <span className="place-detail-label">Last Updated</span>
            <span className="place-detail-value">
              {new Date(place.updated_at).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
