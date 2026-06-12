import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import ErrorBoundary from "../ErrorBoundary";

// A component that throws on demand
function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test render error");
  }
  return <div>Child content</div>;
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("ErrorBoundary", () => {
  // Suppress React error boundary console.error noise in tests
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalError;
  });

  it("renders children normally when no error", () => {
    renderWithRouter(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Child content")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("catches errors and shows fallback UI", () => {
    renderWithRouter(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();
    expect(screen.getByText("Go home")).toBeInTheDocument();
    expect(screen.queryByText("Child content")).not.toBeInTheDocument();
  });

  it("resets error state when 'Try again' is clicked", async () => {
    const user = userEvent.setup();

    // Use a ref-like object so the closure picks up the updated value
    const state = { shouldThrow: true };
    function DynamicChild() {
      if (state.shouldThrow) {
        throw new Error("Test render error");
      }
      return <div>Child content</div>;
    }

    renderWithRouter(
      <ErrorBoundary>
        <DynamicChild />
      </ErrorBoundary>,
    );

    // Should show fallback
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Flip the flag so re-render succeeds
    state.shouldThrow = false;

    await user.click(screen.getByText("Try again"));

    // Should show children again
    expect(screen.getByText("Child content")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });
});
