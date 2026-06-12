import { create } from "zustand";
import {
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "../api/client";
import { authApi } from "../api/auth";
import type { User } from "../schemas/auth";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isRestoring: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isRestoring: true,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  logout: () => {
    setAccessToken(null);
    setRefreshToken(null);
    set({ user: null, isAuthenticated: false });
  },
  restoreSession: async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      set({ isRestoring: false });
      return;
    }
    try {
      await authApi.refresh({ refresh_token: refreshToken });
      const user = await authApi.getCurrentUser();
      set({ user, isAuthenticated: true, isRestoring: false });
    } catch {
      setAccessToken(null);
      setRefreshToken(null);
      set({ isRestoring: false });
    }
  },
}));
