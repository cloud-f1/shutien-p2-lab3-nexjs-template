import { render, screen } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { HeroSection } from "../HeroSection";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

describe("HeroSection", () => {
  it("renders the title as an h1 plus eyebrow + subtitle", () => {
    render(
      <HeroSection
        eyebrow="Open Source"
        title="Ship faster"
        subtitle="A description"
      />,
    );
    expect(screen.getByText("Open Source")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Ship faster" }),
    ).toBeInTheDocument();
    expect(screen.getByText("A description")).toBeInTheDocument();
  });

  it("renders the actions cluster + visual slot", () => {
    render(
      <HeroSection
        title="Title"
        actions={<button>CTA</button>}
        visual={<div data-testid="visual">visual</div>}
      />,
    );
    expect(screen.getByRole("button", { name: "CTA" })).toBeInTheDocument();
    expect(screen.getByTestId("visual")).toBeInTheDocument();
  });

  it("forwards id to the section", () => {
    const { container } = render(
      <HeroSection id="hero" title="Title" />,
    );
    expect(container.querySelector("section#hero")).not.toBeNull();
  });
});
