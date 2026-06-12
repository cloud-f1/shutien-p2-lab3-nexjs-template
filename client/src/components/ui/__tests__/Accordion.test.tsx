import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Accordion } from "../Accordion";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

function Sample({
  type = "single",
  defaultValue,
}: {
  type?: "single" | "multiple";
  defaultValue?: string | string[];
}) {
  return (
    <Accordion type={type} defaultValue={defaultValue}>
      <Accordion.Item value="a">
        <Accordion.Trigger>Q1</Accordion.Trigger>
        <Accordion.Panel>A1 body</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="b">
        <Accordion.Trigger>Q2</Accordion.Trigger>
        <Accordion.Panel>A2 body</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="c">
        <Accordion.Trigger>Q3</Accordion.Trigger>
        <Accordion.Panel>A3 body</Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}

describe("Accordion (single, uncontrolled)", () => {
  it("starts with all panels closed when no defaultValue", () => {
    render(<Sample />);
    const triggers = screen.getAllByRole("button");
    triggers.forEach((t) =>
      expect(t).toHaveAttribute("aria-expanded", "false"),
    );
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("opens an item on click and closes others (single mode)", async () => {
    const user = userEvent.setup();
    render(<Sample />);
    await user.click(screen.getByRole("button", { name: /q1/i }));
    expect(screen.getByRole("button", { name: /q1/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("A1 body")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /q2/i }));
    expect(screen.getByRole("button", { name: /q1/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: /q2/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("respects defaultValue", () => {
    render(<Sample defaultValue="b" />);
    expect(screen.getByRole("button", { name: /q2/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("A2 body")).toBeInTheDocument();
  });

  it("wires aria-controls between trigger and panel region", async () => {
    const user = userEvent.setup();
    render(<Sample />);
    await user.click(screen.getByRole("button", { name: /q1/i }));
    const trigger = screen.getByRole("button", { name: /q1/i });
    const region = screen.getByRole("region");
    expect(trigger.getAttribute("aria-controls")).toBe(region.id);
    expect(region.getAttribute("aria-labelledby")).toBe(trigger.id);
  });
});

describe("Accordion (multiple)", () => {
  it("allows multiple items to be open simultaneously", async () => {
    const user = userEvent.setup();
    render(<Sample type="multiple" />);
    await user.click(screen.getByRole("button", { name: /q1/i }));
    await user.click(screen.getByRole("button", { name: /q2/i }));
    expect(screen.getByRole("button", { name: /q1/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: /q2/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getAllByRole("region")).toHaveLength(2);
  });
});

describe("Accordion (controlled)", () => {
  function Controlled() {
    const [value, setValue] = useState<string>("a");
    return (
      <Accordion
        type="single"
        value={value}
        onValueChange={(v) => setValue(v as string)}
      >
        <Accordion.Item value="a">
          <Accordion.Trigger>Q1</Accordion.Trigger>
          <Accordion.Panel>A1</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="b">
          <Accordion.Trigger>Q2</Accordion.Trigger>
          <Accordion.Panel>A2</Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    );
  }

  it("respects controlled value and onValueChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Accordion type="single" value="a" onValueChange={onChange}>
        <Accordion.Item value="a">
          <Accordion.Trigger>Q1</Accordion.Trigger>
          <Accordion.Panel>A1</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="b">
          <Accordion.Trigger>Q2</Accordion.Trigger>
          <Accordion.Panel>A2</Accordion.Panel>
        </Accordion.Item>
      </Accordion>,
    );
    await user.click(screen.getByRole("button", { name: /q2/i }));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("controlled state drives the open item", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    expect(screen.getByRole("button", { name: /q1/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await user.click(screen.getByRole("button", { name: /q2/i }));
    expect(screen.getByRole("button", { name: /q2/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});
