import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "../authStore";
import {
  setAccessToken,
  setRefreshToken,
  getAccessToken,
  getRefreshToken,
} from "../../api/client";
import { TEST_USER } from "../../tests/handlers/auth";

describe("authStore", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false, isRestoring: false });
    setAccessToken(null);
    setRefreshToken(null);
  });

  it("has correct initial state", () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("setUser sets user and isAuthenticated to true", () => {
    useAuthStore.getState().setUser(TEST_USER);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(TEST_USER);
    expect(state.isAuthenticated).toBe(true);
  });

  it("setUser with null sets isAuthenticated to false", () => {
    useAuthStore.getState().setUser(null);

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("logout clears user, tokens, and isAuthenticated", () => {
    setAccessToken("some-token");
    setRefreshToken("some-refresh");
    useAuthStore.getState().setUser(TEST_USER);

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});
