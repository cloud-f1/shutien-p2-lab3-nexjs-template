import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Pagination } from "../Pagination";

describe("Pagination", () => {
  it("renders nothing when total fits in one page", () => {
    const { container } = render(
      <Pagination page={1} pageSize={10} total={5} onPageChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when pageSize is 0", () => {
    const { container } = render(
      <Pagination page={1} pageSize={0} total={50} onPageChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("marks the active page with aria-current=page", () => {
    render(
      <Pagination page={2} pageSize={10} total={50} onPageChange={() => {}} />,
    );
    const active = screen.getByRole("button", { name: "Page 2" });
    expect(active).toHaveAttribute("aria-current", "page");
  });

  it("calls onPageChange with the next page when Next is clicked", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <Pagination
        page={1}
        pageSize={10}
        total={50}
        onPageChange={onPageChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: /next page/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("disables Previous on the first page", () => {
    render(
      <Pagination page={1} pageSize={10} total={50} onPageChange={() => {}} />,
    );
    expect(
      screen.getByRole("button", { name: /previous page/i }),
    ).toBeDisabled();
  });

  it("disables Next on the last page", () => {
    render(
      <Pagination page={5} pageSize={10} total={50} onPageChange={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /next page/i })).toBeDisabled();
  });

  it("shows the current page range in the summary", () => {
    render(
      <Pagination page={2} pageSize={10} total={25} onPageChange={() => {}} />,
    );
    // 2nd page of 25 items @ 10/page → 11–20 of 25
    expect(screen.getByText(/11.*20.*of.*25/)).toBeInTheDocument();
  });
});
