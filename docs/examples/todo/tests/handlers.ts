import { http, HttpResponse } from "msw";
import { createCrudHandlers } from "../helpers/createHandlers";

const BASE = "http://localhost:8080";

const TASK_FIXTURES = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    title: "Buy groceries",
    description: "Milk, eggs, bread",
    completed: false,
    due_date: "2026-03-15T00:00:00Z",
    priority: 2,
    is_overdue: false,
    user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    title: "Write report",
    description: null,
    completed: true,
    due_date: "2026-01-10T00:00:00Z",
    priority: 1,
    is_overdue: false,
    user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-05T00:00:00Z",
  },
];

// Use generic CRUD handlers but override POST to return complete object
const baseHandlers = createCrudHandlers("/tasks", TASK_FIXTURES);

// Replace POST handler with one that returns all required fields
const createHandler = http.post(`${BASE}/tasks`, async ({ request }) => {
  const body = (await request.json()) as Record<string, unknown>;
  return HttpResponse.json(
    {
      id: crypto.randomUUID(),
      title: null,
      description: null,
      completed: false,
      due_date: null,
      priority: 0,
      is_overdue: false,
      user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...body,
    },
    { status: 201 },
  );
});

// Todo-specific: batch update handler
const batchHandler = http.patch(`${BASE}/tasks/batch`, async ({ request }) => {
  const body = (await request.json()) as { task_ids: string[]; completed: boolean };
  return HttpResponse.json({ updated: body.task_ids.length });
});

export const taskHandlers = [
  createHandler,
  batchHandler,
  ...baseHandlers.filter((h) => {
    const info = h.info as { method?: string; path?: string };
    return !(info.method === "POST" && info.path === `${BASE}/tasks`);
  }),
];
export { TASK_FIXTURES };
