// This component is rendered inside DashboardLayout (see App.tsx routing)
import { useState } from "react";
import { extractApiDetail } from "../../api/errors";
import {
  usePostsList,
  usePostCreate,
  usePostUpdate,
  usePostDelete,
} from "../../hooks/usePosts";
import type { PostRead, PostCreate } from "../../schemas/post";
import "./Posts.css";

export default function PostsPage() {
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<PostRead | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, isError } = usePostsList({ page, page_size: 20 });
  const createMutation = usePostCreate();
  const updateMutation = usePostUpdate();
  const deleteMutation = usePostDelete();

  const handleCreate = (formData: PostCreate) => {
    setFormError(null);
    createMutation.mutate(formData, {
      onSuccess: () => {
        setShowForm(false);
      },
      onError: (err) => {
        setFormError(extractApiDetail(err) || "Failed to create post.");
      },
    });
  };

  const handleUpdate = (formData: PostCreate) => {
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
          setFormError(extractApiDetail(err) || "Failed to update post.");
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
      <div className="posts-loading" role="status" aria-live="polite">
        Loading posts...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="posts-error" role="alert">
        Failed to load posts. Please try again.
      </div>
    );
  }

  return (
    <div className="posts-page">
      <div className="posts-header">
        <h2>Posts ({data?.total ?? 0})</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            setSelectedItem(null);
            setFormError(null);
            setShowForm(true);
          }}
        >
          + Add Post
        </button>
      </div>

      {data && data.items.length === 0 ? (
        <div className="posts-empty">
          <div className="posts-empty-title">No posts yet</div>
          <div className="posts-empty-text">
            Create your first post to get started.
          </div>
        </div>
      ) : (
        <>
          <div className="posts-table-wrap">
            <table className="posts-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Published</th>
                  <th>Published At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((item) => (
                  <tr key={item.id}>
                    <td>{String(item.title ?? "—")}</td>
                    <td>{item.published ? "Yes" : "Draft"}</td>
                    <td>{item.published_at ?? "—"}</td>
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
            <div className="posts-pagination">
              <button
                className="btn btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span className="posts-pagination-info">
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
        <div className="posts-modal-overlay">
          <div className="posts-modal">
            <h3 className="posts-modal-title">
              {selectedItem ? "Edit Post" : "Add Post"}
            </h3>
            {formError && (
              <div className="form-error" role="alert">
                {formError}
              </div>
            )}
            {/* Form fields: title (text), body (textarea), published (checkbox) */}
            <div className="posts-modal-actions">
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
                {selectedItem ? "Update Post" : "Add Post"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
