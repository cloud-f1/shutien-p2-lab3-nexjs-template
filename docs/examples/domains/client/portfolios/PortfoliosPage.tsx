import { useState, useRef } from "react";
import { extractApiDetail } from "../../api/errors";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import {
  usePortfoliosList,
  usePortfolioDetail,
  usePortfolioCreate,
  usePortfolioUpdate,
  usePortfolioDelete,
} from "../../hooks/usePortfolios";
import type { PortfolioRead, PortfolioCreate } from "../../schemas/portfolio";
import PortfoliosList from "./components/PortfoliosList";
import PortfolioDetailView from "./components/PortfolioDetail";
import PortfolioFormModal from "./components/PortfolioFormModal";
import "./Portfolios.css";

type SubView = "list" | "detail" | "form" | "delete";

export default function PortfoliosPage() {
  const [page, setPage] = useState(1);
  const [subView, setSubView] = useState<SubView>("list");
  const [selectedPortfolio, setSelectedPortfolio] =
    useState<PortfolioRead | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const deleteModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(deleteModalRef, subView === "delete", () => setSubView("detail"));

  const { data, isLoading, isError } = usePortfoliosList({
    page,
    page_size: 20,
  });
  const {
    data: portfolioDetail,
    isLoading: isDetailLoading,
  } = usePortfolioDetail(selectedPortfolio?.id ?? "");
  const createMutation = usePortfolioCreate();
  const updateMutation = usePortfolioUpdate();
  const deleteMutation = usePortfolioDelete();

  const handleSelect = (portfolio: PortfolioRead) => {
    setSelectedPortfolio(portfolio);
    setSubView("detail");
  };

  const handleOpenForm = (portfolio?: PortfolioRead) => {
    setSelectedPortfolio(portfolio ?? null);
    setFormError(null);
    setSubView("form");
  };

  const handleFormSubmit = (formData: PortfolioCreate) => {
    setFormError(null);
    if (selectedPortfolio) {
      updateMutation.mutate(
        { id: selectedPortfolio.id, data: formData },
        {
          onSuccess: () => {
            setSubView("list");
            setSelectedPortfolio(null);
          },
          onError: (err) => {
            setFormError(
              extractApiDetail(err) || "Failed to update portfolio.",
            );
          },
        },
      );
    } else {
      createMutation.mutate(formData, {
        onSuccess: () => {
          setSubView("list");
          setSelectedPortfolio(null);
        },
        onError: (err) => {
          setFormError(
            extractApiDetail(err) || "Failed to create portfolio.",
          );
        },
      });
    }
  };

  const handleDelete = () => {
    if (!selectedPortfolio) return;
    deleteMutation.mutate(selectedPortfolio.id, {
      onSuccess: () => {
        setSubView("list");
        setSelectedPortfolio(null);
      },
    });
  };

  if (isLoading) {
    return <div className="portfolios-loading" role="status" aria-live="polite">Loading portfolios...</div>;
  }

  if (isError) {
    return (
      <div className="portfolios-error" role="alert">
        Failed to load portfolios. Please try again.
      </div>
    );
  }

  return (
    <div className="portfolios-page">
      {subView === "detail" && selectedPortfolio ? (
        isDetailLoading ? (
          <div className="portfolios-loading" role="status" aria-live="polite">Loading portfolio details...</div>
        ) : portfolioDetail ? (
          <PortfolioDetailView
            portfolio={portfolioDetail}
            onBack={() => {
              setSubView("list");
              setSelectedPortfolio(null);
            }}
            onEdit={() => handleOpenForm(selectedPortfolio)}
            onDelete={() => setSubView("delete")}
          />
        ) : null
      ) : (
        data && (
          <PortfoliosList
            data={data}
            page={page}
            onPageChange={setPage}
            onSelect={handleSelect}
            onCreate={() => handleOpenForm()}
          />
        )
      )}

      {subView === "form" && (
        <PortfolioFormModal
          portfolio={selectedPortfolio}
          isPending={createMutation.isPending || updateMutation.isPending}
          error={formError}
          onSubmit={handleFormSubmit}
          onClose={() => {
            setSubView(selectedPortfolio ? "detail" : "list");
            setFormError(null);
          }}
        />
      )}

      {subView === "delete" && selectedPortfolio && (
        <div
          className="portfolio-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSubView("detail");
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Delete confirmation"
          ref={deleteModalRef}
        >
          <div className="portfolio-modal">
            <div className="portfolio-modal-title">Delete Portfolio</div>
            <div className="portfolio-delete-text">
              Are you sure you want to delete{" "}
              <span className="portfolio-delete-name">
                {selectedPortfolio.name}
              </span>
              ? This action cannot be undone.
            </div>
            <div className="portfolio-modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setSubView("detail")}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
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
      )}
    </div>
  );
}
