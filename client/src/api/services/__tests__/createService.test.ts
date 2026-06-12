import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { server } from "../../../tests/setup";
import { createCrudHandlers } from "../../../tests/helpers/createHandlers";
import { createService } from "../createService";

// ── Test schema + fixtures ──────────────────────────────────────

const itemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  value: z.number(),
});

type Item = z.infer<typeof itemSchema>;

const FIXTURES: Item[] = [
  { id: "00000000-0000-0000-0000-000000000001", name: "Alpha", value: 10 },
  { id: "00000000-0000-0000-0000-000000000002", name: "Beta", value: 20 },
  { id: "00000000-0000-0000-0000-000000000003", name: "Gamma", value: 30 },
];

const PATH = "/api/v1/items";

// ── Setup ───────────────────────────────────────────────────────

beforeEach(() => {
  server.use(...createCrudHandlers(PATH, FIXTURES));
});

// ── Tests ───────────────────────────────────────────────────────

describe("createService", () => {
  const svc = createService(PATH, itemSchema);

  describe("list (paginated)", () => {
    it("returns paginated response", async () => {
      const result = await svc.list({ page: 1, page_size: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.pages).toBe(2);
      expect(result.items[0].name).toBe("Alpha");
    });
  });

  describe("listAll (array)", () => {
    it("returns flat array validated through Zod", async () => {
      // Override handler to return plain array for this test
      const { http, HttpResponse } = await import("msw");
      server.use(
        http.get(`http://localhost:8080${PATH}`, () =>
          HttpResponse.json(FIXTURES),
        ),
      );

      const items = await svc.listAll();
      expect(items).toHaveLength(3);
      expect(items[1].name).toBe("Beta");
    });
  });

  describe("getById", () => {
    it("returns single item validated through Zod", async () => {
      const item = await svc.getById(FIXTURES[0].id);
      expect(item.name).toBe("Alpha");
      expect(item.value).toBe(10);
    });

    it("throws on 404", async () => {
      await expect(
        svc.getById("00000000-0000-0000-0000-999999999999"),
      ).rejects.toThrow();
    });
  });

  describe("create", () => {
    it("creates and returns validated item", async () => {
      const created = await svc.create({ name: "Delta", value: 40 });
      expect(created.name).toBe("Delta");
      expect(created.id).toBeDefined();
    });
  });

  describe("update", () => {
    it("patches and returns updated item", async () => {
      const updated = await svc.update(FIXTURES[0].id, { name: "Alpha-v2" });
      expect(updated.name).toBe("Alpha-v2");
      expect(updated.value).toBe(10); // unchanged fields preserved
    });
  });

  describe("remove", () => {
    it("deletes without error", async () => {
      await expect(svc.remove(FIXTURES[0].id)).resolves.toBeUndefined();
    });
  });

  describe("Zod validation", () => {
    it("rejects response that doesn't match schema", async () => {
      const { http, HttpResponse } = await import("msw");
      server.use(
        http.get(`http://localhost:8080${PATH}/bad`, () =>
          HttpResponse.json({ id: "not-a-uuid", name: 123 }),
        ),
      );

      await expect(svc.getById("bad")).rejects.toThrow();
    });
  });
});
