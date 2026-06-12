import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { FC, ReactNode } from "react";

/**
 * Creates a test wrapper with QueryClient + MemoryRouter.
 *
 * Usage:
 *   const { result } = renderHook(() => usePlaces(), { wrapper: createWrapper() });
 */
export function createWrapper(
  initialEntries?: string[],
): FC<{ children: ReactNode }> {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}
