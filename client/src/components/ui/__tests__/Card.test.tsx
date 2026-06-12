import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { Card, CardHeader, CardFooter } from "../Card";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

describe("Card", () => {
  it("renders children inside a styled shell", () => {
    render(
      <Card data-testid="c">
        <p>Body</p>
      </Card>,
    );
    const el = screen.getByTestId("c");
    expect(el).toHaveClass("rounded-lg");
    expect(el).toHaveTextContent("Body");
  });

  it("renders header and footer slots when provided", () => {
    render(
      <Card
        header={<span data-testid="head">H</span>}
        footer={<span data-testid="foot">F</span>}
      >
        body
      </Card>,
    );
    expect(screen.getByTestId("head")).toBeInTheDocument();
    expect(screen.getByTestId("foot")).toBeInTheDocument();
  });

  it("does NOT render header/footer wrappers when slots are undefined", () => {
    const { container } = render(<Card data-testid="c">body</Card>);
    // shell + body only — no header/footer wrappers
    const shell = container.querySelector('[data-testid="c"]');
    expect(shell?.children.length).toBe(1);
  });

  it("applies padding token classes", () => {
    render(
      <Card padding="lg" data-testid="c">
        x
      </Card>,
    );
    expect(screen.getByTestId("c")).toHaveClass("p-7");
  });

  it("applies variant classes (panel)", () => {
    render(
      <Card variant="panel" data-testid="c">
        x
      </Card>,
    );
    expect(screen.getByTestId("c").className).toContain("bg-surface/60");
  });

  it("forwards ref to outer div", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Card ref={ref} data-testid="c">
        x
      </Card>,
    );
    expect(ref.current).toBe(screen.getByTestId("c"));
  });
});

describe("CardHeader / CardFooter", () => {
  it("CardHeader renders title + subtitle + actions", () => {
    render(
      <CardHeader
        title="Recent activity"
        subtitle="Last 24h"
        actions={<button type="button">View</button>}
      />,
    );
    expect(screen.getByText("Recent activity")).toBeInTheDocument();
    expect(screen.getByText("Last 24h")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view/i })).toBeInTheDocument();
  });

  it("CardFooter renders provided children", () => {
    render(
      <CardFooter data-testid="f">
        <button type="button">Save</button>
      </CardFooter>,
    );
    expect(screen.getByTestId("f")).toContainElement(
      screen.getByRole("button", { name: /save/i }),
    );
  });
});
