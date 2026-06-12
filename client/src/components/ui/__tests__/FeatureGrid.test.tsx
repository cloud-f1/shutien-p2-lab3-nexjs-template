import { render, screen } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { FeatureGrid, FeatureCard } from "../FeatureGrid";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

describe("FeatureCard", () => {
  it("renders label, title, and description", () => {
    render(
      <FeatureCard
        label="Memory"
        title="Self-Learning"
        description="Captures wisdom across sessions."
      />,
    );
    expect(screen.getByText("Memory")).toBeInTheDocument();
    expect(screen.getByText("Self-Learning")).toBeInTheDocument();
    expect(
      screen.getByText("Captures wisdom across sessions."),
    ).toBeInTheDocument();
  });

  it("renders without an optional label", () => {
    render(<FeatureCard title="Bare title" />);
    expect(screen.getByText("Bare title")).toBeInTheDocument();
  });
});

describe("FeatureGrid", () => {
  it("renders children as grid items", () => {
    render(
      <FeatureGrid id="features">
        <FeatureCard title="A" />
        <FeatureCard title="B" />
        <FeatureCard title="C" />
      </FeatureGrid>,
    );
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  it("forwards id to the outer container", () => {
    const { container } = render(
      <FeatureGrid id="grid-id">
        <FeatureCard title="x" />
      </FeatureGrid>,
    );
    expect(container.querySelector("#grid-id")).not.toBeNull();
  });
});
