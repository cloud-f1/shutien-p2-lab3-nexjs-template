import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect } from "vitest";
import ForgotPasswordPage from "../ForgotPasswordPage";

function renderForgotPassword() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <ForgotPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ForgotPasswordPage", () => {
  it("renders email field and submit button", () => {
    renderForgotPassword();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send reset link/i }),
    ).toBeInTheDocument();
  });

  it("shows validation error on invalid email", async () => {
    const user = userEvent.setup();
    renderForgotPassword();

    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });

  it("always shows success message after submit (email enumeration prevention)", async () => {
    const user = userEvent.setup();
    renderForgotPassword();

    await user.type(
      screen.getByLabelText(/email address/i),
      "anyone@example.com",
    );
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/if that email exists/i)).toBeInTheDocument();
    });
  });

  it("has back to sign in link", () => {
    renderForgotPassword();
    expect(screen.getByText(/back to sign in/i)).toBeInTheDocument();
  });
});
