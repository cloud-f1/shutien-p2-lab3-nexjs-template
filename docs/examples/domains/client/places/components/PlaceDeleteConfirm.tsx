import { useRef } from "react";
import { useFocusTrap } from "../../../hooks/useFocusTrap";

interface PlaceDeleteConfirmProps {
  placeName: string;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PlaceDeleteConfirm({
  placeName,
  isPending,
  onConfirm,
  onCancel,
}: PlaceDeleteConfirmProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, true, onCancel);

  return (
    <div
      className="place-modal-overlay"
      ref={modalRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Delete confirmation"
    >
      <div className="place-modal">
        <div className="place-modal-title">Delete Place</div>
        <div className="place-delete-text">
          Are you sure you want to delete{" "}
          <span className="place-delete-name">{placeName}</span>? This action
          cannot be undone.
        </div>
        <div className="place-modal-actions">
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <span className="btn-spinner" /> Deleting...
              </>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
