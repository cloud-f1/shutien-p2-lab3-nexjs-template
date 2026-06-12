import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect } from "vitest";
import VerifyEmailPage from "../VerifyEmailPage";

function renderVerifyEmail(search = "?token=valid-token") {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/verify-email${search}`]}>
        <VerifyEmailPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("VerifyEmailPage", () => {
  it("shows loading then success with valid token", async () => {
    renderVerifyEmail("?token=valid-token");

    // Initially shows loading
    expect(screen.getByText(/verifying your email/i)).toBeInTheDocument();

    // Then shows success
    await waitFor(() => {
      expect(screen.getByText(/email verified/i)).toBeInTheDocument();
    });
    expect(
      screen.getByText(/your email has been verified successfully/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows error with invalid token", async () => {
    renderVerifyEmail("?token=bad-token");

    await waitFor(() => {
      expect(screen.getByText(/verification failed/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/invalid or expired/i)).toBeInTheDocument();
  });

  it("shows error when no token in URL", () => {
    renderVerifyEmail("");

    expect(screen.getByText(/verification failed/i)).toBeInTheDocument();
    expect(
      screen.getByText(/no verification token found/i),
    ).toBeInTheDocument();
  });
});
