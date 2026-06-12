import { render, screen } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { AuthLayout } from "../AuthLayout";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

describe("AuthLayout", () => {
  it("renders its children", () => {
    render(
      <AuthLayout>
        <div data-testid="content">hello</div>
      </AuthLayout>,
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("renders as <main id='main-content'> for skip-nav landmarks", () => {
    render(
      <AuthLayout>
        <p>x</p>
      </AuthLayout>,
    );
    const main = document.getElementById("main-content");
    expect(main).toBeInTheDocument();
    expect(main?.tagName).toBe("MAIN");
  });

  it("applies the preset shell classes", () => {
    render(
      <AuthLayout>
        <p>x</p>
      </AuthLayout>,
    );
    const shell = document.getElementById("main-content") as HTMLElement;
    expect(shell.className).toContain("min-h-screen");
    expect(shell.className).toContain("flex");
  });

  it("merges a custom className onto the shell", () => {
    render(
      <AuthLayout className="custom-extra">
        <p>x</p>
      </AuthLayout>,
    );
    const shell = document.getElementById("main-content") as HTMLElement;
    expect(shell.className).toContain("custom-extra");
  });
});
