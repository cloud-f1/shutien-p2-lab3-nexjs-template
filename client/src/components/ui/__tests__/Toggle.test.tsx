import { createRef, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Toggle } from "../Toggle";

describe("Toggle", () => {
  it("renders as role=switch with aria-checked reflecting `checked`", () => {
    const { rerender } = render(
      <Toggle checked={false} aria-label="notifications" />,
    );
    const sw = screen.getByRole("switch", { name: /notifications/i });
    expect(sw).toHaveAttribute("aria-checked", "false");
    rerender(<Toggle checked={true} aria-label="notifications" />);
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("calls onCheckedChange with the new value when clicked", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <Toggle
        checked={false}
        onCheckedChange={onCheckedChange}
        aria-label="x"
      />,
    );
    await user.click(screen.getByRole("switch", { name: /x/i }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("toggles in a controlled harness", async () => {
    function Harness() {
      const [on, setOn] = useState(false);
      return <Toggle checked={on} onCheckedChange={setOn} aria-label="x" />;
    }
    const user = userEvent.setup();
    render(<Harness />);
    const sw = screen.getByRole("switch", { name: /x/i });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await user.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
    await user.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("forwards refs and renders disabled state", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Toggle ref={ref} checked={false} disabled aria-label="x" />,
    );
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(screen.getByRole("switch", { name: /x/i })).toBeDisabled();
  });

  it("renders an inline label when provided", () => {
    render(
      <Toggle
        checked={true}
        label="Email me weekly"
        aria-label="email-toggle"
      />,
    );
    expect(screen.getByText(/email me weekly/i)).toBeInTheDocument();
  });
});
