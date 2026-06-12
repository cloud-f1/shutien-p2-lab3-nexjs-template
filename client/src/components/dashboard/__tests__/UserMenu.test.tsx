import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { UserMenu } from "../UserMenu";
import { setAccessToken } from "../../../api/client";

function renderUserMenu() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("UserMenu", () => {
  beforeEach(() => {
    setAccessToken("test-token");
  });

  it("renders the avatar trigger with aria-expanded=false initially", async () => {
    renderUserMenu();
    const trigger = await screen.findByRole("button", {
      name: /user menu for/i,
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
  });

  it("toggles open on click and exposes role=menu region", async () => {
    const user = userEvent.setup();
    renderUserMenu();
    const trigger = await screen.findByRole("button", {
      name: /user menu for/i,
    });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Menu region exists with the User menu aria-label.
    expect(screen.getByRole("menu", { name: /user menu/i })).toBeInTheDocument();
  });

  it("renders the legacy dropdown-icon spans (a11y test compat)", async () => {
    renderUserMenu();
    // Wait for user data so that the menu items are stable.
    await waitFor(() => {
      const icons = document.querySelectorAll(".dropdown-icon");
      expect(icons.length).toBeGreaterThan(0);
    });
    document.querySelectorAll(".dropdown-icon").forEach((icon) => {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });
  });

  it("closes when ESC is pressed", async () => {
    const user = userEvent.setup();
    renderUserMenu();
    const trigger = await screen.findByRole("button", {
      name: /user menu for/i,
    });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
