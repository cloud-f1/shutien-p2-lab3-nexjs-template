import { render, screen } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { AuthCard } from "../AuthCard";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

describe("AuthCard", () => {
  it("renders the title as a heading", () => {
    render(
      <AuthCard title="Welcome back">
        <p>body</p>
      </AuthCard>,
    );
    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(
      <AuthCard title="Sign in" subtitle="No account? Sign up">
        <p>body</p>
      </AuthCard>,
    );
    expect(screen.getByText("No account? Sign up")).toBeInTheDocument();
  });

  it("does not render a subtitle element when omitted", () => {
    const { container } = render(
      <AuthCard title="Sign in">
        <p>body</p>
      </AuthCard>,
    );
    expect(container.querySelector("p")).toHaveTextContent("body");
  });

  it("renders the body slot", () => {
    render(
      <AuthCard title="Sign in">
        <button type="submit">Continue</button>
      </AuthCard>,
    );
    expect(
      screen.getByRole("button", { name: "Continue" }),
    ).toBeInTheDocument();
  });

  it("renders the footer slot when provided", () => {
    render(
      <AuthCard title="Sign in" footer={<a href="/back">back</a>}>
        <p>body</p>
      </AuthCard>,
    );
    expect(screen.getByRole("link", { name: "back" })).toBeInTheDocument();
  });

  it("renders the logo slot when provided", () => {
    render(
      <AuthCard title="Sign in" logo={<span data-testid="logo">L</span>}>
        <p>body</p>
      </AuthCard>,
    );
    expect(screen.getByTestId("logo")).toBeInTheDocument();
  });
});
