import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import i18n from "../../i18n";
import { Pagination } from "../../components/ui/Pagination";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { MemoryRouter } from "react-router-dom";

/**
 * E172 — primitive bridge smoke test.
 *
 * Proves that primitives read from the `primitives` namespace and that
 * switching `i18n.language` re-renders translated chrome (aria-label,
 * navigation labels). If this test goes red, something dropped the
 * `useTranslation("primitives")` call in a primitive.
 */
describe("primitives namespace — locale switch", () => {
  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage("en");
  });

  it("Pagination uses English aria-labels by default", async () => {
    await i18n.changeLanguage("en");
    render(
      <Pagination page={1} pageSize={10} total={50} onPageChange={() => {}} />,
    );

    expect(
      screen.getByRole("navigation", { name: "Pagination" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Previous page" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Next page" }),
    ).toBeInTheDocument();
  });

  it("Pagination uses 繁中 aria-labels when language is zh-TW", async () => {
    await i18n.changeLanguage("zh-TW");
    render(
      <Pagination page={1} pageSize={10} total={50} onPageChange={() => {}} />,
    );

    expect(
      screen.getByRole("navigation", { name: "分頁導覽" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "上一頁" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "下一頁" }),
    ).toBeInTheDocument();
  });

  it("Breadcrumb nav label switches between locales", async () => {
    await i18n.changeLanguage("zh-TW");
    render(
      <MemoryRouter>
        <Breadcrumb items={[{ label: "首頁" }]} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("navigation", { name: "目前位置" }),
    ).toBeInTheDocument();
  });
});
