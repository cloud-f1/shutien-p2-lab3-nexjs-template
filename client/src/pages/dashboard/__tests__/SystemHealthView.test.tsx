import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import SystemHealthView from "../views/SystemHealthView";
import { setAccessToken, clearRefreshTimer } from "../../../api/client";

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
        <SystemHealthView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SystemHealthView", () => {
  beforeEach(() => {
    setAccessToken("test-access-token");
    clearRefreshTimer();
  });

  it("renders the page header", () => {
    renderView();
    expect(screen.getByText("System Health")).toBeInTheDocument();
    expect(
      screen.getByText(/auto-refreshes every 30 seconds/i),
    ).toBeInTheDocument();
  });

  it("renders the AdminHealth panels when /admin/health resolves", async () => {
    renderView();
    expect(await screen.findByText("Database")).toBeInTheDocument();
    expect(screen.getByText("Email Provider")).toBeInTheDocument();
    expect(screen.getByText("OAuth Providers")).toBeInTheDocument();
    expect(screen.getByText("Application")).toBeInTheDocument();
  });

  it("renders the SLI panels when /admin/sli resolves", async () => {
    renderView();
    // Wait for SLI panels (proves /admin/sli was consumed).
    await waitFor(() => {
      expect(screen.getByText("Success Rate (5m)")).toBeInTheDocument();
    });
    expect(screen.getByText("Latency (5m)")).toBeInTheDocument();
    expect(screen.getByText("DB Connection Pool")).toBeInTheDocument();
    expect(screen.getByText("Release")).toBeInTheDocument();
    expect(screen.getByText("Top Endpoints")).toBeInTheDocument();
  });

  it("renders top-endpoints table rows from the SLI snapshot", async () => {
    renderView();
    // Mock fixture seeds /users/me + /auth/jwt/login.
    expect(await screen.findByText("/users/me")).toBeInTheDocument();
    expect(screen.getByText("/auth/jwt/login")).toBeInTheDocument();
    // Table is labelled for accessibility
    expect(
      screen.getByRole("table", { name: /top endpoints by request count/i }),
    ).toBeInTheDocument();
  });

  it("formats success_rate_5m as a percentage", async () => {
    renderView();
    // Mock seeds 0.9931 → "99.31%"
    expect(await screen.findByText("99.31%")).toBeInTheDocument();
  });
});
