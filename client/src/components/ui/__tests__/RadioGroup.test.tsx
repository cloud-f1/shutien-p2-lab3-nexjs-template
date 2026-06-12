import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { RadioGroup } from "../RadioGroup";
import { FormField } from "../FormField";

const PLANS = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
  { value: "ent", label: "Enterprise" },
];

describe("RadioGroup", () => {
  it("renders a radiogroup with three radios sharing a name", () => {
    render(
      <RadioGroup
        name="plan"
        value="free"
        options={PLANS}
        aria-label="Plan"
      />,
    );
    expect(screen.getByRole("radiogroup", { name: /plan/i })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    radios.forEach((r) => expect(r).toHaveAttribute("name", "plan"));
  });

  it("marks the matching value as checked and fires onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup
        name="plan"
        value="free"
        onChange={onChange}
        options={PLANS}
        aria-label="Plan"
      />,
    );
    expect(screen.getByRole("radio", { name: "Free" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Pro" }));
    expect(onChange).toHaveBeenCalledWith("pro");
  });

  it("updates selection in a controlled harness", async () => {
    function Harness() {
      const [v, setV] = useState("free");
      return (
        <RadioGroup
          name="plan"
          value={v}
          onChange={setV}
          options={PLANS}
          aria-label="Plan"
        />
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: "Enterprise" }));
    expect(screen.getByRole("radio", { name: "Enterprise" })).toBeChecked();
  });

  it("disables every radio when `disabled` is true", () => {
    render(
      <RadioGroup
        name="plan"
        value="free"
        options={PLANS}
        disabled
        aria-label="Plan"
      />,
    );
    screen.getAllByRole("radio").forEach((r) => expect(r).toBeDisabled());
  });

  it("composes inside <FormField>", () => {
    render(
      <FormField label="Plan" htmlFor="plan">
        <RadioGroup
          name="plan"
          value="free"
          options={PLANS}
          aria-label="Plan"
        />
      </FormField>,
    );
    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: /plan/i })).toBeInTheDocument();
  });
});
