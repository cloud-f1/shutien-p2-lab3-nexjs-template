import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import PlacesList from "../PlacesList";
import { PLACE_FIXTURES } from "../../../../tests/handlers/places";
import type { PaginatedResponse } from "../../../../schemas/common";
import type { PlaceRead } from "../../../../schemas/place";

function makePaginatedData(
  items: PlaceRead[],
  overrides: Partial<PaginatedResponse<PlaceRead>> = {},
): PaginatedResponse<PlaceRead> {
  return {
    items,
    total: items.length,
    page: 1,
    page_size: 20,
    pages: 1,
    ...overrides,
  };
}

const fixtures = PLACE_FIXTURES as unknown as PlaceRead[];

describe("PlacesList", () => {
  it("shows empty state when no items", () => {
    const onAdd = vi.fn();
    render(
      <PlacesList
        data={makePaginatedData([])}
        page={1}
        onPageChange={vi.fn()}
        onSelect={vi.fn()}
        onAdd={onAdd}
      />,
    );

    expect(screen.getByText("No places yet")).toBeInTheDocument();
    expect(
      screen.getByText("Add your first place to start tracking your investments."),
    ).toBeInTheDocument();
  });

  it("calls onAdd when empty state button is clicked", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();

    render(
      <PlacesList
        data={makePaginatedData([])}
        page={1}
        onPageChange={vi.fn()}
        onSelect={vi.fn()}
        onAdd={onAdd}
      />,
    );

    await user.click(screen.getByText("+ Add Place"));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("renders table with place names when items exist", () => {
    render(
      <PlacesList
        data={makePaginatedData(fixtures)}
        page={1}
        onPageChange={vi.fn()}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
      />,
    );

    expect(screen.getByText("Test Place A")).toBeInTheDocument();
    expect(screen.getByText("Test Place B")).toBeInTheDocument();
    expect(screen.getByText("Places (2)")).toBeInTheDocument();
  });

  it("renders category badge when category exists", () => {
    render(
      <PlacesList
        data={makePaginatedData(fixtures)}
        page={1}
        onPageChange={vi.fn()}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
      />,
    );

    expect(screen.getByText("restaurant")).toBeInTheDocument();
  });

  it("renders dash for null category", () => {
    render(
      <PlacesList
        data={makePaginatedData(fixtures)}
        page={1}
        onPageChange={vi.fn()}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
      />,
    );

    // Test Place B has null category — should show em dash
    const dashes = screen.getAllByText("\u2014");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("renders coordinates with 4 decimal places", () => {
    render(
      <PlacesList
        data={makePaginatedData(fixtures)}
        page={1}
        onPageChange={vi.fn()}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
      />,
    );

    expect(screen.getByText("25.0330, 121.5650")).toBeInTheDocument();
  });

  it("calls onSelect when a row is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <PlacesList
        data={makePaginatedData(fixtures)}
        page={1}
        onPageChange={vi.fn()}
        onSelect={onSelect}
        onAdd={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Test Place A"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(fixtures[0]);
  });

  it("calls onSelect when Enter key is pressed on a row", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <PlacesList
        data={makePaginatedData(fixtures)}
        page={1}
        onPageChange={vi.fn()}
        onSelect={onSelect}
        onAdd={vi.fn()}
      />,
    );

    const row = screen.getByText("Test Place A").closest("tr")!;
    row.focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("calls onAdd when header Add Place button is clicked", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();

    render(
      <PlacesList
        data={makePaginatedData(fixtures)}
        page={1}
        onPageChange={vi.fn()}
        onSelect={vi.fn()}
        onAdd={onAdd}
      />,
    );

    await user.click(screen.getByText("+ Add Place"));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("does not show pagination for single page", () => {
    render(
      <PlacesList
        data={makePaginatedData(fixtures, { pages: 1 })}
        page={1}
        onPageChange={vi.fn()}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
      />,
    );

    expect(screen.queryByText("Prev")).not.toBeInTheDocument();
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
  });

  it("shows pagination when multiple pages exist", () => {
    render(
      <PlacesList
        data={makePaginatedData(fixtures, { pages: 3, total: 50 })}
        page={2}
        onPageChange={vi.fn()}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
      />,
    );

    expect(screen.getByText("Prev")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });

  it("disables Prev button on first page", () => {
    render(
      <PlacesList
        data={makePaginatedData(fixtures, { pages: 3, total: 50 })}
        page={1}
        onPageChange={vi.fn()}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
      />,
    );

    expect(screen.getByText("Prev")).toBeDisabled();
    expect(screen.getByText("Next")).toBeEnabled();
  });

  it("disables Next button on last page", () => {
    render(
      <PlacesList
        data={makePaginatedData(fixtures, { pages: 3, total: 50 })}
        page={3}
        onPageChange={vi.fn()}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
      />,
    );

    expect(screen.getByText("Prev")).toBeEnabled();
    expect(screen.getByText("Next")).toBeDisabled();
  });

  it("calls onPageChange when pagination buttons are clicked", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(
      <PlacesList
        data={makePaginatedData(fixtures, { pages: 3, total: 50 })}
        page={2}
        onPageChange={onPageChange}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Prev"));
    expect(onPageChange).toHaveBeenCalledWith(1);

    await user.click(screen.getByText("Next"));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
