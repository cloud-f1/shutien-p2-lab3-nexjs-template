import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeAll } from "vitest";
import LandingPage from "../LandingPage";

// jsdom doesn't implement IntersectionObserver
beforeAll(() => {
  globalThis.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.IntersectionObserver;
});

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe("LandingPage", () => {
  it("renders hero section with title and CTA", () => {
    renderLanding();

    expect(screen.getByText(/zero context loss/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /get the template/i }).length,
    ).toBeGreaterThan(0);
  });

  it("renders navigation links", () => {
    renderLanding();

    expect(screen.getAllByText("Agents").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/self-learning/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Features").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Structure").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all main sections", () => {
    renderLanding();

    expect(screen.getByText("The Problem")).toBeInTheDocument();
    expect(screen.getByText("The System")).toBeInTheDocument();
    expect(screen.getByText("The Breakthrough")).toBeInTheDocument();
    expect(screen.getByText("What You Get")).toBeInTheDocument();
    expect(screen.getByText("What's Included")).toBeInTheDocument();
  });

  it("renders footer with privacy and terms links", () => {
    renderLanding();

    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "/terms",
    );
  });
});
