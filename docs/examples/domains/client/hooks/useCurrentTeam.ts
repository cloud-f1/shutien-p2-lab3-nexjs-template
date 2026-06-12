import { useCallback, useMemo } from "react";
import { useTeamsList } from "./useTeams";
import type { TeamReadWithRole, TeamRole } from "../schemas/team";

const TEAM_STORAGE_KEY = "active-team-id";

/** Role hierarchy for comparison (higher = more privilege). */
const ROLE_LEVEL: Record<TeamRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

export function hasMinRole(userRole: TeamRole, minRole: TeamRole): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minRole];
}

/**
 * Returns the currently active team and the user's role in it.
 * Persists selection in sessionStorage. Falls back to the first team.
 */
export function useCurrentTeam() {
  const { data: teams, isLoading, error } = useTeamsList();

  const activeTeamId =
    typeof window !== "undefined"
      ? sessionStorage.getItem(TEAM_STORAGE_KEY)
      : null;

  const currentTeam: TeamReadWithRole | undefined = useMemo(() => {
    if (!teams || teams.length === 0) return undefined;
    if (activeTeamId) {
      const found = teams.find((t) => t.id === activeTeamId);
      if (found) return found;
    }
    return teams[0];
  }, [teams, activeTeamId]);

  const setActiveTeam = useCallback((teamId: string) => {
    sessionStorage.setItem(TEAM_STORAGE_KEY, teamId);
    // Force re-render by dispatching storage event (same-tab)
    window.dispatchEvent(new Event("storage"));
  }, []);

  return {
    currentTeam,
    teams: teams ?? [],
    myRole: currentTeam?.my_role ?? null,
    isLoading,
    error,
    setActiveTeam,
  };
}
