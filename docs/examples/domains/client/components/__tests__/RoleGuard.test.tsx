import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoleGuard } from "../RoleGuard";
import { server } from "../../tests/setup";
import { teamHandlers } from "../../tests/handlers/teams";
import { createWrapper } from "../../tests/helpers/createWrapper";

describe("RoleGuard", () => {
  beforeEach(() => {
    server.use(...teamHandlers);
  });

  it("renders children when user has the required role", async () => {
    // Default fixtures give the user "owner" role on alpha team
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <RoleGuard role="admin">
          <span data-testid="protected">Admin Content</span>
        </RoleGuard>
      </Wrapper>,
    );
    expect(
      await screen.findByTestId("protected"),
    ).toBeInTheDocument();
  });

  it("renders children when user role equals required role", async () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <RoleGuard role="owner">
          <span data-testid="owner-content">Owner Only</span>
        </RoleGuard>
      </Wrapper>,
    );
    expect(
      await screen.findByTestId("owner-content"),
    ).toBeInTheDocument();
  });

  it("does not render children when user lacks the required role", async () => {
    // Override to return a team where user is only a viewer
    const { http, HttpResponse } = await import("msw");
    server.use(
      http.get("http://localhost:8080/teams", () =>
        HttpResponse.json([
          {
            id: "test-team-id",
            name: "Test Team",
            slug: "test-team",
            member_count: 1,
            my_role: "viewer",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ]),
      ),
    );

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <RoleGuard role="admin">
          <span data-testid="hidden">Should Not Show</span>
        </RoleGuard>
      </Wrapper>,
    );

    // Wait for query to resolve, then check content is absent
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("hidden")).not.toBeInTheDocument();
  });

  it("renders fallback when user lacks required role", async () => {
    const { http, HttpResponse } = await import("msw");
    server.use(
      http.get("http://localhost:8080/teams", () =>
        HttpResponse.json([
          {
            id: "test-team-id",
            name: "Test Team",
            slug: "test-team",
            member_count: 1,
            my_role: "viewer",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ]),
      ),
    );

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <RoleGuard
          role="admin"
          fallback={<span data-testid="fallback">No Access</span>}
        >
          <span data-testid="protected">Admin Only</span>
        </RoleGuard>
      </Wrapper>,
    );

    expect(await screen.findByTestId("fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
  });

  it("renders nothing when no teams exist", async () => {
    const { http, HttpResponse } = await import("msw");
    server.use(
      http.get("http://localhost:8080/teams", () =>
        HttpResponse.json([]),
      ),
    );

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <RoleGuard role="viewer">
          <span data-testid="content">Content</span>
        </RoleGuard>
      </Wrapper>,
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });
});
