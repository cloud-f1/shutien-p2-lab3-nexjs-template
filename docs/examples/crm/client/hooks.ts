import { useServiceQuery, useServiceMutation } from "./useService";
import { CACHE_TIERS } from "../cacheConfig";
import { contactsService } from "../api/services/contacts";
import type { PaginationParams } from "../schemas/common";
import type { ContactCreate, ContactUpdate } from "../schemas/contact";

export function useContactsList(params?: PaginationParams) {
  return useServiceQuery(
    ["contacts", params],
    () => contactsService.list(params),
    CACHE_TIERS.STANDARD,
  );
}

export function useContactDetail(id: string) {
  return useServiceQuery(
    ["contacts", id],
    () => contactsService.getById(id),
    CACHE_TIERS.STANDARD,
    { enabled: !!id },
  );
}

export function useContactCreate() {
  return useServiceMutation(
    (data: ContactCreate) => contactsService.create(data as Record<string, unknown>),
    { invalidateKeys: [["contacts"]] },
  );
}

export function useContactUpdate() {
  return useServiceMutation(
    ({ id, data }: { id: string; data: ContactUpdate }) =>
      contactsService.update(id, data as Record<string, unknown>),
    { invalidateKeys: [["contacts"]] },
  );
}

export function useContactDelete() {
  return useServiceMutation(
    (id: string) => contactsService.remove(id),
    { invalidateKeys: [["contacts"]] },
  );
}
