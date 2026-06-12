import { http, HttpResponse } from "msw";
import { createCrudHandlers } from "../helpers/createHandlers";

const BASE = "http://localhost:8080";

const POST_FIXTURES = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    title: "My First Post",
    body: "This is the body of my first blog post.",
    published: true,
    published_at: "2026-01-01T12:00:00Z",
    user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    title: "Draft Post",
    body: "This post is still a draft.",
    published: false,
    published_at: null,
    user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
];

// Use generic CRUD handlers but override POST to return complete object
const baseHandlers = createCrudHandlers("/posts", POST_FIXTURES);

// Replace POST handler with one that returns all required fields
const createHandler = http.post(`${BASE}/posts`, async ({ request }) => {
  const body = (await request.json()) as Record<string, unknown>;
  const published = Boolean(body.published);
  return HttpResponse.json(
    {
      id: crypto.randomUUID(),
      title: null,
      body: null,
      published: false,
      published_at: published ? new Date().toISOString() : null,
      user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...body,
    },
    { status: 201 },
  );
});

export const postHandlers = [
  createHandler,
  ...baseHandlers.filter((h) => {
    const info = h.info as { method?: string; path?: string };
    return !(info.method === "POST" && info.path === `${BASE}/posts`);
  }),
];
export { POST_FIXTURES };
