import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Modal } from "../Modal";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

function ControlledModal({
  initialOpen = true,
  closeOnEsc,
  closeOnBackdrop,
}: {
  initialOpen?: boolean;
  closeOnEsc?: boolean;
  closeOnBackdrop?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Confirm action"
        closeOnEsc={closeOnEsc}
        closeOnBackdrop={closeOnBackdrop}
      >
        <p>Body content</p>
        <button type="button">Inner action</button>
      </Modal>
    </>
  );
}

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hidden">
        <p>Hidden body</p>
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders dialog with title and body when open", () => {
    render(<ControlledModal />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Confirm action")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("calls onClose when ESC is pressed (default)", async () => {
    const user = userEvent.setup();
    render(<ControlledModal />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not close on ESC when closeOnEsc=false", async () => {
    const user = userEvent.setup();
    render(<ControlledModal closeOnEsc={false} />);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked (default)", async () => {
    const user = userEvent.setup();
    render(<ControlledModal />);
    const backdrop = screen.getByTestId("modal-backdrop");
    await user.click(backdrop);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not close on backdrop click when closeOnBackdrop=false", async () => {
    const user = userEvent.setup();
    render(<ControlledModal closeOnBackdrop={false} />);
    const backdrop = screen.getByTestId("modal-backdrop");
    await user.click(backdrop);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders a localized close button that dismisses the modal", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="t">
        <p>x</p>
      </Modal>,
    );
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("traps focus inside the dialog", async () => {
    render(<ControlledModal />);
    // Wait a tick for the focus-trap effect to fire.
    await new Promise((r) => setTimeout(r, 10));
    // Some focusable element inside the dialog should hold focus.
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
