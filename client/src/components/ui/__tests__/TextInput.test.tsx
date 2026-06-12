import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TextInput } from "../TextInput";
import { FormField } from "../FormField";

describe("TextInput", () => {
  it("renders an input and accepts typing (controlled)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TextInput
        aria-label="username"
        value=""
        onChange={onChange}
        placeholder="enter name"
      />,
    );
    const input = screen.getByRole("textbox", { name: /username/i });
    expect(input).toHaveAttribute("type", "text");
    await user.type(input, "a");
    expect(onChange).toHaveBeenCalled();
  });

  it("forwards refs to the underlying input", () => {
    const ref = createRef<HTMLInputElement>();
    render(<TextInput ref={ref} aria-label="x" defaultValue="hi" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.value).toBe("hi");
  });

  it("renders disabled state", () => {
    render(<TextInput aria-label="x" disabled defaultValue="" />);
    expect(screen.getByRole("textbox", { name: /x/i })).toBeDisabled();
  });

  it("sets aria-invalid when `invalid` prop is true", () => {
    render(<TextInput aria-label="x" invalid defaultValue="" />);
    expect(screen.getByRole("textbox", { name: /x/i })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("composes inside <FormField> with shared id", () => {
    render(
      <FormField label="Email" htmlFor="email">
        <TextInput id="email" type="email" defaultValue="" />
      </FormField>,
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
  });
});
