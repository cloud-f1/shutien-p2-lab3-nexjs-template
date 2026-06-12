import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach } from "vitest";
import SignUpPage from "../SignUpPage";
import { setAccessToken } from "../../../api/client";

function renderSignUp() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/signup"]}>
        <SignUpPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function getSubmitButton() {
  return screen.getByRole("button", { name: /create account →/i });
}

describe("SignUpPage", () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  it("renders all form fields", () => {
    renderSignUp();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it("renders social buttons", () => {
    renderSignUp();
    expect(screen.getByRole("button", { name: /google/i })).toBeInTheDocument();
  });

  it("shows validation error on empty email", async () => {
    const user = userEvent.setup();
    renderSignUp();

    await user.click(getSubmitButton());

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });

  it("shows terms error when checkbox unchecked", async () => {
    const user = userEvent.setup();
    renderSignUp();

    await user.type(screen.getByLabelText(/email address/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "StrongPass123!");
    await user.click(getSubmitButton());

    await waitFor(() => {
      expect(
        screen.getByText(/please agree to the terms/i),
      ).toBeInTheDocument();
    });
  });

  it("successful registration shows success banner", async () => {
    const user = userEvent.setup();
    renderSignUp();

    await user.type(screen.getByLabelText(/email address/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "StrongPass123!");
    await user.click(screen.getByText(/i agree to the/i));
    await user.click(getSubmitButton());

    await waitFor(() => {
      expect(screen.getByText(/account created/i)).toBeInTheDocument();
    });
  });

  it("shows error when email already exists", async () => {
    const user = userEvent.setup();
    renderSignUp();

    await user.type(
      screen.getByLabelText(/email address/i),
      "existing@example.com",
    );
    await user.type(screen.getByLabelText(/^password$/i), "StrongPass123!");
    await user.click(screen.getByText(/i agree to the/i));
    await user.click(getSubmitButton());

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });
  });

  it("has password strength meter", async () => {
    const user = userEvent.setup();
    renderSignUp();

    const pwInput = screen.getByLabelText(/^password$/i);
    await user.type(pwInput, "abc");

    const bars = document.querySelectorAll(".pw-bar");
    expect(bars.length).toBe(4);
  });
});
