import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../../tests/setup";
import GettingStartedPage from "../GettingStartedPage";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/getting-started"]}>
        <GettingStartedPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const healthOk = http.get("http://localhost:8080/health", () =>
  HttpResponse.json({ status: "ok", version: "1.0.0", database: "connected" }),
);
const auth422 = http.post("http://localhost:8080/auth/jwt/login", () =>
  HttpResponse.json({ detail: "validation" }, { status: 422 }),
);
const auth400 = http.post("http://localhost:8080/auth/jwt/login", () =>
  HttpResponse.json({ detail: "bad request" }, { status: 400 }),
);
const healthDbDown = http.get("http://localhost:8080/health", () =>
  HttpResponse.json({ status: "ok", version: "1.0.0", database: "disconnected" }),
);
const healthDegraded = http.get("http://localhost:8080/health", () =>
  HttpResponse.json({ status: "degraded", database: "connected" }),
);
const healthNoDb = http.get("http://localhost:8080/health", () =>
  HttpResponse.json({ status: "ok" }),
);
const healthDown = http.get("http://localhost:8080/health", () =>
  HttpResponse.error(),
);
const authDown = http.post("http://localhost:8080/auth/jwt/login", () =>
  HttpResponse.json({ detail: "error" }, { status: 500 }),
);

describe("GettingStartedPage", () => {
  it("renders title and initial checking state", () => {
    server.use(healthOk, auth422);
    renderPage();
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(screen.getByText("Setup Guide")).toBeInTheDocument();
  });

  it("shows all checks passed when API, DB, and auth are healthy", async () => {
    server.use(healthOk, auth422);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("3/3 checks passed")).toBeInTheDocument();
    });

    expect(screen.getByText("All systems go!")).toBeInTheDocument();
    expect(screen.getByText(/make new-domain/)).toBeInTheDocument();
    expect(screen.getByText(/make tutorial/)).toBeInTheDocument();
  });

  it("shows failure state when DB is disconnected", async () => {
    server.use(healthDbDown, auth422);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("2/3 checks passed")).toBeInTheDocument();
    });

    expect(screen.getByText(/Database is disconnected/)).toBeInTheDocument();
    expect(screen.getByText("Next Steps")).toBeInTheDocument();
    expect(screen.getByText(/make doctor/)).toBeInTheDocument();
  });

  it("shows failure state when server is unreachable", async () => {
    server.use(healthDown, authDown);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("0/3 checks passed")).toBeInTheDocument();
    });

    expect(screen.getByText(/Cannot reach API server/)).toBeInTheDocument();
    expect(screen.getByText(/Cannot check database/)).toBeInTheDocument();
  });

  it("re-runs checks when retry button is clicked", async () => {
    const user = userEvent.setup();
    server.use(healthDown, authDown);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("0/3 checks passed")).toBeInTheDocument();
    });

    // Switch to passing handlers and retry
    server.use(healthOk, auth422);
    await user.click(screen.getByText("Re-run checks"));

    await waitFor(() => {
      expect(screen.getByText("3/3 checks passed")).toBeInTheDocument();
    });
  });

  it("handles unexpected health status", async () => {
    server.use(healthDegraded, auth422);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Unexpected status: degraded/)).toBeInTheDocument();
    });
  });

  it("handles auth returning 400 as pass", async () => {
    server.use(healthOk, auth400);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("3/3 checks passed")).toBeInTheDocument();
    });
  });

  it("handles db status with no database field", async () => {
    server.use(healthNoDb, auth422);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/No database status available/)).toBeInTheDocument();
    });
  });
});
