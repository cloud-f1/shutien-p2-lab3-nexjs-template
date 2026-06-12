import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { createWrapper } from "../../tests/helpers/createWrapper";
import { useUpdateProfile } from "../useUserProfile";
import { useAuthStore } from "../../store/authStore";
import { setAccessToken } from "../../api/client";

describe("useUpdateProfile", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    setAccessToken("test-token");
  });

  it("updates profile and syncs Zustand store", async () => {
    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ display_name: "New Name" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.display_name).toBe("New Name");

    const state = useAuthStore.getState();
    expect(state.user?.display_name).toBe("New Name");
    expect(state.isAuthenticated).toBe(true);
  });
});
