import { isAxiosError } from "axios";

/** Stripe-style error envelope shape returned by the API (E132). */
export interface ApiError {
  type: string;
  code: string;
  message: string;
  param?: string;
  details?: { param: string; message: string }[];
}

/** Extract the structured error envelope from an Axios error, or null. */
export function extractApiError(err: unknown): ApiError | null {
  if (isAxiosError(err) && err.response?.data?.error) {
    return err.response.data.error as ApiError;
  }
  return null;
}

/** Extract a human-readable message — backward compatible with legacy `{detail}` shape. */
export function extractApiDetail(err: unknown): string {
  const envelope = extractApiError(err);
  if (envelope) return envelope.message;
  return isAxiosError(err) ? (err.response?.data?.detail ?? "") : "";
}
