import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import PlaceFormModal from "../PlaceFormModal";
import { PLACE_FIXTURES } from "../../../../tests/handlers/places";
import type { PlaceRead } from "../../../../schemas/place";

const placeA = PLACE_FIXTURES[0] as unknown as PlaceRead;

describe("PlaceFormModal", () => {
  it("renders Add Place form when no place is provided", () => {
    render(
      <PlaceFormModal
        isPending={false}
        error={null}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // "Add Place" appears both as title and submit button
    expect(screen.getByRole("button", { name: "Add Place" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name *")).toBeInTheDocument();
    expect(screen.getByLabelText("Latitude *")).toBeInTheDocument();
    expect(screen.getByLabelText("Longitude *")).toBeInTheDocument();
  });

  it("renders Edit Place form when place is provided", () => {
    render(
      <PlaceFormModal
        place={placeA}
        isPending={false}
        error={null}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Edit Place")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Test Place A")).toBeInTheDocument();
  });

  it("shows error banner when error prop is set", () => {
    render(
      <PlaceFormModal
        isPending={false}
        error="Something went wrong"
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows Saving text when isPending is true", () => {
    render(
      <PlaceFormModal
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
      <PlaceFormModal
        isPending={false}
        error={null}
        onSubmit={vi.fn()}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when overlay background is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <PlaceFormModal
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

  it("pre-fills form values in edit mode", () => {
    render(
      <PlaceFormModal
        place={placeA}
        isPending={false}
        error={null}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("Test Place A")).toBeInTheDocument();
    expect(screen.getByDisplayValue("123 Test St")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A test place")).toBeInTheDocument();
    expect(screen.getByDisplayValue("25.033")).toBeInTheDocument();
    expect(screen.getByDisplayValue("121.565")).toBeInTheDocument();
    expect(screen.getByDisplayValue("restaurant")).toBeInTheDocument();
  });

  it("shows Update Place button text in edit mode", () => {
    render(
      <PlaceFormModal
        place={placeA}
        isPending={false}
        error={null}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Update Place" })).toBeInTheDocument();
  });
});
