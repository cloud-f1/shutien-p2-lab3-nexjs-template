import { render, screen } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { NavBar } from "../NavBar";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

describe("NavBar", () => {
  it("renders the brand text + provided links", () => {
    render(
      <NavBar
        brandText="MY APP"
        links={[
          { label: "Features", href: "#features" },
          { label: "Sign In", href: "/signin" },
        ]}
      />,
    );
    expect(screen.getByText("MY APP")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Features" })).toHaveAttribute(
      "href",
      "#features",
    );
    expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute(
      "href",
      "/signin",
    );
  });

  it("uses the cta class for cta links", () => {
    render(
      <NavBar
        brandText="X"
        links={[
          { label: "Plain", href: "/plain" },
          { label: "Get Template", href: "/signup", cta: true },
        ]}
      />,
    );
    const cta = screen.getByRole("link", { name: "Get Template" });
    expect(cta.className).toContain("bg-primary");
  });

  it("supports a custom render function for links", () => {
    render(
      <NavBar
        brandText="X"
        links={[
          {
            label: "Custom",
            href: "/custom",
            render: (cls) => (
              <button className={cls} data-testid="custom-link">
                Custom
              </button>
            ),
          },
        ]}
      />,
    );
    expect(screen.getByTestId("custom-link")).toBeInTheDocument();
  });

  it("uses the supplied aria-label", () => {
    render(<NavBar ariaLabel="Marketing nav" brandText="X" />);
    expect(
      screen.getByRole("navigation", { name: "Marketing nav" }),
    ).toBeInTheDocument();
  });
});
