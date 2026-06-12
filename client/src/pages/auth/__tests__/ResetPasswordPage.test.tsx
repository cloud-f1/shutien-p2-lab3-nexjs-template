import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect } from "vitest";
import ResetPasswordPage from "../ResetPasswordPage";

function renderResetPassword(search = "?token=valid-token") {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/reset-password${search}`]}>
        <ResetPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ResetPasswordPage", () => {
  it("shows error when no token in URL", () => {
    renderResetPassword("");
    expect(screen.getByText(/no reset token found/i)).toBeInTheDocument();
  });

  it("renders password field when token present", () => {
    renderResetPassword();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reset password/i }),
    ).toBeInTheDocument();
  });

  it("shows success on valid reset", async () => {
    const user = userEvent.setup();
    renderResetPassword();

    await user.type(
      screen.getByLabelText(/new password/i),
      "NewStrongPass123!",
    );
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/password reset successful/i),
      ).toBeInTheDocument();
    });
  });

  it("shows error on bad token", async () => {
    const user = userEvent.setup();
    renderResetPassword("?token=bad-token");

    await user.type(
      screen.getByLabelText(/new password/i),
      "NewStrongPass123!",
    );
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid or expired/i)).toBeInTheDocument();
    });
  });

  it("has back to sign in link", () => {
    renderResetPassword();
    expect(screen.getByText(/back to sign in/i)).toBeInTheDocument();
  });
});
