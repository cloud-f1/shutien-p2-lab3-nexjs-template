import { useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  portfolioCreateSchema,
  portfolioUpdateSchema,
} from "../../../schemas/portfolio";
import type { PortfolioCreate, PortfolioRead } from "../../../schemas/portfolio";
import { useFocusTrap } from "../../../hooks/useFocusTrap";

interface PortfolioFormModalProps {
  portfolio?: PortfolioRead | null;
  isPending: boolean;
  error: string | null;
  onSubmit: (data: PortfolioCreate) => void;
  onClose: () => void;
}

export default function PortfolioFormModal({
  portfolio,
  isPending,
  error,
  onSubmit,
  onClose,
}: PortfolioFormModalProps) {
  const isEdit = !!portfolio;
  const schema = isEdit ? portfolioUpdateSchema : portfolioCreateSchema;
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, true, onClose);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PortfolioCreate>({
    resolver: zodResolver(schema),
    defaultValues: portfolio
      ? {
          name: portfolio.name,
          description: portfolio.description ?? undefined,
        }
      : {},
  });

  return (
    <div
      className="portfolio-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Edit portfolio" : "Create portfolio"}
      ref={modalRef}
    >
      <div className="portfolio-modal">
        <div className="portfolio-modal-title">
          {isEdit ? "Edit Portfolio" : "Create Portfolio"}
        </div>

        {error && (
          <div className="form-banner error" role="alert">
            {error}
          </div>
        )}

        <form
          className="portfolio-modal-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div className="form-field">
            <label className="form-label" htmlFor="portfolio-name">
              Name *
            </label>
            <input
              id="portfolio-name"
              className={`form-input ${errors.name ? "error" : ""}`}
              placeholder="Portfolio name"
              aria-describedby={errors.name ? "portfolio-name-error" : undefined}
              aria-invalid={errors.name ? true : undefined}
              {...register("name")}
            />
            {errors.name && (
              <span className="form-error" id="portfolio-name-error">{errors.name.message}</span>
            )}
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="portfolio-desc">
              Description
            </label>
            <textarea
              id="portfolio-desc"
              className="form-input"
              placeholder="Optional description"
              rows={3}
              {...register("description")}
            />
          </div>

          <div className="portfolio-modal-actions">
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
                "Update Portfolio"
              ) : (
                "Create Portfolio"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
