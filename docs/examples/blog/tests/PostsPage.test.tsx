import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { server } from "../../tests/setup";
import { postHandlers, POST_FIXTURES } from "../../tests/handlers/posts";
import PostsPage from "./PostsPage";

const BASE = "http://localhost:8080";

function renderPosts() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PostsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PostsPage", () => {
  beforeEach(() => {
    server.use(...postHandlers);
  });

  it("renders posts list with data from fixtures", async () => {
    renderPosts();

    expect(await screen.findByText("Posts (2)")).toBeInTheDocument();
  });

  it("shows empty state when API returns empty list", async () => {
    server.use(
      http.get(`${BASE}/posts`, () =>
        HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          page_size: 20,
          pages: 0,
        }),
      ),
    );

    renderPosts();

    expect(await screen.findByText("No posts yet")).toBeInTheDocument();
  });

  it("shows loading state while fetching", () => {
    server.use(
      http.get(`${BASE}/posts`, async () => {
        await new Promise((r) => setTimeout(r, 100));
        return HttpResponse.json({
          items: POST_FIXTURES,
          total: 2,
          page: 1,
          page_size: 20,
          pages: 1,
        });
      }),
    );

    renderPosts();
    expect(screen.getByText("Loading posts...")).toBeInTheDocument();
  });

  it("shows error state on API failure", async () => {
    server.use(
      http.get(`${BASE}/posts`, () =>
        HttpResponse.json({ detail: "Server Error" }, { status: 500 }),
      ),
    );

    renderPosts();

    expect(
      await screen.findByText("Failed to load posts. Please try again."),
    ).toBeInTheDocument();
  });

  it("opens create form when Add button is clicked", async () => {
    const user = userEvent.setup();
    renderPosts();

    const addBtn = await screen.findByText("+ Add Post");
    await user.click(addBtn);

    expect(screen.getByText("Add Post")).toBeInTheDocument();
  });
});
