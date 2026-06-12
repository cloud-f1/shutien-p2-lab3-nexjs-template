import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { SocialButtons } from "../SocialButtons";

describe("SocialButtons", () => {
  it("renders Google button", () => {
    render(<SocialButtons />);

    expect(screen.getByRole("button", { name: /google/i })).toBeInTheDocument();
  });

  it("renders GitHub button", () => {
    render(<SocialButtons />);

    expect(screen.getByRole("button", { name: /github/i })).toBeInTheDocument();
  });

  it("renders both Google and GitHub buttons", () => {
    render(<SocialButtons />);

    const buttons = screen.getAllByRole("button");
    const googleBtn = buttons.find((b) => b.textContent?.includes("Google"));
    const githubBtn = buttons.find((b) => b.textContent?.includes("GitHub"));
    expect(googleBtn).toBeInTheDocument();
    expect(githubBtn).toBeInTheDocument();
  });

  it("renders custom label", () => {
    render(<SocialButtons label="sign in with" />);

    expect(screen.getByText("sign in with")).toBeInTheDocument();
  });

  it("handles Google button click", async () => {
    const user = userEvent.setup();
    render(<SocialButtons />);

    // Click Google — the MSW handler returns a URL, but jsdom won't navigate.
    // This exercises the handler code path without error.
    await user.click(screen.getByRole("button", { name: /google/i }));
  });

  it("handles GitHub button click", async () => {
    const user = userEvent.setup();
    render(<SocialButtons />);

    // Click GitHub — same as Google, exercises the handler code path.
    await user.click(screen.getByRole("button", { name: /github/i }));
  });
});
