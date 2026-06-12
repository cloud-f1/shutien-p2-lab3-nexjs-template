import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { NumberInput } from "../NumberInput";
import { FormField } from "../FormField";

describe("NumberInput", () => {
  it("renders <input type=number> with min/max/step", () => {
    render(
      <NumberInput
        aria-label="qty"
        min={0}
        max={10}
        step={2}
        defaultValue={4}
      />,
    );
    const input = screen.getByRole("spinbutton", { name: /qty/i });
    expect(input).toHaveAttribute("type", "number");
    expect(input).toHaveAttribute("min", "0");
    expect(input).toHaveAttribute("max", "10");
    expect(input).toHaveAttribute("step", "2");
  });

  it("forwards refs", () => {
    const ref = createRef<HTMLInputElement>();
    render(<NumberInput ref={ref} aria-label="qty" defaultValue={1} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("renders disabled and invalid states", () => {
    render(
      <NumberInput aria-label="qty" disabled invalid defaultValue={3} />,
    );
    const input = screen.getByRole("spinbutton", { name: /qty/i });
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("composes inside <FormField>", () => {
    render(
      <FormField label="Quantity" htmlFor="qty">
        <NumberInput id="qty" defaultValue={1} />
      </FormField>,
    );
    expect(screen.getByLabelText("Quantity")).toBeInTheDocument();
  });
});
