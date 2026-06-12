import { render, screen } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { Footer } from "../Footer";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

describe("Footer", () => {
  it("renders brand text + handle + links", () => {
    render(
      <Footer
        brand="Built by"
        brandHandle="@alex"
        links={[
          { label: "GitHub", href: "https://github.com" },
          { label: "Privacy", href: "/privacy" },
        ]}
      />,
    );

    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent("Built by");
    expect(footer).toHaveTextContent("@alex");
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com",
    );
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it("supports a custom link render override", () => {
    render(
      <Footer
        brand="X"
        links={[
          {
            label: "RouterLink",
            href: "/x",
            render: (cls) => (
              <button className={cls} data-testid="footer-custom">
                RouterLink
              </button>
            ),
          },
        ]}
      />,
    );
    expect(screen.getByTestId("footer-custom")).toBeInTheDocument();
  });

  it("renders without brand or links gracefully", () => {
    render(<Footer />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});
