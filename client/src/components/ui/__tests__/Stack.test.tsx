import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { Stack, HStack, VStack } from "../Stack";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

describe("Stack", () => {
  it("renders children inside a flex container with vertical default", () => {
    render(
      <Stack data-testid="s">
        <span>a</span>
        <span>b</span>
      </Stack>,
    );
    const el = screen.getByTestId("s");
    expect(el).toHaveClass("flex");
    expect(el).toHaveClass("flex-col");
  });

  it("applies the horizontal direction and the requested gap token", () => {
    render(
      <Stack direction="horizontal" gap="lg" data-testid="s">
        x
      </Stack>,
    );
    const el = screen.getByTestId("s");
    expect(el).toHaveClass("flex-row");
    expect(el).toHaveClass("gap-6");
  });

  it("applies align + justify + wrap classes when provided", () => {
    render(
      <Stack align="center" justify="between" wrap data-testid="s">
        x
      </Stack>,
    );
    const el = screen.getByTestId("s");
    expect(el).toHaveClass("items-center");
    expect(el).toHaveClass("justify-between");
    expect(el).toHaveClass("flex-wrap");
  });

  it("forwards ref to the underlying div", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Stack ref={ref} data-testid="s">
        x
      </Stack>,
    );
    expect(ref.current).toBe(screen.getByTestId("s"));
  });

  it("HStack alias forces horizontal direction", () => {
    render(
      <HStack data-testid="h" gap="sm">
        x
      </HStack>,
    );
    expect(screen.getByTestId("h")).toHaveClass("flex-row");
    expect(screen.getByTestId("h")).toHaveClass("gap-2");
  });

  it("VStack alias forces vertical direction", () => {
    render(
      <VStack data-testid="v">
        x
      </VStack>,
    );
    expect(screen.getByTestId("v")).toHaveClass("flex-col");
  });
});
