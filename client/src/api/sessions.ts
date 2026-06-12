import { apiClient } from "./client";
import { createService } from "./services/createService";
import { userSessionReadSchema } from "../schemas/auth";
import type { UserSessionRead } from "../schemas/auth";

/**
 * Sessions service (E161).
 *
 * Wraps the new `/auth/sessions` endpoints exposed by the unified backend.
 * The legacy `/users/me/sessions` surface is left in `authApi` for back-compat
 * with the old SessionInfo (device_info / is_current) shape; new dashboard
 * surfaces speak `UserSessionRead` against the family-tracked sessions store.
 */

const sessionsService = createService<UserSessionRead>(
  "/auth/sessions",
  userSessionReadSchema,
);

export const sessionsApi = {
  /** GET /auth/sessions — list active (non-revoked) sessions for current user. */
  list: (): Promise<UserSessionRead[]> => sessionsService.listAll(),

  /** DELETE /auth/sessions/{session_id} — revoke a single session. */
  revoke: (sessionId: string): Promise<void> => sessionsService.remove(sessionId),

  /** POST /auth/logout-all — revoke every session for the current user. */
  logoutAll: async (): Promise<void> => {
    await apiClient.post("/auth/logout-all");
  },
};
