import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SearchInput } from "../SearchInput";

describe("SearchInput", () => {
  it("renders with the provided value", () => {
    render(<SearchInput value="alpha" onChange={() => {}} />);
    expect(screen.getByRole("searchbox", { name: /search/i })).toHaveValue(
      "alpha",
    );
  });

  it("calls onChange with the new value when typed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} />);
    const input = screen.getByRole("searchbox", { name: /search/i });
    await user.type(input, "x");
    expect(onChange).toHaveBeenLastCalledWith("x");
  });

  it("uses the custom placeholder as accessible name", () => {
    render(
      <SearchInput
        value=""
        onChange={() => {}}
        placeholder="Search projects"
      />,
    );
    expect(
      screen.getByRole("searchbox", { name: /search projects/i }),
    ).toBeInTheDocument();
  });
});
