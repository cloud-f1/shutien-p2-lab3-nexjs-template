import { http, HttpResponse } from "msw";
import { createCrudHandlers } from "../helpers/createHandlers";

const BASE = "http://localhost:8080";

const CONTACT_FIXTURES = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Alice Smith",
    email: "alice@acme.com",
    phone: "+1-555-1234",
    company: "Acme Corp",
    notes: "Key decision maker for the enterprise plan.",
    notes_preview: "Key decision maker for the enterprise plan.",
    user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Bob Jones",
    email: "bob@widgets.com",
    phone: null,
    company: "Widget Inc",
    notes: null,
    notes_preview: null,
    user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
];

// Use generic CRUD handlers but override POST to return complete object
const baseHandlers = createCrudHandlers("/contacts", CONTACT_FIXTURES);

// Replace POST handler with one that returns all required fields
const createHandler = http.post(`${BASE}/contacts`, async ({ request }) => {
  const body = (await request.json()) as Record<string, unknown>;
  const notes = (body.notes as string) || null;
  return HttpResponse.json(
    {
      id: crypto.randomUUID(),
      name: null,
      email: null,
      phone: null,
      company: null,
      notes: null,
      notes_preview: notes && notes.length > 200 ? notes.slice(0, 200) + "..." : notes,
      user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...body,
    },
    { status: 201 },
  );
});

export const contactHandlers = [
  createHandler,
  ...baseHandlers.filter((h) => {
    const info = h.info as { method?: string; path?: string };
    return !(info.method === "POST" && info.path === `${BASE}/contacts`);
  }),
];
export { CONTACT_FIXTURES };
