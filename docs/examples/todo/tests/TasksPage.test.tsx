import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { server } from "../../tests/setup";
import { taskHandlers, TASK_FIXTURES } from "../../tests/handlers/tasks";
import TasksPage from "./TasksPage";

const BASE = "http://localhost:8080";

function renderTasks() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TasksPage", () => {
  beforeEach(() => {
    server.use(...taskHandlers);
  });

  it("renders tasks list with data from fixtures", async () => {
    renderTasks();

    expect(await screen.findByText("Tasks (2)")).toBeInTheDocument();
  });

  it("shows empty state when API returns empty list", async () => {
    server.use(
      http.get(`${BASE}/tasks`, () =>
        HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          page_size: 20,
          pages: 0,
        }),
      ),
    );

    renderTasks();

    expect(await screen.findByText("No tasks yet")).toBeInTheDocument();
  });

  it("shows loading state while fetching", () => {
    server.use(
      http.get(`${BASE}/tasks`, async () => {
        await new Promise((r) => setTimeout(r, 100));
        return HttpResponse.json({
          items: TASK_FIXTURES,
          total: 2,
          page: 1,
          page_size: 20,
          pages: 1,
        });
      }),
    );

    renderTasks();
    expect(screen.getByText("Loading tasks...")).toBeInTheDocument();
  });

  it("shows error state on API failure", async () => {
    server.use(
      http.get(`${BASE}/tasks`, () =>
        HttpResponse.json({ detail: "Server Error" }, { status: 500 }),
      ),
    );

    renderTasks();

    expect(
      await screen.findByText("Failed to load tasks. Please try again."),
    ).toBeInTheDocument();
  });

  it("opens create form when Add button is clicked", async () => {
    const user = userEvent.setup();
    renderTasks();

    const addBtn = await screen.findByText("+ Add Task");
    await user.click(addBtn);

    expect(screen.getByText("Add Task")).toBeInTheDocument();
  });
});
