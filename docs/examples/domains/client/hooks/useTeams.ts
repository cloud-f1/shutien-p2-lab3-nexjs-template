import { useServiceQuery, useServiceMutation } from "./useService";
import { CACHE_TIERS } from "../cacheConfig";
import { teamsService } from "../api/services/teams";
import type {
  TeamCreate,
  TeamUpdate,
  TeamMemberCreate,
  TeamMemberUpdate,
} from "../schemas/team";

// ── Team CRUD hooks ─────────────────────────────────────────────

export function useTeamsList() {
  return useServiceQuery(
    ["teams"],
    () => teamsService.list(),
    CACHE_TIERS.STANDARD,
  );
}

export function useTeamDetail(id: string) {
  return useServiceQuery(
    ["teams", id],
    () => teamsService.getById(id),
    CACHE_TIERS.STANDARD,
    { enabled: !!id },
  );
}

export function useTeamCreate() {
  return useServiceMutation(
    (data: TeamCreate) => teamsService.create(data),
    { invalidateKeys: [["teams"]] },
  );
}

export function useTeamUpdate() {
  return useServiceMutation(
    ({ id, data }: { id: string; data: TeamUpdate }) =>
      teamsService.update(id, data),
    { invalidateKeys: [["teams"]] },
  );
}

export function useTeamDelete() {
  return useServiceMutation((id: string) => teamsService.remove(id), {
    invalidateKeys: [["teams"]],
  });
}

// ── Member management hooks ─────────────────────────────────────

export function useTeamMembers(teamId: string) {
  return useServiceQuery(
    ["teams", teamId, "members"],
    () => teamsService.listMembers(teamId),
    CACHE_TIERS.STANDARD,
    { enabled: !!teamId },
  );
}

export function useTeamAddMember() {
  return useServiceMutation(
    ({ teamId, data }: { teamId: string; data: TeamMemberCreate }) =>
      teamsService.addMember(teamId, data),
    { invalidateKeys: [["teams"]] },
  );
}

export function useTeamUpdateMember() {
  return useServiceMutation(
    ({
      teamId,
      userId,
      data,
    }: {
      teamId: string;
      userId: string;
      data: TeamMemberUpdate;
    }) => teamsService.updateMember(teamId, userId, data),
    { invalidateKeys: [["teams"]] },
  );
}

export function useTeamRemoveMember() {
  return useServiceMutation(
    ({ teamId, userId }: { teamId: string; userId: string }) =>
      teamsService.removeMember(teamId, userId),
    { invalidateKeys: [["teams"]] },
  );
}
