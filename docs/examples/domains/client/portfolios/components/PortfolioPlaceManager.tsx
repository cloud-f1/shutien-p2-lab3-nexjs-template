import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { portfolioPlaceCreateSchema } from "../../../schemas/portfolio";
import type {
  PortfolioPlaceRead,
  PortfolioPlaceCreate,
} from "../../../schemas/portfolio";
import type { PlaceRead } from "../../../schemas/place";
import { formatCurrency } from "../../../utils/formatCurrency";
import { gainDirection } from "../../../utils/formatCurrency";

interface PortfolioPlaceManagerProps {
  places: PortfolioPlaceRead[];
  availablePlaces: PlaceRead[];
  onAdd: (data: PortfolioPlaceCreate) => void;
  onRemove: (placeId: string) => void;
  isAdding: boolean;
  isRemoving: boolean;
}

export default function PortfolioPlaceManager({
  places,
  availablePlaces,
  onAdd,
  onRemove,
  isAdding,
  isRemoving,
}: PortfolioPlaceManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Filter out places already in the portfolio
  const placesInPortfolio = new Set(places.map((p) => p.place_id));
  const selectablePlaces = availablePlaces.filter(
    (p) => !placesInPortfolio.has(p.id),
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PortfolioPlaceCreate>({
    resolver: zodResolver(portfolioPlaceCreateSchema),
    defaultValues: {
      purchase_price: "0.00",
      current_value: "0.00",
    },
  });

  const handleAdd = (data: PortfolioPlaceCreate) => {
    onAdd(data);
    reset();
    setShowAddForm(false);
  };

  const handleRemove = (placeId: string) => {
    setRemovingId(placeId);
    onRemove(placeId);
  };

  return (
    <div className="c-panel">
      <div className="c-panel-header">
        <div className="c-panel-title">Places in Portfolio ({places.length})</div>
        {selectablePlaces.length > 0 && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? "Cancel" : "+ Add Place"}
          </button>
        )}
      </div>

      {showAddForm && (
        <form
          onSubmit={handleSubmit(handleAdd)}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginBottom: 16,
            padding: 16,
            background: "var(--surface-2)",
            borderRadius: 8,
          }}
        >
          <div className="form-field">
            <label className="form-label" htmlFor="pp-place">
              Place *
            </label>
            <select
              id="pp-place"
              className="form-select place-picker-select"
              {...register("place_id")}
            >
              <option value="">Select a place...</option>
              {selectablePlaces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errors.place_id && (
              <span className="form-error">{errors.place_id.message}</span>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <div className="form-field">
              <label className="form-label" htmlFor="pp-purchase">
                Purchase Price
              </label>
              <input
                id="pp-purchase"
                type="text"
                inputMode="decimal"
                className={`form-input ${errors.purchase_price ? "error" : ""}`}
                placeholder="0.00"
                {...register("purchase_price")}
              />
              {errors.purchase_price && (
                <span className="form-error">
                  {errors.purchase_price.message}
                </span>
              )}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="pp-current">
                Current Value
              </label>
              <input
                id="pp-current"
                type="text"
                inputMode="decimal"
                className={`form-input ${errors.current_value ? "error" : ""}`}
                placeholder="0.00"
                {...register("current_value")}
              />
              {errors.current_value && (
                <span className="form-error">
                  {errors.current_value.message}
                </span>
              )}
            </div>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="pp-notes">
              Notes
            </label>
            <input
              id="pp-notes"
              className="form-input"
              placeholder="Optional notes"
              {...register("notes")}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setShowAddForm(false);
                reset();
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={isAdding}
            >
              {isAdding ? "Adding..." : "Add Place"}
            </button>
          </div>
        </form>
      )}

      {places.length === 0 ? (
        <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-secondary)", fontSize: 14 }}>
          No places in this portfolio yet.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="portfolio-places-table">
            <thead>
              <tr>
                <th>Place</th>
                <th>Purchase Price</th>
                <th>Current Value</th>
                <th>Gain/Loss</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {places.map((pp) => {
                const dir = gainDirection(pp.gain_loss);
                return (
                  <tr key={pp.place_id}>
                    <td>{pp.place.name}</td>
                    <td>{formatCurrency(pp.purchase_price)}</td>
                    <td>{formatCurrency(pp.current_value)}</td>
                    <td>
                      <span className={`gain-${dir}`}>
                        {formatCurrency(pp.gain_loss)}
                      </span>
                    </td>
                    <td>{pp.notes || "\u2014"}</td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRemove(pp.place_id)}
                        disabled={isRemoving && removingId === pp.place_id}
                      >
                        {isRemoving && removingId === pp.place_id
                          ? "..."
                          : "Remove"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
