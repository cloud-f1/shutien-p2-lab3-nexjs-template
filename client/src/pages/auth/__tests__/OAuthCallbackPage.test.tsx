import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach, vi } from "vitest";
import OAuthCallbackPage from "../OAuthCallbackPage";
import { setAccessToken, getAccessToken, setRefreshToken } from "../../../api/client";
import { useAuthStore } from "../../../store/authStore";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderCallback(hash = "") {
  // Set the hash before rendering
  window.location.hash = hash;

  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/auth/callback"]}>
        <OAuthCallbackPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("OAuthCallbackPage", () => {
  beforeEach(() => {
    setAccessToken(null);
    setRefreshToken(null);
    useAuthStore.getState().setUser(null);
    mockNavigate.mockClear();
    window.location.hash = "";
  });

  it("shows loading state while processing", () => {
    renderCallback("#access_token=test-at&refresh_token=test-rt");
    expect(screen.getByText(/completing sign-in/i)).toBeInTheDocument();
  });

  it("extracts tokens from hash and stores access token", async () => {
    renderCallback("#access_token=test-access-token&refresh_token=test-refresh-token");

    await waitFor(() => {
      expect(getAccessToken()).toBe("test-access-token");
    });
  });

  it("navigates to dashboard on success", async () => {
    renderCallback("#access_token=test-access-token&refresh_token=test-refresh-token");

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });

  it("cleans URL hash after extracting tokens", async () => {
    renderCallback("#access_token=test-access-token&refresh_token=test-refresh-token");

    await waitFor(() => {
      expect(window.location.hash).toBe("");
    });
  });

  it("shows error and redirects to signin when tokens are missing", async () => {
    renderCallback(""); // No hash

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith(
          "/signin?error=oauth_failed",
          { replace: true },
        );
      },
      { timeout: 3000 },
    );
  });

  it("clears tokens on error", async () => {
    // Set a token, then render with no hash to trigger error
    setAccessToken("should-be-cleared");
    renderCallback("");

    await waitFor(() => {
      expect(getAccessToken()).toBeNull();
    });
  });
});
