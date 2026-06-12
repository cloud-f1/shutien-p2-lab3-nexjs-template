import { useState } from "react";
import { extractApiDetail } from "../../api/errors";
import {
  usePlacesList,
  usePlaceCreate,
  usePlaceUpdate,
  usePlaceDelete,
} from "../../hooks/usePlaces";
import type { PlaceRead, PlaceCreate } from "../../schemas/place";
import PlacesList from "./components/PlacesList";
import PlaceDetail from "./components/PlaceDetail";
import PlaceFormModal from "./components/PlaceFormModal";
import PlaceDeleteConfirm from "./components/PlaceDeleteConfirm";
import "./Places.css";

type SubView = "list" | "detail" | "form" | "delete";

export default function PlacesPage() {
  const [page, setPage] = useState(1);
  const [subView, setSubView] = useState<SubView>("list");
  const [selectedPlace, setSelectedPlace] = useState<PlaceRead | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError } = usePlacesList({ page, page_size: 20 });
  const createMutation = usePlaceCreate();
  const updateMutation = usePlaceUpdate();
  const deleteMutation = usePlaceDelete();

  const handleSelect = (place: PlaceRead) => {
    setSelectedPlace(place);
    setSubView("detail");
  };

  const handleOpenForm = (place?: PlaceRead) => {
    setSelectedPlace(place ?? null);
    setFormError(null);
    setSubView("form");
  };

  const handleFormSubmit = (formData: PlaceCreate) => {
    setFormError(null);
    if (selectedPlace) {
      updateMutation.mutate(
        { id: selectedPlace.id, data: formData },
        {
          onSuccess: () => {
            setSubView("list");
            setSelectedPlace(null);
          },
          onError: (err) => {
            setFormError(extractApiDetail(err) || "Failed to update place.");
          },
        },
      );
    } else {
      createMutation.mutate(formData, {
        onSuccess: () => {
          setSubView("list");
          setSelectedPlace(null);
        },
        onError: (err) => {
          setFormError(extractApiDetail(err) || "Failed to create place.");
        },
      });
    }
  };

  const handleDelete = () => {
    if (!selectedPlace) return;
    deleteMutation.mutate(selectedPlace.id, {
      onSuccess: () => {
        setSubView("list");
        setSelectedPlace(null);
      },
    });
  };

  if (isLoading) {
    return <div className="places-loading" role="status" aria-live="polite">Loading places...</div>;
  }

  if (isError) {
    return (
      <div className="places-error" role="alert">
        Failed to load places. Please try again.
      </div>
    );
  }

  return (
    <div className="places-page">
      {subView === "detail" && selectedPlace ? (
        <PlaceDetail
          place={selectedPlace}
          onBack={() => {
            setSubView("list");
            setSelectedPlace(null);
          }}
          onEdit={() => handleOpenForm(selectedPlace)}
          onDelete={() => setSubView("delete")}
        />
      ) : (
        data && (
          <PlacesList
            data={data}
            page={page}
            onPageChange={setPage}
            onSelect={handleSelect}
            onAdd={() => handleOpenForm()}
          />
        )
      )}

      {subView === "form" && (
        <PlaceFormModal
          place={selectedPlace}
          isPending={createMutation.isPending || updateMutation.isPending}
          error={formError}
          onSubmit={handleFormSubmit}
          onClose={() => {
            setSubView(selectedPlace ? "detail" : "list");
            setFormError(null);
          }}
        />
      )}

      {subView === "delete" && selectedPlace && (
        <PlaceDeleteConfirm
          placeName={selectedPlace.name}
          isPending={deleteMutation.isPending}
          onConfirm={handleDelete}
          onCancel={() => setSubView("detail")}
        />
      )}
    </div>
  );
}
