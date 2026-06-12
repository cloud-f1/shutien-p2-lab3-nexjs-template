import { render, screen } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { CTABanner } from "../CTABanner";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

describe("CTABanner", () => {
  it("renders eyebrow, title, subtitle, actions, and note", () => {
    render(
      <CTABanner
        eyebrow="Ready?"
        title="Start now"
        subtitle="Free forever"
        actions={<button>Sign up</button>}
        note="No credit card required"
      />,
    );
    expect(screen.getByText("Ready?")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Start now" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Free forever")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign up" })).toBeInTheDocument();
    expect(screen.getByText("No credit card required")).toBeInTheDocument();
  });

  it("renders the title even with no other slots", () => {
    render(<CTABanner title="Only title" />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Only title" }),
    ).toBeInTheDocument();
  });
});
