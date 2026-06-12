import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Disclosure } from "../Disclosure";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

describe("Disclosure (uncontrolled)", () => {
  it("renders trigger collapsed by default with aria-expanded=false", () => {
    render(
      <Disclosure summary="What is this?">Some content here</Disclosure>,
    );
    const trigger = screen.getByRole("button", { name: /what is this/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    // Panel exists (for aria-controls target) but is hidden.
    const panel = document.getElementById(
      trigger.getAttribute("aria-controls") ?? "",
    );
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute("hidden");
  });

  it("toggles open / closed when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Disclosure summary="Toggle me">Body content</Disclosure>,
    );
    const trigger = screen.getByRole("button", { name: /toggle me/i });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Body content")).toBeVisible();
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("respects defaultOpen", () => {
    render(
      <Disclosure summary="Open" defaultOpen>
        body
      </Disclosure>,
    );
    expect(
      screen.getByRole("button", { name: /open/i }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("wires aria-controls between trigger and region", () => {
    render(
      <Disclosure summary="X" defaultOpen>
        body
      </Disclosure>,
    );
    const trigger = screen.getByRole("button", { name: /^x$/i });
    const region = screen.getByRole("region");
    expect(trigger.getAttribute("aria-controls")).toBe(region.id);
    expect(region.getAttribute("aria-labelledby")).toBe(trigger.id);
  });

  it("disabled trigger does not open", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Disclosure summary="X" disabled onOpenChange={onOpenChange}>
        body
      </Disclosure>,
    );
    await user.click(screen.getByRole("button", { name: /^x$/i }));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("Disclosure (controlled)", () => {
  function Controlled() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          force-open
        </button>
        <Disclosure open={open} onOpenChange={setOpen} summary="C">
          body
        </Disclosure>
      </>
    );
  }

  it("respects controlled open prop and external updates", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    expect(screen.getByRole("button", { name: /^c$/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await user.click(screen.getByRole("button", { name: /force-open/i }));
    expect(screen.getByRole("button", { name: /^c$/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("calls onOpenChange when toggled", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Disclosure open={false} onOpenChange={onOpenChange} summary="X">
        body
      </Disclosure>,
    );
    await user.click(screen.getByRole("button", { name: /^x$/i }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});
