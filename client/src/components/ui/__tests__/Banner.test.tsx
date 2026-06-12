import { render, screen } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { Banner } from "../Banner";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

describe("Banner", () => {
  it("renders children inside an alert", () => {
    render(<Banner variant="success">All good</Banner>);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("All good");
  });

  it("renders the legacy `message` prop when children are absent", () => {
    render(<Banner variant="error" message="Bad creds" />);
    expect(screen.getByText("Bad creds")).toBeInTheDocument();
  });

  it("does not render when visible=false (legacy prop)", () => {
    const { container } = render(
      <Banner variant="error" message="x" visible={false} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("applies the success variant classes", () => {
    render(<Banner variant="success">ok</Banner>);
    expect(screen.getByRole("alert").className).toContain("bg-success-light");
  });

  it("applies the error variant classes", () => {
    render(<Banner variant="error">no</Banner>);
    expect(screen.getByRole("alert").className).toContain("bg-danger-light");
  });

  it("applies the info variant classes", () => {
    render(<Banner variant="info">ℹ</Banner>);
    expect(screen.getByRole("alert").className).toContain("bg-primary-bg");
  });

  it("applies the warning variant classes", () => {
    render(<Banner variant="warning">!</Banner>);
    expect(screen.getByRole("alert").className).toContain("bg-warning-light");
  });

  it("preserves the legacy `success`/`error` class on the shell", () => {
    render(<Banner variant="success">ok</Banner>);
    expect(screen.getByRole("alert")).toHaveClass("success");
  });
});
