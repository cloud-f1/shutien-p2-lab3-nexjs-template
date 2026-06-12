import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { useRef } from "react";
import { useFocusTrap } from "../useFocusTrap";

function FocusTrapTestComponent({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, isOpen, onClose);

  return (
    <div ref={ref} data-testid="trap-container">
      <button data-testid="first">First</button>
      <button data-testid="second">Second</button>
      <button data-testid="last">Last</button>
    </div>
  );
}

function EmptyFocusTrapTestComponent({ isOpen }: { isOpen: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, isOpen);

  return (
    <div ref={ref} data-testid="empty-trap">
      <span>No focusable elements</span>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("focuses the first element when opened", async () => {
    render(<FocusTrapTestComponent isOpen={true} />);

    // Focus should move to first button after the timeout
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId("first"));
    });
  });

  it("does not trap focus when closed", () => {
    render(<FocusTrapTestComponent isOpen={false} />);

    // No focus should be changed
    expect(document.activeElement).toBe(document.body);
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<FocusTrapTestComponent isOpen={true} onClose={onClose} />);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("wraps focus from last to first on Tab", async () => {
    const user = userEvent.setup();
    render(<FocusTrapTestComponent isOpen={true} />);

    // Wait for focus to be on first element
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId("first"));
    });

    // Tab to second
    await user.tab();
    expect(document.activeElement).toBe(screen.getByTestId("second"));

    // Tab to last
    await user.tab();
    expect(document.activeElement).toBe(screen.getByTestId("last"));

    // Tab should wrap to first
    await user.tab();
    expect(document.activeElement).toBe(screen.getByTestId("first"));
  });

  it("wraps focus from first to last on Shift+Tab", async () => {
    const user = userEvent.setup();
    render(<FocusTrapTestComponent isOpen={true} />);

    // Wait for focus to be on first element
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId("first"));
    });

    // Shift+Tab should wrap to last
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(screen.getByTestId("last"));
  });

  it("handles container with no focusable elements", async () => {
    render(<EmptyFocusTrapTestComponent isOpen={true} />);

    // Should not throw; focus stays on body
    await vi.waitFor(() => {
      expect(screen.getByTestId("empty-trap")).toBeInTheDocument();
    });
  });
});
