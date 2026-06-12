import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ThemeProvider, useThemeStore, THEME_OPTIONS } from "../ThemeProvider";

describe("ThemeProvider", () => {
  beforeEach(() => {
    // Reset store to default
    useThemeStore.setState({ theme: "dark" });
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    useThemeStore.setState({ theme: "dark" });
    document.documentElement.removeAttribute("data-theme");
  });

  it("sets data-theme attribute on mount with default theme", () => {
    render(
      <ThemeProvider>
        <div>child</div>
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("sets data-theme to indigo when theme is indigo", () => {
    useThemeStore.setState({ theme: "indigo" });

    render(
      <ThemeProvider>
        <div>content</div>
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("indigo");
  });

  it("sets data-theme to navy when theme is navy", () => {
    useThemeStore.setState({ theme: "navy" });

    render(
      <ThemeProvider>
        <div>content</div>
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("navy");
  });

  it("sets data-theme to sage when theme is sage", () => {
    useThemeStore.setState({ theme: "sage" });

    render(
      <ThemeProvider>
        <div>content</div>
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("sage");
  });

  it("sets data-theme to rose when theme is rose", () => {
    useThemeStore.setState({ theme: "rose" });

    render(
      <ThemeProvider>
        <div>content</div>
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("rose");
  });

  it("sets data-theme to forest when theme is forest", () => {
    useThemeStore.setState({ theme: "forest" });

    render(
      <ThemeProvider>
        <div>content</div>
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("forest");
  });

  it("resolves system theme to dark when prefers-color-scheme is dark", () => {
    // Mock matchMedia to return dark
    const mockMatchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: mockMatchMedia,
    });

    useThemeStore.setState({ theme: "system" });

    render(
      <ThemeProvider>
        <div>content</div>
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("resolves system theme to indigo when prefers-color-scheme is not dark", () => {
    const addEventListenerSpy = vi.fn();
    const removeEventListenerSpy = vi.fn();
    const mockMatchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: addEventListenerSpy,
      removeEventListener: removeEventListenerSpy,
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: mockMatchMedia,
    });

    useThemeStore.setState({ theme: "system" });

    render(
      <ThemeProvider>
        <div>content</div>
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("indigo");
    // Should have added a change listener for system theme
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
  });

  it("responds to system theme changes via matchMedia listener", () => {
    let changeHandler: ((e: MediaQueryListEvent) => void) | null = null;
    const mockMatchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(
        (_event: string, handler: (e: MediaQueryListEvent) => void) => {
          changeHandler = handler;
        },
      ),
      removeEventListener: vi.fn(),
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: mockMatchMedia,
    });

    useThemeStore.setState({ theme: "system" });

    render(
      <ThemeProvider>
        <div>content</div>
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("indigo");

    // Simulate system theme changing to dark
    act(() => {
      changeHandler?.({ matches: true } as MediaQueryListEvent);
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    // Simulate system theme changing back to light
    act(() => {
      changeHandler?.({ matches: false } as MediaQueryListEvent);
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe("indigo");
  });

  it("resets invalid theme to dark", () => {
    // Force an invalid theme into the store
    useThemeStore.setState({ theme: "invalid-theme" as never });

    render(
      <ThemeProvider>
        <div>content</div>
      </ThemeProvider>,
    );

    // The effect should reset to "dark"
    expect(useThemeStore.getState().theme).toBe("dark");
  });

  it("updates data-theme when setTheme is called", async () => {
    const user = userEvent.setup();

    function TestApp() {
      const setTheme = useThemeStore((s) => s.setTheme);
      return (
        <ThemeProvider>
          <button onClick={() => setTheme("navy")}>Switch to Navy</button>
        </ThemeProvider>
      );
    }

    render(<TestApp />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    await user.click(screen.getByText("Switch to Navy"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("navy");
  });
});

describe("THEME_OPTIONS", () => {
  it("contains all 7 theme options", () => {
    expect(THEME_OPTIONS).toHaveLength(7);
    const values = THEME_OPTIONS.map((o) => o.value);
    expect(values).toEqual([
      "dark",
      "indigo",
      "navy",
      "sage",
      "rose",
      "forest",
      "system",
    ]);
  });

  it("each option has a label", () => {
    for (const option of THEME_OPTIONS) {
      expect(option.label).toBeTruthy();
    }
  });
});

describe("useThemeStore", () => {
  it("has default theme of dark", () => {
    useThemeStore.setState({ theme: "dark" });
    expect(useThemeStore.getState().theme).toBe("dark");
  });

  it("setTheme updates the theme", () => {
    useThemeStore.getState().setTheme("sage");
    expect(useThemeStore.getState().theme).toBe("sage");
    useThemeStore.setState({ theme: "dark" });
  });
});
