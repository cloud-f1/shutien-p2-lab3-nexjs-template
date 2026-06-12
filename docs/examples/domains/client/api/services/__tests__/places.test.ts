import { describe, it, expect, beforeEach } from "vitest";
import { server } from "../../../tests/setup";
import { placeHandlers, PLACE_FIXTURES } from "../../../tests/handlers/places";
import { placesService } from "../places";

describe("placesService", () => {
  beforeEach(() => {
    server.use(...placeHandlers);
  });

  it("list() returns paginated places", async () => {
    const result = await placesService.list({ page: 1, page_size: 20 });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.items[0].name).toBe("Test Place A");
    expect(result.items[0].id).toBe(PLACE_FIXTURES[0].id);
  });

  it("getById() returns a single place", async () => {
    const place = await placesService.getById(PLACE_FIXTURES[0].id);
    expect(place.name).toBe("Test Place A");
    expect(place.latitude).toBe(25.033);
    expect(place.user_id).toBe(PLACE_FIXTURES[0].user_id);
  });

  it("create() sends data and returns parsed place", async () => {
    const newPlace = await placesService.create({
      name: "New Place",
      latitude: 25.0,
      longitude: 121.0,
    });
    expect(newPlace.name).toBe("New Place");
    expect(newPlace.id).toBeDefined();
  });

  it("update() sends patch and returns updated place", async () => {
    const updated = await placesService.update(PLACE_FIXTURES[0].id, {
      name: "Updated Name",
    });
    expect(updated.name).toBe("Updated Name");
    // Original fields should persist from the mock
    expect(updated.latitude).toBe(25.033);
  });

  it("remove() calls DELETE", async () => {
    // Should not throw
    await expect(
      placesService.remove(PLACE_FIXTURES[0].id),
    ).resolves.toBeUndefined();
  });
});
