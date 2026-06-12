import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToastProvider, useToast } from "../Toast";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());

function ToastTrigger({
  message,
  variant,
  durationMs,
}: {
  message: string;
  variant?: "info" | "success" | "error" | "warning";
  durationMs?: number | null;
}) {
  const { toast } = useToast();
  return (
    <button
      type="button"
      onClick={() => toast({ message, variant, durationMs })}
    >
      push
    </button>
  );
}

describe("Toast", () => {
  it("useToast throws when called outside <ToastProvider>", () => {
    // Silence React's error-boundary console noise for this assertion.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Bad() {
      useToast();
      return null;
    }
    expect(() => render(<Bad />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });

  it("renders a pushed toast with the given message", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Hello world" variant="success" />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "push" }));
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("uses role=status for non-error toasts", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Saved" variant="success" />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "push" }));
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("uses role=alert for error toasts", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Network error" variant="error" />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "push" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Network error");
  });

  it("dismiss button removes the toast immediately", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Bye" durationMs={null} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "push" }));
    expect(screen.getByText("Bye")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText("Bye")).not.toBeInTheDocument();
  });
});

describe("Toast — auto-dismiss timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-dismisses after durationMs", () => {
    function Trigger() {
      const { toast } = useToast();
      return (
        <button
          type="button"
          onClick={() => toast({ message: "Vanishing", durationMs: 1000 })}
        >
          push
        </button>
      );
    }
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    act(() => {
      screen.getByRole("button", { name: "push" }).click();
    });
    expect(screen.getByText("Vanishing")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.queryByText("Vanishing")).not.toBeInTheDocument();
  });

  it("does not auto-dismiss when durationMs is null", () => {
    function Trigger() {
      const { toast } = useToast();
      return (
        <button
          type="button"
          onClick={() => toast({ message: "Sticky", durationMs: null })}
        >
          push
        </button>
      );
    }
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    act(() => {
      screen.getByRole("button", { name: "push" }).click();
    });
    expect(screen.getByText("Sticky")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText("Sticky")).toBeInTheDocument();
  });
});
