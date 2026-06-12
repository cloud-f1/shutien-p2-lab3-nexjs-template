import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { server } from "../../tests/setup";
import { placeHandlers, PLACE_FIXTURES } from "../../tests/handlers/places";
import PlacesPage from "./PlacesPage";

const BASE = "http://localhost:8080";

function renderPlaces() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PlacesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PlacesPage", () => {
  beforeEach(() => {
    server.use(...placeHandlers);
  });

  it("renders places list with place names from fixtures", async () => {
    renderPlaces();

    expect(await screen.findByText("Test Place A")).toBeInTheDocument();
    expect(screen.getByText("Test Place B")).toBeInTheDocument();
  });

  it("shows empty state when API returns empty list", async () => {
    server.use(
      http.get(`${BASE}/places`, () =>
        HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          page_size: 20,
          pages: 0,
        }),
      ),
    );

    renderPlaces();

    expect(await screen.findByText("No places yet")).toBeInTheDocument();
  });

  it("opens create form when Add Place is clicked", async () => {
    const user = userEvent.setup();
    renderPlaces();

    const addBtn = await screen.findByText("+ Add Place");
    await user.click(addBtn);

    expect(screen.getByLabelText("Name *")).toBeInTheDocument();
    expect(screen.getByLabelText("Latitude *")).toBeInTheDocument();
  });

  it("shows place detail when a row is clicked", async () => {
    const user = userEvent.setup();
    renderPlaces();

    const placeRow = await screen.findByText("Test Place A");
    await user.click(placeRow);

    expect(screen.getByText("123 Test St")).toBeInTheDocument();
    expect(screen.getByText("A test place")).toBeInTheDocument();
  });

  it("shows form validation error for empty name", async () => {
    const user = userEvent.setup();
    renderPlaces();

    const addBtn = await screen.findByText("+ Add Place");
    await user.click(addBtn);

    // Clear and submit with empty name
    const nameInput = screen.getByLabelText("Name *");
    await user.clear(nameInput);

    const submitBtn = screen.getByRole("button", { name: /^Add Place$/ });
    await user.click(submitBtn);

    // Zod validation should show error
    await waitFor(() => {
      expect(screen.getByText(/string must contain/i)).toBeInTheDocument();
    });
  });

  it("shows loading state while fetching", () => {
    // Use a handler that delays the response
    server.use(
      http.get(`${BASE}/places`, async () => {
        await new Promise((r) => setTimeout(r, 100));
        return HttpResponse.json({
          items: PLACE_FIXTURES,
          total: 2,
          page: 1,
          page_size: 20,
          pages: 1,
        });
      }),
    );

    renderPlaces();
    expect(screen.getByText("Loading places...")).toBeInTheDocument();
  });

  it("shows error state on API failure", async () => {
    server.use(
      http.get(`${BASE}/places`, () =>
        HttpResponse.json({ detail: "Server Error" }, { status: 500 }),
      ),
    );

    renderPlaces();

    expect(
      await screen.findByText("Failed to load places. Please try again."),
    ).toBeInTheDocument();
  });

  it("shows delete confirmation when delete is clicked from detail", async () => {
    const user = userEvent.setup();
    renderPlaces();

    // Navigate to detail
    const placeRow = await screen.findByText("Test Place A");
    await user.click(placeRow);

    // Click delete
    const deleteBtn = screen.getByText("Delete");
    await user.click(deleteBtn);

    expect(screen.getByText("Delete Place")).toBeInTheDocument();
    // The place name appears in the confirmation text
    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
  });

  it("creates a place successfully", async () => {
    const user = userEvent.setup();
    renderPlaces();

    const addBtn = await screen.findByText("+ Add Place");
    await user.click(addBtn);

    await user.type(screen.getByLabelText("Name *"), "New Place");
    await user.clear(screen.getByLabelText("Latitude *"));
    await user.type(screen.getByLabelText("Latitude *"), "25.5");
    await user.clear(screen.getByLabelText("Longitude *"));
    await user.type(screen.getByLabelText("Longitude *"), "121.5");

    const submitBtn = screen.getByRole("button", { name: "Add Place" });
    await user.click(submitBtn);

    // Should return to list after success
    await waitFor(() => {
      expect(screen.queryByText("Add Place")).not.toBeInTheDocument();
    });
  });

  it("returns to list when back button is clicked from detail", async () => {
    const user = userEvent.setup();
    renderPlaces();

    // Navigate to detail
    const placeRow = await screen.findByText("Test Place A");
    await user.click(placeRow);

    // Click back
    const backBtn = screen.getByText(/Back to list/);
    await user.click(backBtn);

    // Should be back on list showing table header
    await waitFor(() => {
      expect(screen.getByText(/Places \(/)).toBeInTheDocument();
    });
  });
});
