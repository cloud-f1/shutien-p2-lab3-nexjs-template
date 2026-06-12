import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import PortfolioFormModal from "../PortfolioFormModal";
import { PORTFOLIO_FIXTURES } from "../../../../tests/handlers/portfolios";
import type { PortfolioRead } from "../../../../schemas/portfolio";

const portfolioA = PORTFOLIO_FIXTURES[0] as unknown as PortfolioRead;

describe("PortfolioFormModal", () => {
  it("renders Create Portfolio form when no portfolio is provided", () => {
    render(
      <PortfolioFormModal
        isPending={false}
        error={null}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Create Portfolio" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name *")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  it("renders Edit Portfolio form when portfolio is provided", () => {
    render(
      <PortfolioFormModal
        portfolio={portfolioA}
        isPending={false}
        error={null}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Edit Portfolio")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update Portfolio" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Growth Portfolio")).toBeInTheDocument();
    expect(screen.getByDisplayValue("High-growth properties")).toBeInTheDocument();
  });

  it("shows error banner when error is set", () => {
    render(
      <PortfolioFormModal
        isPending={false}
        error="Something went wrong"
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows Saving state when isPending", () => {
    render(
      <PortfolioFormModal
        isPending={true}
        error={null}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/Saving/)).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeDisabled();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <PortfolioFormModal
        isPending={false}
        error={null}
        onSubmit={vi.fn()}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when overlay is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <PortfolioFormModal
        isPending={false}
        error={null}
        onSubmit={vi.fn()}
        onClose={onClose}
      />,
    );

    const overlay = screen.getByRole("dialog");
    await user.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows validation error for empty name on submit", async () => {
    const user = userEvent.setup();

    render(
      <PortfolioFormModal
        isPending={false}
        error={null}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: "Create Portfolio" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/string must contain/i)).toBeInTheDocument();
    });
  });

  it("calls onSubmit with form data", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <PortfolioFormModal
        isPending={false}
        error={null}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Name *"), "Test Portfolio");
    await user.type(screen.getByLabelText("Description"), "A description");

    const submitBtn = screen.getByRole("button", { name: "Create Portfolio" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test Portfolio",
          description: "A description",
        }),
        expect.anything(),
      );
    });
  });
});
