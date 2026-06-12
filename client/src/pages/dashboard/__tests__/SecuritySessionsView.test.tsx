import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import SecuritySessionsView from "../views/SecuritySessionsView";
import {
  setAccessToken,
  setRefreshToken,
  clearRefreshTimer,
} from "../../../api/client";
import {
  resetSessionFixtures,
  getSessionFixtures,
} from "../../../tests/handlers/sessions";

function renderView() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SecuritySessionsView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SecuritySessionsView", () => {
  beforeEach(() => {
    setAccessToken("test-access-token");
    setRefreshToken(null);
    clearRefreshTimer();
    resetSessionFixtures();
  });

  it("renders the page header without crashing", async () => {
    renderView();

    expect(screen.getByText("Active Sessions")).toBeInTheDocument();
    // Subheader / sign-out-everywhere CTA always visible
    expect(
      screen.getByRole("button", { name: /sign out everywhere/i }),
    ).toBeInTheDocument();
  });

  it("calls list() on mount and renders session rows", async () => {
    renderView();

    // Wait for the data rows to render (table is always present, even while loading).
    await screen.findByText("203.0.113.10");
    const table = screen.getByRole("table", { name: /active sessions/i });
    // 1 header row + 2 data rows
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByText("198.51.100.42")).toBeInTheDocument();
  });

  it("calls revoke when a per-row Revoke button is clicked", async () => {
    const user = userEvent.setup();
    renderView();

    // Wait for the revoke buttons to appear (one per row, two seed rows).
    const revokeButtons = await screen.findAllByRole("button", {
      name: /^revoke session/i,
    });
    expect(revokeButtons).toHaveLength(2);

    await user.click(revokeButtons[0]);

    // Server-side fixture shrinks; refetched list re-renders one row
    await waitFor(() => {
      const fixtures = getSessionFixtures();
      expect(fixtures).toHaveLength(1);
    });
    await waitFor(() => {
      const updatedTable = screen.getByRole("table", {
        name: /active sessions/i,
      });
      expect(within(updatedTable).getAllByRole("row")).toHaveLength(2); // header + 1 data row
    });
  });

  it("calls logoutAll when the footer button is clicked", async () => {
    const user = userEvent.setup();
    renderView();

    // Wait for sessions to load before clicking
    await screen.findByText("203.0.113.10");

    const logoutAllBtn = screen.getByRole("button", {
      name: /sign out everywhere/i,
    });
    await user.click(logoutAllBtn);

    // Fixture is wiped server-side; UI shows the empty state after refetch
    await waitFor(() => {
      expect(getSessionFixtures()).toHaveLength(0);
    });
    await waitFor(() => {
      expect(screen.getByText(/no active sessions/i)).toBeInTheDocument();
    });
  });
});
