import { http, HttpResponse } from "msw";

const BASE = "http://localhost:8080";

interface HasId {
  id: string;
}

/**
 * Generates standard CRUD MSW handlers for a given base path + fixtures.
 *
 * Usage:
 *   const placeFixtures = [{ id: "uuid-1", name: "Place A" }];
 *   const placeHandlers = createCrudHandlers("/api/v1/places", placeFixtures);
 *   // → GET /api/v1/places, GET /:id, POST, PATCH /:id, DELETE /:id
 */
export function createCrudHandlers<T extends HasId>(
  basePath: string,
  fixtures: T[],
) {
  const url = `${BASE}${basePath}`;

  return [
    // LIST — returns paginated envelope
    http.get(url, ({ request }) => {
      const params = new URL(request.url).searchParams;
      const page = Number(params.get("page") ?? 1);
      const pageSize = Number(params.get("page_size") ?? 20);
      const start = (page - 1) * pageSize;
      const items = fixtures.slice(start, start + pageSize);

      return HttpResponse.json({
        items,
        total: fixtures.length,
        page,
        page_size: pageSize,
        pages: Math.ceil(fixtures.length / pageSize),
      });
    }),

    // GET by ID
    http.get(`${url}/:id`, ({ params }) => {
      const item = fixtures.find((f) => f.id === params.id);
      if (!item) {
        return HttpResponse.json({ detail: "Not found" }, { status: 404 });
      }
      return HttpResponse.json(item);
    }),

    // CREATE
    http.post(url, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(
        { id: crypto.randomUUID(), ...body },
        { status: 201 },
      );
    }),

    // UPDATE
    http.patch(`${url}/:id`, async ({ request, params }) => {
      const item = fixtures.find((f) => f.id === params.id);
      if (!item) {
        return HttpResponse.json({ detail: "Not found" }, { status: 404 });
      }
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ ...item, ...body });
    }),

    // DELETE
    http.delete(`${url}/:id`, ({ params }) => {
      const item = fixtures.find((f) => f.id === params.id);
      if (!item) {
        return HttpResponse.json({ detail: "Not found" }, { status: 404 });
      }
      return new HttpResponse(null, { status: 204 });
    }),
  ];
}
