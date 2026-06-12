import { describe, it, expect, beforeEach } from "vitest";
import { server } from "../../../tests/setup";
import { teamHandlers, TEAM_FIXTURES, MEMBER_FIXTURES } from "../../../tests/handlers/teams";
import { teamsService } from "../teams";

describe("teamsService", () => {
  beforeEach(() => {
    server.use(...teamHandlers);
  });

  it("list() returns teams with roles", async () => {
    const result = await teamsService.list();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Alpha Team");
    expect(result[0].my_role).toBe("owner");
    expect(result[1].name).toBe("Beta Team");
    expect(result[1].my_role).toBe("editor");
  });

  it("create() sends data and returns parsed team", async () => {
    const newTeam = await teamsService.create({ name: "New Team" });
    expect(newTeam.name).toBe("New Team");
    expect(newTeam.id).toBeDefined();
    expect(newTeam.slug).toBe("new-team");
    expect(newTeam.member_count).toBe(1);
  });

  it("create() with custom slug", async () => {
    const newTeam = await teamsService.create({
      name: "My Team",
      slug: "custom-slug",
    });
    expect(newTeam.slug).toBe("custom-slug");
  });

  it("getById() returns a single team", async () => {
    const team = await teamsService.getById(TEAM_FIXTURES[0].id);
    expect(team.name).toBe("Alpha Team");
    expect(team.slug).toBe("alpha-team");
  });

  it("update() sends patch and returns updated team", async () => {
    const updated = await teamsService.update(TEAM_FIXTURES[0].id, {
      name: "Updated Team",
    });
    expect(updated.name).toBe("Updated Team");
    expect(updated.slug).toBe("alpha-team");
  });

  it("remove() calls DELETE without error", async () => {
    await expect(
      teamsService.remove(TEAM_FIXTURES[0].id),
    ).resolves.toBeUndefined();
  });

  it("listMembers() returns team members", async () => {
    const members = await teamsService.listMembers(TEAM_FIXTURES[0].id);
    expect(members).toHaveLength(2);
    expect(members[0].role).toBe("owner");
    expect(members[0].user.email).toBe("owner@test.com");
    expect(members[1].role).toBe("editor");
  });

  it("addMember() sends data and returns parsed member", async () => {
    const member = await teamsService.addMember(TEAM_FIXTURES[0].id, {
      user_id: "55555555-5555-4555-8555-555555555555",
      role: "viewer",
    });
    expect(member.user_id).toBe("55555555-5555-4555-8555-555555555555");
    expect(member.role).toBe("viewer");
    expect(member.user.email).toBe("new@test.com");
  });

  it("updateMember() changes role", async () => {
    const updated = await teamsService.updateMember(
      MEMBER_FIXTURES[1].team_id,
      MEMBER_FIXTURES[1].user_id,
      { role: "admin" },
    );
    expect(updated.role).toBe("admin");
    expect(updated.user_id).toBe(MEMBER_FIXTURES[1].user_id);
  });

  it("removeMember() calls DELETE without error", async () => {
    await expect(
      teamsService.removeMember(
        MEMBER_FIXTURES[0].team_id,
        MEMBER_FIXTURES[0].user_id,
      ),
    ).resolves.toBeUndefined();
  });
});
