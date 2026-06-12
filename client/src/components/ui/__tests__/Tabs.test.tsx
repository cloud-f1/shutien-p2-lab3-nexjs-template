import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Tabs } from "../Tabs";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

function Sample({ defaultValue = "a" }: { defaultValue?: string }) {
  return (
    <Tabs defaultValue={defaultValue}>
      <Tabs.List ariaLabel="Sections">
        <Tabs.Trigger value="a">Alpha</Tabs.Trigger>
        <Tabs.Trigger value="b">Beta</Tabs.Trigger>
        <Tabs.Trigger value="c">Gamma</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Panel value="a">Alpha body</Tabs.Panel>
      <Tabs.Panel value="b">Beta body</Tabs.Panel>
      <Tabs.Panel value="c">Gamma body</Tabs.Panel>
    </Tabs>
  );
}

describe("Tabs (uncontrolled)", () => {
  it("renders the active panel and hides the others", () => {
    render(<Sample />);
    expect(screen.getByRole("tablist")).toHaveAttribute(
      "aria-label",
      "Sections",
    );
    const triggers = screen.getAllByRole("tab");
    expect(triggers).toHaveLength(3);
    expect(triggers[0]).toHaveAttribute("aria-selected", "true");
    expect(triggers[1]).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Alpha body");
  });

  it("clicking a trigger switches the active panel", async () => {
    const user = userEvent.setup();
    render(<Sample />);
    await user.click(screen.getByRole("tab", { name: /beta/i }));
    expect(screen.getByRole("tab", { name: /beta/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Beta body");
  });

  it("ArrowRight cycles to the next trigger and ArrowLeft cycles back", async () => {
    const user = userEvent.setup();
    render(<Sample />);
    const first = screen.getByRole("tab", { name: /alpha/i });
    first.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /beta/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: /alpha/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("Home / End jump to the first / last trigger", async () => {
    const user = userEvent.setup();
    render(<Sample />);
    const first = screen.getByRole("tab", { name: /alpha/i });
    first.focus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: /gamma/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: /alpha/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("wires aria-controls / aria-labelledby between triggers and panels", () => {
    render(<Sample defaultValue="b" />);
    const trigger = screen.getByRole("tab", { name: /beta/i });
    const panel = screen.getByRole("tabpanel");
    expect(trigger.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.getAttribute("aria-labelledby")).toBe(trigger.id);
  });
});

describe("Tabs (controlled)", () => {
  function Controlled() {
    const [value, setValue] = useState("a");
    return (
      <>
        <button type="button" onClick={() => setValue("c")}>
          Jump-c
        </button>
        <Tabs value={value} onValueChange={setValue}>
          <Tabs.List>
            <Tabs.Trigger value="a">A</Tabs.Trigger>
            <Tabs.Trigger value="b">B</Tabs.Trigger>
            <Tabs.Trigger value="c">C</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Panel value="a">A body</Tabs.Panel>
          <Tabs.Panel value="b">B body</Tabs.Panel>
          <Tabs.Panel value="c">C body</Tabs.Panel>
        </Tabs>
      </>
    );
  }

  it("respects controlled value and reports onValueChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Tabs value="a" onValueChange={onChange}>
        <Tabs.List>
          <Tabs.Trigger value="a">A</Tabs.Trigger>
          <Tabs.Trigger value="b">B</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Panel value="a">A body</Tabs.Panel>
        <Tabs.Panel value="b">B body</Tabs.Panel>
      </Tabs>,
    );
    await user.click(screen.getByRole("tab", { name: /^b$/i }));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("external state updates are reflected in selected tab", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(screen.getByRole("button", { name: /jump-c/i }));
    expect(screen.getByRole("tab", { name: /^c$/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent("C body");
  });
});
