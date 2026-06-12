import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, afterEach } from "vitest";
import { Drawer, type DrawerSide } from "../Drawer";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

function ControlledDrawer({
  side = "right",
  closeOnEsc,
  closeOnBackdrop,
}: {
  side?: DrawerSide;
  closeOnEsc?: boolean;
  closeOnBackdrop?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Drawer
      open={open}
      onClose={() => setOpen(false)}
      title="Filters"
      side={side}
      closeOnEsc={closeOnEsc}
      closeOnBackdrop={closeOnBackdrop}
    >
      <p>Drawer body</p>
      <button type="button">Apply</button>
    </Drawer>
  );
}

describe("Drawer", () => {
  it("renders nothing when closed", () => {
    render(
      <Drawer open={false} onClose={() => {}} title="Hidden">
        <p>x</p>
      </Drawer>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders dialog with title and body when open", () => {
    render(<ControlledDrawer />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Filters")).toBeInTheDocument();
    expect(screen.getByText("Drawer body")).toBeInTheDocument();
  });

  it("anchors to the right side by default", () => {
    render(<ControlledDrawer />);
    expect(screen.getByRole("dialog").className).toContain("right-0");
  });

  it("anchors to the left side when side='left'", () => {
    render(<ControlledDrawer side="left" />);
    expect(screen.getByRole("dialog").className).toContain("left-0");
  });

  it("closes on ESC by default", async () => {
    const user = userEvent.setup();
    render(<ControlledDrawer />);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not close on ESC when closeOnEsc=false", async () => {
    const user = userEvent.setup();
    render(<ControlledDrawer closeOnEsc={false} />);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes when backdrop is clicked (default)", async () => {
    const user = userEvent.setup();
    render(<ControlledDrawer />);
    await user.click(screen.getByTestId("drawer-backdrop"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not close on backdrop click when closeOnBackdrop=false", async () => {
    const user = userEvent.setup();
    render(<ControlledDrawer closeOnBackdrop={false} />);
    await user.click(screen.getByTestId("drawer-backdrop"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("close button dismisses the drawer", async () => {
    const user = userEvent.setup();
    render(<ControlledDrawer />);
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
