import { authApi } from "../api/auth";
import { useAuthStore } from "../store/authStore";
import { useServiceMutation } from "./useService";
import type { UpdateUserRequest } from "../schemas/auth";

/** Mutation hook for PATCH /users/me — updates user and syncs Zustand store. */
export function useUpdateProfile() {
  const setUser = useAuthStore((s) => s.setUser);

  return useServiceMutation(
    (data: UpdateUserRequest) => authApi.updateCurrentUser(data),
    {
      invalidateKeys: [["currentUser"]],
      onSuccess: (user) => {
        setUser(user);
      },
    },
  );
}
