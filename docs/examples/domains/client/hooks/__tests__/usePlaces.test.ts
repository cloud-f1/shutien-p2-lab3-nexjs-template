import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  usePlacesList,
  usePlaceDetail,
  usePlaceCreate,
  usePlaceUpdate,
  usePlaceDelete,
} from "../usePlaces";
import { server } from "../../tests/setup";
import { placeHandlers, PLACE_FIXTURES } from "../../tests/handlers/places";
import { createWrapper } from "../../tests/helpers/createWrapper";

describe("usePlaces hooks", () => {
  beforeEach(() => {
    server.use(...placeHandlers);
  });

  describe("usePlacesList", () => {
    it("returns paginated places", async () => {
      const { result } = renderHook(
        () => usePlacesList({ page: 1, page_size: 20 }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.items).toHaveLength(2);
      expect(result.current.data!.items[0].name).toBe("Test Place A");
    });
  });

  describe("usePlaceDetail", () => {
    it("returns a single place by id", async () => {
      const { result } = renderHook(
        () => usePlaceDetail(PLACE_FIXTURES[0].id),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.name).toBe("Test Place A");
    });

    it("does not fetch when id is empty", () => {
      const { result } = renderHook(() => usePlaceDetail(""), {
        wrapper: createWrapper(),
      });
      expect(result.current.isFetching).toBe(false);
    });
  });

  describe("usePlaceCreate", () => {
    it("creates a place", async () => {
      const { result } = renderHook(() => usePlaceCreate(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        name: "New Place",
        latitude: 25.0,
        longitude: 121.0,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.name).toBe("New Place");
    });
  });

  describe("usePlaceUpdate", () => {
    it("updates a place", async () => {
      const { result } = renderHook(() => usePlaceUpdate(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        id: PLACE_FIXTURES[0].id,
        data: { name: "Updated Place" },
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.name).toBe("Updated Place");
    });
  });

  describe("usePlaceDelete", () => {
    it("deletes a place", async () => {
      const { result } = renderHook(() => usePlaceDelete(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(PLACE_FIXTURES[0].id);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });
});
