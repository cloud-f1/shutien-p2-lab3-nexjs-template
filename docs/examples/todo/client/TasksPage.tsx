// This component is rendered inside DashboardLayout (see App.tsx routing)
import { useState } from "react";
import { extractApiDetail } from "../../api/errors";
import {
  useTasksList,
  useTaskCreate,
  useTaskUpdate,
  useTaskDelete,
} from "../../hooks/useTasks";
import type { TaskRead, TaskCreate } from "../../schemas/task";
import "./Tasks.css";

const PRIORITY_LABELS: Record<number, string> = {
  0: "Low",
  1: "Medium",
  2: "High",
};

export default function TasksPage() {
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<TaskRead | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, isError } = useTasksList({ page, page_size: 20 });
  const createMutation = useTaskCreate();
  const updateMutation = useTaskUpdate();
  const deleteMutation = useTaskDelete();

  const handleCreate = (formData: TaskCreate) => {
    setFormError(null);
    createMutation.mutate(formData, {
      onSuccess: () => {
        setShowForm(false);
      },
      onError: (err) => {
        setFormError(extractApiDetail(err) || "Failed to create task.");
      },
    });
  };

  const handleUpdate = (formData: TaskCreate) => {
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
          setFormError(extractApiDetail(err) || "Failed to update task.");
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
      <div className="tasks-loading" role="status" aria-live="polite">
        Loading tasks...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="tasks-error" role="alert">
        Failed to load tasks. Please try again.
      </div>
    );
  }

  return (
    <div className="tasks-page">
      <div className="tasks-header">
        <h2>Tasks ({data?.total ?? 0})</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            setSelectedItem(null);
            setFormError(null);
            setShowForm(true);
          }}
        >
          + Add Task
        </button>
      </div>

      {data && data.items.length === 0 ? (
        <div className="tasks-empty">
          <div className="tasks-empty-title">No tasks yet</div>
          <div className="tasks-empty-text">
            Create your first task to get started.
          </div>
        </div>
      ) : (
        <>
          <div className="tasks-table-wrap">
            <table className="tasks-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((item) => (
                  <tr key={item.id} className={item.is_overdue ? "tasks-overdue" : ""}>
                    <td>{String(item.title ?? "—")}</td>
                    <td>
                      <span className={`tasks-priority tasks-priority-${item.priority}`}>
                        {PRIORITY_LABELS[item.priority] ?? "Low"}
                      </span>
                    </td>
                    <td>{item.due_date ?? "—"}</td>
                    <td>
                      {item.completed ? "Done" : item.is_overdue ? "Overdue" : "Pending"}
                    </td>
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
            <div className="tasks-pagination">
              <button
                className="btn btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span className="tasks-pagination-info">
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
        <div className="tasks-modal-overlay">
          <div className="tasks-modal">
            <h3 className="tasks-modal-title">
              {selectedItem ? "Edit Task" : "Add Task"}
            </h3>
            {formError && (
              <div className="form-error" role="alert">
                {formError}
              </div>
            )}
            {/* Form fields: title (text), description (textarea),
                priority (select 0/1/2), due_date (datetime), completed (checkbox) */}
            <div className="tasks-modal-actions">
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
                {selectedItem ? "Update Task" : "Add Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
