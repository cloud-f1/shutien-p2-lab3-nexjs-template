import { render, screen } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { PublicLayout } from "../PublicLayout";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

describe("PublicLayout", () => {
  it("renders children inside a <main> with default id", () => {
    render(
      <PublicLayout>
        <p>hello world</p>
      </PublicLayout>,
    );
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveTextContent("hello world");
  });

  it("renders nav and footer slots", () => {
    render(
      <PublicLayout
        nav={<nav aria-label="Top">nav-slot</nav>}
        footer={<footer>foot-slot</footer>}
      >
        <span>body</span>
      </PublicLayout>,
    );
    expect(screen.getByRole("navigation", { name: "Top" })).toBeInTheDocument();
    expect(screen.getByText("foot-slot")).toBeInTheDocument();
  });

  it("does not render a skip-link by default", () => {
    render(
      <PublicLayout>
        <span>body</span>
      </PublicLayout>,
    );
    expect(screen.queryByRole("link", { name: /skip/i })).toBeNull();
  });

  it("renders an opt-in skip-link pointing at the main id", () => {
    render(
      <PublicLayout withSkipLink mainId="custom-main" skipLabel="Skip">
        <span>body</span>
      </PublicLayout>,
    );
    const skip = screen.getByRole("link", { name: "Skip" });
    expect(skip).toHaveAttribute("href", "#custom-main");
    expect(screen.getByRole("main")).toHaveAttribute("id", "custom-main");
  });
});
