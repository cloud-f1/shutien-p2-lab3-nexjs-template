import { render, screen } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { Prose } from "../Prose";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

describe("Prose", () => {
  it("renders children inside an <article> by default", () => {
    const { container } = render(
      <Prose>
        <h1>Heading</h1>
        <p>paragraph</p>
      </Prose>,
    );
    expect(container.querySelector("article")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Heading",
    );
    expect(screen.getByText("paragraph")).toBeInTheDocument();
  });

  it("supports a `as` override", () => {
    const { container } = render(
      <Prose as="div">
        <p>x</p>
      </Prose>,
    );
    expect(container.querySelector("div")).not.toBeNull();
    expect(container.querySelector("article")).toBeNull();
  });

  it("merges an extra className onto the shell", () => {
    const { container } = render(
      <Prose className="extra-cls">
        <p>x</p>
      </Prose>,
    );
    const article = container.querySelector("article");
    expect(article?.className).toContain("extra-cls");
  });
});
