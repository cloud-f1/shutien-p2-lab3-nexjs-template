import { render, screen } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { Section } from "../Section";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

describe("Section", () => {
  it("renders label, title, lede, and children", () => {
    render(
      <Section label="HOW IT WORKS" title="Pipeline" lede="Step by step.">
        <p>body content</p>
      </Section>,
    );
    expect(screen.getByText("HOW IT WORKS")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Pipeline" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Step by step.")).toBeInTheDocument();
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it("renders without optional title/label/lede", () => {
    render(
      <Section ariaLabel="bare">
        <span>only-children</span>
      </Section>,
    );
    expect(
      screen.getByRole("region", { name: "bare" }),
    ).toBeInTheDocument();
    expect(screen.getByText("only-children")).toBeInTheDocument();
  });

  it("forwards id to the section element", () => {
    const { container } = render(
      <Section id="features">
        <span>x</span>
      </Section>,
    );
    expect(container.querySelector("section#features")).not.toBeNull();
  });
});
