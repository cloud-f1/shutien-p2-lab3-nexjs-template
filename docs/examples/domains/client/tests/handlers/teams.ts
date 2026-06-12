import { http, HttpResponse } from "msw";

const BASE = "http://localhost:8080";

const TEAM_FIXTURES = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Alpha Team",
    slug: "alpha-team",
    member_count: 3,
    my_role: "owner" as const,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Beta Team",
    slug: "beta-team",
    member_count: 2,
    my_role: "editor" as const,
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
];

const MEMBER_FIXTURES = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    team_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    user_id: "11111111-1111-4111-8111-111111111111",
    role: "owner" as const,
    user: {
      id: "11111111-1111-4111-8111-111111111111",
      email: "owner@test.com",
      display_name: "Owner",
      avatar_url: null,
    },
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    team_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    user_id: "22222222-2222-4222-8222-222222222222",
    role: "editor" as const,
    user: {
      id: "22222222-2222-4222-8222-222222222222",
      email: "editor@test.com",
      display_name: "Editor",
      avatar_url: null,
    },
    created_at: "2026-01-02T00:00:00Z",
  },
];

export const teamHandlers = [
  // GET /teams — list teams with role
  http.get(`${BASE}/teams`, () => {
    return HttpResponse.json(TEAM_FIXTURES);
  }),

  // POST /teams — create team
  http.post(`${BASE}/teams`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: crypto.randomUUID(),
        name: body.name,
        slug: body.slug ?? (body.name as string).toLowerCase().replace(/\s+/g, "-"),
        member_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { status: 201 },
    );
  }),

  // GET /teams/:id — get team
  http.get(`${BASE}/teams/:id`, ({ params }) => {
    const team = TEAM_FIXTURES.find((t) => t.id === params.id);
    if (!team) {
      return HttpResponse.json({ detail: "TEAM_NOT_FOUND" }, { status: 404 });
    }
    const { my_role: _unused, ...teamRead } = team;
    return HttpResponse.json(teamRead);
  }),

  // PATCH /teams/:id — update team
  http.patch(`${BASE}/teams/:id`, async ({ params, request }) => {
    const team = TEAM_FIXTURES.find((t) => t.id === params.id);
    if (!team) {
      return HttpResponse.json({ detail: "TEAM_NOT_FOUND" }, { status: 404 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const { my_role: _unused, ...teamRead } = team;
    return HttpResponse.json({ ...teamRead, ...body });
  }),

  // DELETE /teams/:id — delete team
  http.delete(`${BASE}/teams/:id`, ({ params }) => {
    const team = TEAM_FIXTURES.find((t) => t.id === params.id);
    if (!team) {
      return HttpResponse.json({ detail: "TEAM_NOT_FOUND" }, { status: 404 });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // GET /teams/:id/members — list members
  http.get(`${BASE}/teams/:teamId/members`, ({ params }) => {
    const members = MEMBER_FIXTURES.filter(
      (m) => m.team_id === params.teamId,
    );
    return HttpResponse.json(members);
  }),

  // POST /teams/:id/members — add member
  http.post(`${BASE}/teams/:teamId/members`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: crypto.randomUUID(),
        team_id: params.teamId,
        user_id: body.user_id,
        role: body.role,
        user: {
          id: body.user_id,
          email: "new@test.com",
          display_name: null,
          avatar_url: null,
        },
        created_at: new Date().toISOString(),
      },
      { status: 201 },
    );
  }),

  // PATCH /teams/:id/members/:userId — update member role
  http.patch(
    `${BASE}/teams/:teamId/members/:userId`,
    async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      const member = MEMBER_FIXTURES.find(
        (m) => m.team_id === params.teamId && m.user_id === params.userId,
      );
      if (!member) {
        return HttpResponse.json(
          { detail: "MEMBER_NOT_FOUND" },
          { status: 404 },
        );
      }
      return HttpResponse.json({ ...member, role: body.role });
    },
  ),

  // DELETE /teams/:id/members/:userId — remove member
  http.delete(`${BASE}/teams/:teamId/members/:userId`, ({ params }) => {
    const member = MEMBER_FIXTURES.find(
      (m) => m.team_id === params.teamId && m.user_id === params.userId,
    );
    if (!member) {
      return HttpResponse.json(
        { detail: "MEMBER_NOT_FOUND" },
        { status: 404 },
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),
];

export { TEAM_FIXTURES, MEMBER_FIXTURES };
