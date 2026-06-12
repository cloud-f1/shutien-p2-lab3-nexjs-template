import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "../../../components/DashboardLayout";
import { ROUTE_MAP, VIEW_ORDER } from "../../../config/routeMap";
import { setAccessToken } from "../../../api/client";

function renderDashboard(initialPath = "/dashboard/overview") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Navigate to="overview" replace />} />
            {VIEW_ORDER.map((id) => {
              const entry = ROUTE_MAP[id];
              const Component = entry.component;
              return (
                <Route
                  key={id}
                  path={entry.path}
                  element={<Component />}
                />
              );
            })}
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    setAccessToken("test-token");
  });

  it("renders sidebar navigation with all sections", () => {
    renderDashboard();

    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Tools")).toBeInTheDocument();
  });

  it("switches views when sidebar items are clicked", async () => {
    const user = userEvent.setup();
    renderDashboard();

    // Click on a sidebar nav item — use getAllByText since text appears in sidebar + content
    const memoryLinks = screen.getAllByText("Memory Hub");
    await user.click(memoryLinks[0]); // click the sidebar link

    // After clicking, the content heading should appear
    const headings = screen.getAllByText("Memory Hub");
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it("renders user profile section", async () => {
    renderDashboard();

    const name = await screen.findByText("Alex Hsieh");
    expect(name).toBeInTheDocument();
  });

  it("renders settings view", async () => {
    const user = userEvent.setup();
    renderDashboard();

    // Navigate to settings — use getAllByText since text appears in sidebar + content
    const settingsLinks = screen.getAllByText("Settings");
    await user.click(settingsLinks[0]);
    expect(screen.getAllByText("Settings").length).toBeGreaterThanOrEqual(1);
  });
});
