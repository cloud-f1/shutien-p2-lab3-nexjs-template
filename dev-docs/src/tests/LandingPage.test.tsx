import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import LandingPage from "../pages/LandingPage";

describe("LandingPage", () => {
  let container: HTMLElement;

  beforeEach(() => {
    const result = render(<LandingPage />);
    container = result.container;
  });

  it("renders the hero headline", () => {
    expect(screen.getByText("Self-Learning.")).toBeInTheDocument();
    expect(screen.getByText(/Zero Context Loss/)).toBeInTheDocument();
  });

  it("renders all 7 sections with correct ids", () => {
    const ids = [
      "hero",
      "problem",
      "pipeline",
      "learning",
      "features",
      "structure",
      "cta",
    ];
    for (const id of ids) {
      expect(container.querySelector(`#${id}`)).toBeInTheDocument();
    }
  });

  it("renders navigation with anchor links to sections", () => {
    const navLabels = ["Agents", "Self-Learning", "Features", "Structure"];
    for (const label of navLabels) {
      const el = screen.getByRole("link", { name: label });
      expect(el).toHaveAttribute("href", "#/landing");
    }
  });

  it("renders all 6 agents in the pipeline", () => {
    expect(screen.getByText("@spec-writer")).toBeInTheDocument();
    expect(screen.getByText("@memory-curator")).toBeInTheDocument();
    expect(screen.getByText("@deployer")).toBeInTheDocument();
  });

  it("renders the CTA with GitHub link", () => {
    const ctaLinks = screen.getAllByRole("link", { name: /Get the Template/ });
    expect(ctaLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders footer with brand line", () => {
    expect(screen.getByText(/Built by @alexhsieh/)).toBeInTheDocument();
  });

  it("renders the 4 problem cards", () => {
    expect(
      screen.getByText("Re-explaining the same context"),
    ).toBeInTheDocument();
    expect(screen.getByText("Agents work in silos")).toBeInTheDocument();
    expect(screen.getByText("Templates stay static")).toBeInTheDocument();
    expect(screen.getByText("No enforcement layer")).toBeInTheDocument();
  });

  it("renders the memory tiers", () => {
    expect(screen.getAllByText(/Tier 0/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Tier 1/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the 6 feature cards", () => {
    expect(screen.getByText("Zero-loss session handoff")).toBeInTheDocument();
    expect(screen.getByText("6-gate deploy pipeline")).toBeInTheDocument();
  });

  it("renders accessible progress bar", () => {
    expect(
      screen.getByRole("progressbar", { name: /reading progress/i }),
    ).toBeInTheDocument();
  });

  it("renders accessible theme toggle", () => {
    expect(
      screen.getByRole("button", { name: /switch to .* mode/i }),
    ).toBeInTheDocument();
  });
});
