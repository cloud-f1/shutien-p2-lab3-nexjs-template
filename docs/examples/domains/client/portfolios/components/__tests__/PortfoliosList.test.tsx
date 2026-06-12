import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import PortfoliosList from "../PortfoliosList";
import { PORTFOLIO_FIXTURES } from "../../../../tests/handlers/portfolios";
import type { PaginatedResponse } from "../../../../schemas/common";
import type { PortfolioRead } from "../../../../schemas/portfolio";

function makePaginatedData(
  items: PortfolioRead[],
  overrides: Partial<PaginatedResponse<PortfolioRead>> = {},
): PaginatedResponse<PortfolioRead> {
  return {
    items,
    total: items.length,
    page: 1,
    page_size: 20,
    pages: 1,
    ...overrides,
  };
}

const fixtures = PORTFOLIO_FIXTURES as unknown as PortfolioRead[];

describe("PortfoliosList", () => {
  it("shows empty state when no items", () => {
    render(
      <PortfoliosList
        data={makePaginatedData([])}
        page={1}
        onPageChange={vi.fn()}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    expect(screen.getByText("No portfolios yet")).toBeInTheDocument();
    expect(
      screen.getByText("Create your first portfolio to start tracking your investments."),
    ).toBeInTheDocument();
  });

  it("calls onCreate from empty state button", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    render(
      <PortfoliosList
        data={makePaginatedData([])}
        page={1}
        onPageChange={vi.fn()}
        onSelect={vi.fn()}
        onCreate={onCreate}
      />,
    );

    await user.click(screen.getByText("+ Create Portfolio"));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("renders portfolio cards with names and formatted values", () => {
    render(
      <PortfoliosList
        data={makePaginatedData(fixtures)}
        page={1}
        onPageChange={vi.fn()}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    expect(screen.getByText("Growth Portfolio")).toBeInTheDocument();
    expect(screen.getByText("Income Portfolio")).toBeInTheDocument();
    expect(screen.getByText("$1,600,000.00")).toBeInTheDocument();
    expect(screen.getByText("Portfolios (2)")).toBeInTheDocument();
  });

  it("renders description when present", () => {
    render(
      <PortfoliosList
        data={makePaginatedData(fixtures)}
        page={1}
        onPageChange={vi.fn()}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    expect(screen.getByText("High-growth properties")).toBeInTheDocument();
  });

  it("calls onSelect when card is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <PortfoliosList
        data={makePaginatedData(fixtures)}
        page={1}
        onPageChange={vi.fn()}
        onSelect={onSelect}
        onCreate={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Growth Portfolio"));
    expect(onSelect).toHaveBeenCalledWith(fixtures[0]);
  });

  it("calls onSelect when Enter is pressed on card", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <PortfoliosList
        data={makePaginatedData(fixtures)}
        page={1}
        onPageChange={vi.fn()}
        onSelect={onSelect}
        onCreate={vi.fn()}
      />,
    );

    const card = screen.getByText("Growth Portfolio").closest("[role='button']")!;
    card.focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("shows pagination for multiple pages", () => {
    render(
      <PortfoliosList
        data={makePaginatedData(fixtures, { pages: 3, total: 50 })}
        page={2}
        onPageChange={vi.fn()}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.getByText("Prev")).toBeEnabled();
    expect(screen.getByText("Next")).toBeEnabled();
  });

  it("hides pagination for single page", () => {
    render(
      <PortfoliosList
        data={makePaginatedData(fixtures)}
        page={1}
        onPageChange={vi.fn()}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    expect(screen.queryByText("Prev")).not.toBeInTheDocument();
  });

  it("calls onPageChange for pagination", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(
      <PortfoliosList
        data={makePaginatedData(fixtures, { pages: 3, total: 50 })}
        page={2}
        onPageChange={onPageChange}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Prev"));
    expect(onPageChange).toHaveBeenCalledWith(1);

    await user.click(screen.getByText("Next"));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
