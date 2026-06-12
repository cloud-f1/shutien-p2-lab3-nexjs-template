import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FilterSelect } from "../FilterSelect";

const OPTIONS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

describe("FilterSelect", () => {
  it("renders the label and options", () => {
    render(
      <FilterSelect
        label="Status"
        value=""
        onChange={() => {}}
        options={OPTIONS}
      />,
    );
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Active" })).toBeInTheDocument();
  });

  it("reflects the current value on the select", () => {
    render(
      <FilterSelect
        label="Status"
        value="active"
        onChange={() => {}}
        options={OPTIONS}
      />,
    );
    expect(screen.getByLabelText(/status/i)).toHaveValue("active");
  });

  it("calls onChange when the user picks an option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterSelect
        label="Status"
        value=""
        onChange={onChange}
        options={OPTIONS}
      />,
    );
    await user.selectOptions(screen.getByLabelText(/status/i), "archived");
    expect(onChange).toHaveBeenCalledWith("archived");
  });
});
