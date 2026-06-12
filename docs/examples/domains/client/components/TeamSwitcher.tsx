import { useCurrentTeam } from "../hooks/useCurrentTeam";

/**
 * Team switcher dropdown for the dashboard sidebar.
 * Shows the active team and allows switching between teams.
 */
export function TeamSwitcher() {
  const { currentTeam, teams, isLoading, setActiveTeam } = useCurrentTeam();

  if (isLoading) {
    return (
      <div className="team-switcher" aria-busy="true">
        Loading teams...
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="team-switcher" data-testid="team-switcher-empty">
        No teams
      </div>
    );
  }

  return (
    <div className="team-switcher" data-testid="team-switcher">
      <label htmlFor="team-select" className="sr-only">
        Active team
      </label>
      <select
        id="team-select"
        value={currentTeam?.id ?? ""}
        onChange={(e) => setActiveTeam(e.target.value)}
        aria-label="Select active team"
      >
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name} ({team.my_role})
          </option>
        ))}
      </select>
    </div>
  );
}
