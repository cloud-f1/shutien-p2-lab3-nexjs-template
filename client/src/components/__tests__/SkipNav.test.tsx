import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SkipNav from "../SkipNav";

describe("SkipNav", () => {
  it("renders a skip link targeting #main-content", () => {
    render(<SkipNav />);
    const link = screen.getByText("Skip to main content");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "#main-content");
    expect(link).toHaveClass("skip-nav");
  });

  it("is an anchor element", () => {
    render(<SkipNav />);
    const link = screen.getByText("Skip to main content");
    expect(link.tagName).toBe("A");
  });
});
