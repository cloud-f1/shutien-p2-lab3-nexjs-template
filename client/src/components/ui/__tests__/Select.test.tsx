import { createRef, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { Select } from "../Select";
import { FormField } from "../FormField";

describe("Select", () => {
  it("renders options from the `options` prop", () => {
    render(
      <Select
        aria-label="theme"
        defaultValue="dark"
        options={[
          { value: "dark", label: "Dark" },
          { value: "rose", label: "Rose" },
        ]}
      />,
    );
    const select = screen.getByRole("combobox", { name: /theme/i });
    expect(select).toHaveValue("dark");
    expect(screen.getByRole("option", { name: "Rose" })).toBeInTheDocument();
  });

  it("accepts <option> children when no `options` array passed", () => {
    render(
      <Select aria-label="lang" defaultValue="en">
        <option value="en">English</option>
        <option value="zh">中文</option>
      </Select>,
    );
    expect(screen.getByRole("combobox", { name: /lang/i })).toHaveValue("en");
  });

  it("forwards refs and supports controlled change", async () => {
    function Harness() {
      const [v, setV] = useState("a");
      return (
        <Select
          aria-label="x"
          value={v}
          onChange={(e) => setV(e.target.value)}
          options={[
            { value: "a", label: "A" },
            { value: "b", label: "B" },
          ]}
        />
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    const select = screen.getByRole("combobox", { name: /x/i });
    await user.selectOptions(select, "b");
    expect(select).toHaveValue("b");
  });

  it("renders disabled and invalid states", () => {
    const ref = createRef<HTMLSelectElement>();
    render(
      <Select
        ref={ref}
        aria-label="x"
        disabled
        invalid
        defaultValue="a"
        options={[{ value: "a", label: "A" }]}
      />,
    );
    const select = screen.getByRole("combobox", { name: /x/i });
    expect(select).toBeDisabled();
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });

  it("composes inside <FormField>", () => {
    render(
      <FormField label="Theme" htmlFor="theme">
        <Select
          id="theme"
          defaultValue="a"
          options={[{ value: "a", label: "A" }]}
        />
      </FormField>,
    );
    expect(screen.getByLabelText("Theme")).toBeInTheDocument();
  });
});
