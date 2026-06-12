import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { createWrapper } from "../../tests/helpers/createWrapper";
import { useHealth } from "../useHealth";

describe("useHealth", () => {
  it("fetches health status", async () => {
    const { result } = renderHook(() => useHealth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.status).toBe("ok");
  });
});
