import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import PlaceDeleteConfirm from "../PlaceDeleteConfirm";

describe("PlaceDeleteConfirm", () => {
  it("renders confirmation dialog with place name", () => {
    render(
      <PlaceDeleteConfirm
        placeName="Test Place"
        isPending={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Delete Place")).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
    expect(screen.getByText("Test Place")).toBeInTheDocument();
  });

  it("calls onConfirm when Delete button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <PlaceDeleteConfirm
        placeName="Test Place"
        isPending={false}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Delete"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <PlaceDeleteConfirm
        placeName="Test Place"
        isPending={false}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when overlay background is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <PlaceDeleteConfirm
        placeName="Test Place"
        isPending={false}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    // Click the overlay (the dialog role element)
    const overlay = screen.getByRole("dialog");
    await user.click(overlay);
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows pending state with Deleting text", () => {
    render(
      <PlaceDeleteConfirm
        placeName="Test Place"
        isPending={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/Deleting/)).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeDisabled();
  });

  it("disables buttons when isPending is true", () => {
    render(
      <PlaceDeleteConfirm
        placeName="Test Place"
        isPending={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Cancel")).toBeDisabled();
    expect(screen.getByText(/Deleting/).closest("button")).toBeDisabled();
  });
});
