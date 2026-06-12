import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import PlaceDetail from "../PlaceDetail";
import { PLACE_FIXTURES } from "../../../../tests/handlers/places";
import type { PlaceRead } from "../../../../schemas/place";

const placeA = PLACE_FIXTURES[0] as unknown as PlaceRead;
const placeB = PLACE_FIXTURES[1] as unknown as PlaceRead;

describe("PlaceDetail", () => {
  it("renders place name and fields", () => {
    render(
      <PlaceDetail
        place={placeA}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Test Place A")).toBeInTheDocument();
    expect(screen.getByText("123 Test St")).toBeInTheDocument();
    expect(screen.getByText("A test place")).toBeInTheDocument();
    expect(screen.getByText("restaurant")).toBeInTheDocument();
  });

  it("shows em dash for null address and description", () => {
    render(
      <PlaceDetail
        place={placeB}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // Test Place B has null description — should show em dashes
    const dashes = screen.getAllByText("\u2014");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("does not render category badge when category is null", () => {
    render(
      <PlaceDetail
        place={placeB}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByText("restaurant")).not.toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    render(
      <PlaceDetail
        place={placeA}
        onBack={onBack}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByText(/Back to list/));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("calls onEdit when Edit button is clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(
      <PlaceDetail
        place={placeA}
        onBack={vi.fn()}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Edit"));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("calls onDelete when Delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(
      <PlaceDetail
        place={placeA}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
