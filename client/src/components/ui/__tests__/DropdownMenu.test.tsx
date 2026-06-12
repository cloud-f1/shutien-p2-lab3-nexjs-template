import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { DropdownMenu } from "../DropdownMenu";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

describe("DropdownMenu (uncontrolled)", () => {
  it("renders trigger and a hidden menu by default", () => {
    render(
      <DropdownMenu trigger="Open menu" ariaLabel="Test menu">
        <button type="button">Item A</button>
      </DropdownMenu>,
    );
    const trigger = screen.getByRole("button", { name: /open menu/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");

    const menu = screen.getByTestId("dropdown-menu");
    expect(menu).toHaveAttribute("role", "menu");
    expect(menu).toHaveAttribute("aria-hidden", "true");
  });

  it("opens on click and toggles aria-expanded", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu trigger="Open" ariaLabel="m">
        <button type="button">Item A</button>
      </DropdownMenu>,
    );
    const trigger = screen.getByRole("button", { name: /open/i });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("dropdown-menu")).toHaveAttribute(
      "aria-hidden",
      "false",
    );

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on ESC and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu trigger="Open" ariaLabel="m" defaultOpen>
        <button type="button">Item A</button>
      </DropdownMenu>,
    );
    const trigger = screen.getByRole("button", { name: /open/i });
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(trigger);
  });

  it("closes when clicking outside the wrapper", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <DropdownMenu trigger="Open" ariaLabel="m" defaultOpen>
          <button type="button">Item A</button>
        </DropdownMenu>
        <button type="button">Outside</button>
      </div>,
    );
    const trigger = screen.getByRole("button", { name: /^open$/i });
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: /outside/i }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("does NOT close on outside click when closeOnOutsideClick=false", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <DropdownMenu
          trigger="Open"
          ariaLabel="m"
          defaultOpen
          closeOnOutsideClick={false}
        >
          <button type="button">Item A</button>
        </DropdownMenu>
        <button type="button">Outside</button>
      </div>,
    );
    const trigger = screen.getByRole("button", { name: /^open$/i });

    await user.click(screen.getByRole("button", { name: /outside/i }));
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});

describe("DropdownMenu (controlled)", () => {
  function Controlled() {
    const [open, setOpen] = useState(false);
    return (
      <DropdownMenu
        trigger="C"
        ariaLabel="cm"
        open={open}
        onOpenChange={setOpen}
      >
        <button type="button">Item</button>
      </DropdownMenu>
    );
  }

  it("calls onOpenChange when toggled", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <DropdownMenu
        trigger="X"
        ariaLabel="z"
        open={false}
        onOpenChange={onOpenChange}
      >
        <button type="button">Item</button>
      </DropdownMenu>,
    );
    await user.click(screen.getByRole("button", { name: /^x$/i }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("respects controlled open prop", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    const trigger = screen.getByRole("button", { name: /^c$/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
