import { useServiceQuery, useServiceMutation } from "./useService";
import { CACHE_TIERS } from "../cacheConfig";
import { placesService } from "../api/services/places";
import type { PaginationParams } from "../schemas/common";
import type { PlaceCreate, PlaceUpdate } from "../schemas/place";

export function usePlacesList(params?: PaginationParams) {
  return useServiceQuery(
    ["places", params],
    () => placesService.list(params),
    CACHE_TIERS.STANDARD,
  );
}

export function usePlaceDetail(id: string) {
  return useServiceQuery(
    ["places", id],
    () => placesService.getById(id),
    CACHE_TIERS.STANDARD,
    { enabled: !!id },
  );
}

export function usePlaceCreate() {
  return useServiceMutation(
    (data: PlaceCreate) => placesService.create(data as Record<string, unknown>),
    { invalidateKeys: [["places"]] },
  );
}

export function usePlaceUpdate() {
  return useServiceMutation(
    ({ id, data }: { id: string; data: PlaceUpdate }) =>
      placesService.update(id, data as Record<string, unknown>),
    { invalidateKeys: [["places"]] },
  );
}

export function usePlaceDelete() {
  return useServiceMutation(
    (id: string) => placesService.remove(id),
    { invalidateKeys: [["places"]] },
  );
}
