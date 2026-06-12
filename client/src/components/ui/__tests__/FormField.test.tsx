import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FormField } from "../FormField";

describe("FormField", () => {
  it("associates the label with its input via htmlFor/id", () => {
    render(
      <FormField label="Email" htmlFor="email">
        <input id="email" />
      </FormField>,
    );

    const input = screen.getByLabelText("Email");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  it("renders a hint when no error is set", () => {
    render(
      <FormField
        label="Username"
        htmlFor="username"
        hint="Letters and numbers only."
      >
        <input id="username" />
      </FormField>,
    );

    expect(screen.getByText("Letters and numbers only.")).toBeInTheDocument();
  });

  it("prefers showing the error over the hint", () => {
    render(
      <FormField
        label="Username"
        htmlFor="username"
        hint="Letters and numbers only."
        error="Username is required"
      >
        <input id="username" />
      </FormField>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Username is required");
    expect(
      screen.queryByText("Letters and numbers only."),
    ).not.toBeInTheDocument();
  });

  it("marks the label with an asterisk when required", () => {
    render(
      <FormField label="Email" htmlFor="email" required>
        <input id="email" />
      </FormField>,
    );

    const label = screen.getByText("Email");
    expect(label.textContent).toContain("*");
  });
});
