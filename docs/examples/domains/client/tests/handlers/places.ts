import { http, HttpResponse } from "msw";
import { createCrudHandlers } from "../helpers/createHandlers";

const BASE = "http://localhost:8080";

const PLACE_FIXTURES = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Test Place A",
    address: "123 Test St",
    description: "A test place",
    latitude: 25.033,
    longitude: 121.565,
    category: "restaurant",
    user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Test Place B",
    address: "456 Test Ave",
    description: null,
    latitude: 25.045,
    longitude: 121.520,
    category: null,
    user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
];

// Use generic CRUD handlers but override POST to return complete object
const baseHandlers = createCrudHandlers("/places", PLACE_FIXTURES);

// Replace POST handler with one that returns all required fields
const createHandler = http.post(`${BASE}/places`, async ({ request }) => {
  const body = (await request.json()) as Record<string, unknown>;
  return HttpResponse.json(
    {
      id: crypto.randomUUID(),
      address: null,
      description: null,
      category: null,
      user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...body,
    },
    { status: 201 },
  );
});

export const placeHandlers = [
  createHandler,
  ...baseHandlers.filter((h) => {
    // Remove the generic POST handler (index 2 in the array)
    const info = h.info as { method?: string; path?: string };
    return !(info.method === "POST" && info.path === `${BASE}/places`);
  }),
];
export { PLACE_FIXTURES };
