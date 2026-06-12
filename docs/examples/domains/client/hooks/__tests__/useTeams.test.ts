import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  useTeamsList,
  useTeamDetail,
  useTeamCreate,
  useTeamUpdate,
  useTeamDelete,
  useTeamMembers,
  useTeamAddMember,
  useTeamUpdateMember,
  useTeamRemoveMember,
} from "../useTeams";
import { server } from "../../tests/setup";
import { teamHandlers, TEAM_FIXTURES, MEMBER_FIXTURES } from "../../tests/handlers/teams";
import { createWrapper } from "../../tests/helpers/createWrapper";

describe("useTeams hooks", () => {
  beforeEach(() => {
    server.use(...teamHandlers);
  });

  describe("useTeamsList", () => {
    it("returns list of teams with roles", async () => {
      const { result } = renderHook(() => useTeamsList(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(TEAM_FIXTURES.length);
      expect(result.current.data![0].name).toBe("Alpha Team");
      expect(result.current.data![0].my_role).toBe("owner");
    });
  });

  describe("useTeamDetail", () => {
    it("returns a single team by id", async () => {
      const teamId = TEAM_FIXTURES[0].id;
      const { result } = renderHook(() => useTeamDetail(teamId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.name).toBe("Alpha Team");
      expect(result.current.data!.slug).toBe("alpha-team");
    });

    it("does not fetch when id is empty", () => {
      const { result } = renderHook(() => useTeamDetail(""), {
        wrapper: createWrapper(),
      });
      expect(result.current.isFetching).toBe(false);
    });
  });

  describe("useTeamCreate", () => {
    it("creates a team and returns it", async () => {
      const { result } = renderHook(() => useTeamCreate(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ name: "New Team" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.name).toBe("New Team");
      expect(result.current.data!.slug).toBe("new-team");
    });
  });

  describe("useTeamMembers", () => {
    it("returns team members", async () => {
      const teamId = TEAM_FIXTURES[0].id;
      const { result } = renderHook(() => useTeamMembers(teamId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data![0].role).toBe("owner");
      expect(result.current.data![0].user.email).toBe("owner@test.com");
    });

    it("does not fetch when teamId is empty", () => {
      const { result } = renderHook(() => useTeamMembers(""), {
        wrapper: createWrapper(),
      });
      expect(result.current.isFetching).toBe(false);
    });
  });

  describe("useTeamUpdate", () => {
    it("updates a team", async () => {
      const { result } = renderHook(() => useTeamUpdate(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        id: TEAM_FIXTURES[0].id,
        data: { name: "Updated Name" },
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.name).toBe("Updated Name");
    });
  });

  describe("useTeamDelete", () => {
    it("deletes a team", async () => {
      const { result } = renderHook(() => useTeamDelete(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(TEAM_FIXTURES[0].id);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useTeamAddMember", () => {
    it("adds a member to a team", async () => {
      const { result } = renderHook(() => useTeamAddMember(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        teamId: TEAM_FIXTURES[0].id,
        data: {
          user_id: "55555555-5555-4555-8555-555555555555",
          role: "viewer",
        },
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.role).toBe("viewer");
    });
  });

  describe("useTeamUpdateMember", () => {
    it("updates a member role", async () => {
      const { result } = renderHook(() => useTeamUpdateMember(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        teamId: MEMBER_FIXTURES[1].team_id,
        userId: MEMBER_FIXTURES[1].user_id,
        data: { role: "admin" },
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.role).toBe("admin");
    });
  });

  describe("useTeamRemoveMember", () => {
    it("removes a member", async () => {
      const { result } = renderHook(() => useTeamRemoveMember(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        teamId: MEMBER_FIXTURES[0].team_id,
        userId: MEMBER_FIXTURES[0].user_id,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });
});
