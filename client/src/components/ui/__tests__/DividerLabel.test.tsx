import { render, screen } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { DividerLabel } from "../DividerLabel";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

describe("DividerLabel", () => {
  it("renders the label text", () => {
    render(<DividerLabel>or sign in with</DividerLabel>);
    expect(screen.getByText("or sign in with")).toBeInTheDocument();
  });

  it("uses role=separator with horizontal orientation", () => {
    render(<DividerLabel>or</DividerLabel>);
    const sep = screen.getByRole("separator");
    expect(sep).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("merges a custom className", () => {
    render(<DividerLabel className="extra-cls">or</DividerLabel>);
    expect(screen.getByRole("separator").className).toContain("extra-cls");
  });
});
