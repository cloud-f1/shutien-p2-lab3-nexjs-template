import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Checkbox } from "../Checkbox";
import { FormField } from "../FormField";

describe("Checkbox", () => {
  it("renders with a string label and toggles on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox label="Agree to terms" onChange={onChange} />);
    const cb = screen.getByRole("checkbox", { name: /agree to terms/i });
    expect(cb).not.toBeChecked();
    await user.click(cb);
    expect(onChange).toHaveBeenCalled();
  });

  it("supports a ReactNode label", () => {
    render(
      <Checkbox
        label={<span data-testid="rich-label">Rich</span>}
      />,
    );
    expect(screen.getByTestId("rich-label")).toBeInTheDocument();
  });

  it("forwards refs and renders disabled state", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Checkbox ref={ref} label="x" disabled />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByRole("checkbox", { name: /x/i })).toBeDisabled();
  });

  it("respects controlled `checked` prop", () => {
    render(<Checkbox label="x" checked readOnly />);
    expect(screen.getByRole("checkbox", { name: /x/i })).toBeChecked();
  });

  it("composes inside <FormField>", () => {
    render(
      <FormField label="Notifications" htmlFor="notify">
        <Checkbox id="notify" label="Email me weekly" />
      </FormField>,
    );
    // FormField label + checkbox label both render
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /email me weekly/i }),
    ).toBeInTheDocument();
  });
});
