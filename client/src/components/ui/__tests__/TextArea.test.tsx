import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TextArea } from "../TextArea";
import { FormField } from "../FormField";

describe("TextArea", () => {
  it("renders a textarea with default rows=4", () => {
    render(<TextArea aria-label="bio" defaultValue="" />);
    const ta = screen.getByRole("textbox", { name: /bio/i });
    expect(ta.tagName).toBe("TEXTAREA");
    expect(ta).toHaveAttribute("rows", "4");
  });

  it("accepts typing (controlled-ish via change handler)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TextArea aria-label="bio" defaultValue="" onChange={onChange} />);
    await user.type(screen.getByRole("textbox", { name: /bio/i }), "a");
    expect(onChange).toHaveBeenCalled();
  });

  it("forwards refs", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<TextArea ref={ref} aria-label="x" defaultValue="hi" />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it("renders disabled state and aria-invalid", () => {
    render(<TextArea aria-label="bio" disabled invalid defaultValue="" />);
    const ta = screen.getByRole("textbox", { name: /bio/i });
    expect(ta).toBeDisabled();
    expect(ta).toHaveAttribute("aria-invalid", "true");
  });

  it("composes inside <FormField>", () => {
    render(
      <FormField label="Bio" htmlFor="bio">
        <TextArea id="bio" defaultValue="" />
      </FormField>,
    );
    expect(screen.getByLabelText("Bio")).toBeInTheDocument();
  });
});
