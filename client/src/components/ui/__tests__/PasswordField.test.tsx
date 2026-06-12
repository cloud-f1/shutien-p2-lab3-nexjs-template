import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { PasswordField } from "../PasswordField";

describe("PasswordField", () => {
  it("renders password input with label", () => {
    render(<PasswordField label="Password" id="pw" />);

    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("toggles show/hide changes input type", async () => {
    const user = userEvent.setup();
    render(<PasswordField label="Password" id="pw" />);

    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(input).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: /hide password/i }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("shows strength bars when showStrength is enabled and user types a strong password", async () => {
    const user = userEvent.setup();
    render(<PasswordField label="Password" id="pw" showStrength />);

    const input = screen.getByLabelText("Password");

    // Type a strong password (>=8 chars, uppercase, digit, special)
    await user.type(input, "Strong1!");

    const bars = document.querySelectorAll(".pw-bar");
    expect(bars.length).toBe(4);

    // All bars should have the "strong" class
    bars.forEach((bar) => {
      expect(bar.className).toContain("strong");
    });
  });

  it("shows weak strength for a weak password", async () => {
    const user = userEvent.setup();
    render(<PasswordField label="Password" id="pw" showStrength />);

    const input = screen.getByLabelText("Password");

    // Type a weak password (>=8 lowercase only = score 1)
    await user.type(input, "abcdefgh");

    const bars = document.querySelectorAll(".pw-bar");
    // First bar should be "weak", rest plain
    expect(bars[0].className).toContain("weak");
    expect(bars[1].className).not.toContain("weak");
  });

  it("displays strength message", async () => {
    const user = userEvent.setup();
    render(<PasswordField label="Password" id="pw" showStrength />);

    const input = screen.getByLabelText("Password");
    await user.type(input, "Strong1!");

    expect(screen.getByText(/strong password/i)).toBeInTheDocument();
  });
});
