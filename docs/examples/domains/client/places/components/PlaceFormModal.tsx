import { useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { placeCreateSchema, placeUpdateSchema } from "../../../schemas/place";
import type { PlaceCreate, PlaceRead } from "../../../schemas/place";
import { useFocusTrap } from "../../../hooks/useFocusTrap";

interface PlaceFormModalProps {
  place?: PlaceRead | null;
  isPending: boolean;
  error: string | null;
  onSubmit: (data: PlaceCreate) => void;
  onClose: () => void;
}

export default function PlaceFormModal({
  place,
  isPending,
  error,
  onSubmit,
  onClose,
}: PlaceFormModalProps) {
  const isEdit = !!place;
  const schema = isEdit ? placeUpdateSchema : placeCreateSchema;
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, true, onClose);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PlaceCreate>({
    resolver: zodResolver(schema),
    defaultValues: place
      ? {
          name: place.name,
          address: place.address ?? undefined,
          description: place.description ?? undefined,
          latitude: place.latitude,
          longitude: place.longitude,
          category: place.category ?? undefined,
        }
      : {
          latitude: 0,
          longitude: 0,
        },
  });

  return (
    <div
      className="place-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Edit place" : "Add place"}
      ref={modalRef}
    >
      <div className="place-modal">
        <div className="place-modal-title">
          {isEdit ? "Edit Place" : "Add Place"}
        </div>

        {error && (
          <div className="form-banner error" role="alert">
            {error}
          </div>
        )}

        <form
          className="place-modal-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div className="form-field">
            <label className="form-label" htmlFor="place-name">
              Name *
            </label>
            <input
              id="place-name"
              className={`form-input ${errors.name ? "error" : ""}`}
              placeholder="Place name"
              aria-describedby={errors.name ? "place-name-error" : undefined}
              aria-invalid={errors.name ? true : undefined}
              {...register("name")}
            />
            {errors.name && (
              <span className="form-error" id="place-name-error">{errors.name.message}</span>
            )}
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="place-address">
              Address
            </label>
            <input
              id="place-address"
              className="form-input"
              placeholder="123 Main St"
              {...register("address")}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="place-description">
              Description
            </label>
            <textarea
              id="place-description"
              className="form-input"
              placeholder="Optional description"
              rows={3}
              {...register("description")}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-field">
              <label className="form-label" htmlFor="place-lat">
                Latitude *
              </label>
              <input
                id="place-lat"
                type="number"
                step="any"
                className={`form-input ${errors.latitude ? "error" : ""}`}
                placeholder="25.033"
                aria-describedby={errors.latitude ? "place-lat-error" : undefined}
                aria-invalid={errors.latitude ? true : undefined}
                {...register("latitude", { valueAsNumber: true })}
              />
              {errors.latitude && (
                <span className="form-error" id="place-lat-error">{errors.latitude.message}</span>
              )}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="place-lng">
                Longitude *
              </label>
              <input
                id="place-lng"
                type="number"
                step="any"
                className={`form-input ${errors.longitude ? "error" : ""}`}
                placeholder="121.565"
                aria-describedby={errors.longitude ? "place-lng-error" : undefined}
                aria-invalid={errors.longitude ? true : undefined}
                {...register("longitude", { valueAsNumber: true })}
              />
              {errors.longitude && (
                <span className="form-error" id="place-lng-error">{errors.longitude.message}</span>
              )}
            </div>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="place-category">
              Category
            </label>
            <input
              id="place-category"
              className="form-input"
              placeholder="e.g. restaurant, office"
              {...register("category")}
            />
          </div>

          <div className="place-modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <span className="btn-spinner" /> Saving...
                </>
              ) : isEdit ? (
                "Update Place"
              ) : (
                "Add Place"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
