import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  paginatedResponseSchema,
  paginationParamsSchema,
  apiErrorSchema,
  messageResponseSchema,
} from "../common";

const itemSchema = z.object({ id: z.string(), name: z.string() });

describe("paginatedResponseSchema", () => {
  const schema = paginatedResponseSchema(itemSchema);

  it("accepts valid paginated response", () => {
    const result = schema.safeParse({
      items: [{ id: "1", name: "A" }],
      total: 1,
      page: 1,
      page_size: 20,
      pages: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid items", () => {
    const result = schema.safeParse({
      items: [{ id: "1" }], // missing name
      total: 1,
      page: 1,
      page_size: 20,
      pages: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative total", () => {
    const result = schema.safeParse({
      items: [],
      total: -1,
      page: 1,
      page_size: 20,
      pages: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("paginationParamsSchema", () => {
  it("applies defaults", () => {
    const result = paginationParamsSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.page_size).toBe(20);
  });

  it("rejects page_size over 100", () => {
    const result = paginationParamsSchema.safeParse({ page_size: 101 });
    expect(result.success).toBe(false);
  });

  it("rejects page < 1", () => {
    const result = paginationParamsSchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });
});

describe("apiErrorSchema", () => {
  it("accepts string detail", () => {
    const result = apiErrorSchema.safeParse({
      detail: "LOGIN_BAD_CREDENTIALS",
    });
    expect(result.success).toBe(true);
  });

  it("accepts validation error array", () => {
    const result = apiErrorSchema.safeParse({
      detail: [
        {
          loc: ["body", "email"],
          msg: "not a valid email",
          type: "value_error",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing detail", () => {
    const result = apiErrorSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("messageResponseSchema", () => {
  it("accepts valid message", () => {
    const result = messageResponseSchema.safeParse({ message: "Success" });
    expect(result.success).toBe(true);
  });

  it("rejects missing message", () => {
    const result = messageResponseSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
