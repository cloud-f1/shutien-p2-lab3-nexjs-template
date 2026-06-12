// This component is rendered inside DashboardLayout (see App.tsx routing)
import { useState } from "react";
import { extractApiDetail } from "../../api/errors";
import {
  useContactsList,
  useContactCreate,
  useContactUpdate,
  useContactDelete,
} from "../../hooks/useContacts";
import type { ContactRead, ContactCreate } from "../../schemas/contact";
import "./Contacts.css";

export default function ContactsPage() {
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<ContactRead | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, isError } = useContactsList({ page, page_size: 20 });
  const createMutation = useContactCreate();
  const updateMutation = useContactUpdate();
  const deleteMutation = useContactDelete();

  const handleCreate = (formData: ContactCreate) => {
    setFormError(null);
    createMutation.mutate(formData, {
      onSuccess: () => {
        setShowForm(false);
      },
      onError: (err) => {
        setFormError(extractApiDetail(err) || "Failed to create contact.");
      },
    });
  };

  const handleUpdate = (formData: ContactCreate) => {
    if (!selectedItem) return;
    setFormError(null);
    updateMutation.mutate(
      { id: selectedItem.id, data: formData },
      {
        onSuccess: () => {
          setShowForm(false);
          setSelectedItem(null);
        },
        onError: (err) => {
          setFormError(extractApiDetail(err) || "Failed to update contact.");
        },
      },
    );
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setSelectedItem(null);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="contacts-loading" role="status" aria-live="polite">
        Loading contacts...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="contacts-error" role="alert">
        Failed to load contacts. Please try again.
      </div>
    );
  }

  return (
    <div className="contacts-page">
      <div className="contacts-header">
        <h2>Contacts ({data?.total ?? 0})</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            setSelectedItem(null);
            setFormError(null);
            setShowForm(true);
          }}
        >
          + Add Contact
        </button>
      </div>

      {data && data.items.length === 0 ? (
        <div className="contacts-empty">
          <div className="contacts-empty-title">No contacts yet</div>
          <div className="contacts-empty-text">
            Create your first contact to get started.
          </div>
        </div>
      ) : (
        <>
          <div className="contacts-table-wrap">
            <table className="contacts-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Company</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((item) => (
                  <tr key={item.id}>
                    <td>{String(item.name ?? "—")}</td>
                    <td>{String(item.email ?? "—")}</td>
                    <td>{String(item.phone ?? "—")}</td>
                    <td>{String(item.company ?? "—")}</td>
                    <td>{String(item.notes_preview ?? "—")}</td>
                    <td>
                      <button
                        className="btn btn-sm"
                        onClick={() => {
                          setSelectedItem(item);
                          setFormError(null);
                          setShowForm(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(item.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.pages > 1 && (
            <div className="contacts-pagination">
              <button
                className="btn btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span className="contacts-pagination-info">
                Page {page} of {data.pages}
              </span>
              <button
                className="btn btn-sm"
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {showForm && (
        <div className="contacts-modal-overlay">
          <div className="contacts-modal">
            <h3 className="contacts-modal-title">
              {selectedItem ? "Edit Contact" : "Add Contact"}
            </h3>
            {formError && (
              <div className="form-error" role="alert">
                {formError}
              </div>
            )}
            {/* Form fields: name (text, required), email (email),
                phone (tel), company (text), notes (textarea) */}
            <div className="contacts-modal-actions">
              <button
                className="btn"
                onClick={() => {
                  setShowForm(false);
                  setFormError(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {selectedItem ? "Update Contact" : "Add Contact"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
