import { render, screen } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { EmptyState } from "../EmptyState";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

describe("EmptyState", () => {
  it("renders code, title, subtitle, and CTA", () => {
    render(
      <EmptyState
        code="404"
        title="Not Found"
        subtitle="The page does not exist."
        cta={<a href="/">Back home</a>}
      />,
    );
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Not Found" }),
    ).toBeInTheDocument();
    expect(screen.getByText("The page does not exist.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back home" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("renders without optional code, subtitle, or CTA", () => {
    render(<EmptyState title="No data" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "No data" }),
    ).toBeInTheDocument();
  });
});
