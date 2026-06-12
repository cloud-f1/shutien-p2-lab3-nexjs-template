import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import PrivacyPage from "../PrivacyPage";
import TermsPage from "../TermsPage";

function renderPage(ui: React.ReactElement, path: string) {
  return render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);
}

describe("PrivacyPage", () => {
  it("renders title and all 9 sections", () => {
    renderPage(<PrivacyPage />, "/privacy");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Privacy Policy",
    );
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(9);
  });

  it("sets document title for SEO", () => {
    renderPage(<PrivacyPage />, "/privacy");

    expect(document.title).toContain("Privacy Policy");
  });

  it("renders navigation with logo and back link", () => {
    renderPage(<PrivacyPage />, "/privacy");

    expect(screen.getByAltText("Claude Agent Template")).toBeInTheDocument();
    expect(screen.getByText(/back to home/i)).toBeInTheDocument();
  });

  it("renders footer with cross-links", () => {
    renderPage(<PrivacyPage />, "/privacy");

    expect(
      screen.getByRole("link", { name: /terms of service/i }),
    ).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: /^home$/i })).toHaveAttribute(
      "href",
      "/",
    );
  });
});

describe("TermsPage", () => {
  it("renders title and all 9 sections", () => {
    renderPage(<TermsPage />, "/terms");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Terms of Service",
    );
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(9);
  });

  it("sets document title for SEO", () => {
    renderPage(<TermsPage />, "/terms");

    expect(document.title).toContain("Terms of Service");
  });

  it("renders footer with cross-links", () => {
    renderPage(<TermsPage />, "/terms");

    expect(
      screen.getByRole("link", { name: /privacy policy/i }),
    ).toHaveAttribute("href", "/privacy");
  });
});
