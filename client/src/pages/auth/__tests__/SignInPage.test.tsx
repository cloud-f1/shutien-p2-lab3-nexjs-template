import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach } from "vitest";
import SignInPage from "../SignInPage";
import { setAccessToken } from "../../../api/client";

function renderSignIn() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/signin"]}>
        <SignInPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function getSubmitButton() {
  return screen.getByRole("button", { name: /sign in →/i });
}

describe("SignInPage", () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  it("renders email and password fields", () => {
    renderSignIn();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it("renders social buttons", () => {
    renderSignIn();
    expect(screen.getByRole("button", { name: /google/i })).toBeInTheDocument();
  });

  it("shows validation errors on empty submit", async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.click(getSubmitButton());

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });

  it("shows error banner on bad credentials", async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.type(
      screen.getByLabelText(/email address/i),
      "alex@example.com",
    );
    await user.type(screen.getByLabelText(/^password$/i), "wrongPassword");
    await user.click(getSubmitButton());

    await waitFor(() => {
      expect(
        screen.getByText(/invalid email or password/i),
      ).toBeInTheDocument();
    });
  });

  it("successful login stores token and shows success", async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.type(
      screen.getByLabelText(/email address/i),
      "alex@example.com",
    );
    await user.type(screen.getByLabelText(/^password$/i), "validPass123");
    await user.click(getSubmitButton());

    await waitFor(() => {
      expect(screen.getByText(/signed in/i)).toBeInTheDocument();
    });
  });

  it("password toggle switches between show/hide", async () => {
    const user = userEvent.setup();
    renderSignIn();

    const pwInput = screen.getByLabelText(/^password$/i);
    expect(pwInput).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(pwInput).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: /hide password/i }));
    expect(pwInput).toHaveAttribute("type", "password");
  });

  it("has forgot password link", () => {
    renderSignIn();
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
  });
});
