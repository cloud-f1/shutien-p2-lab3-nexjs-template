import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import {
  createMockFromSchema,
  createHandlerFromSchema,
  resetMockCounter,
} from "../mockFactory";
import {
  userSchema,
  tokenPairSchema,
  healthResponseSchema,
} from "../../../schemas/auth";
import { adminHealthResponseSchema } from "../../../schemas/admin";

beforeEach(() => {
  resetMockCounter();
});

// ── createMockFromSchema ────────────────────────────────────────

describe("createMockFromSchema", () => {
  it("generates valid data for a simple object schema", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      active: z.boolean(),
    });
    const mock = createMockFromSchema(schema);
    expect(() => schema.parse(mock)).not.toThrow();
  });

  it("generates valid data for userSchema", () => {
    const mock = createMockFromSchema(userSchema);
    expect(() => userSchema.parse(mock)).not.toThrow();
    expect(mock.email).toContain("@example.com");
    expect(mock.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("generates valid data for tokenPairSchema", () => {
    const mock = createMockFromSchema(tokenPairSchema);
    expect(() => tokenPairSchema.parse(mock)).not.toThrow();
    expect(mock.token_type).toBe("bearer");
  });

  it("generates valid data for healthResponseSchema", () => {
    const mock = createMockFromSchema(healthResponseSchema);
    expect(() => healthResponseSchema.parse(mock)).not.toThrow();
  });

  it("generates valid data for adminHealthResponseSchema", () => {
    const mock = createMockFromSchema(adminHealthResponseSchema);
    expect(() => adminHealthResponseSchema.parse(mock)).not.toThrow();
  });

  it("applies overrides correctly", () => {
    const mock = createMockFromSchema(userSchema, {
      email: "custom@test.com",
      is_superuser: true,
    });
    expect(mock.email).toBe("custom@test.com");
    expect(mock.is_superuser).toBe(true);
    // Non-overridden fields still valid
    expect(() => userSchema.parse(mock)).not.toThrow();
  });

  it("handles z.enum() — picks first value", () => {
    const schema = z.object({
      status: z.enum(["active", "inactive", "pending"]),
    });
    const mock = createMockFromSchema(schema);
    expect(mock.status).toBe("active");
  });

  it("handles z.optional() — returns undefined", () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional(),
    });
    const mock = createMockFromSchema(schema);
    expect(mock.required).toBeDefined();
    expect(mock.optional).toBeUndefined();
  });

  it("handles z.nullable() — returns inner value, not null", () => {
    const schema = z.object({
      name: z.string().nullable(),
    });
    const mock = createMockFromSchema(schema);
    expect(typeof mock.name).toBe("string");
  });

  it("handles z.array() — returns empty array", () => {
    const schema = z.object({
      tags: z.array(z.string()),
    });
    const mock = createMockFromSchema(schema);
    expect(mock.tags).toEqual([]);
  });

  it("handles z.literal()", () => {
    const schema = z.object({
      type: z.literal("user"),
    });
    const mock = createMockFromSchema(schema);
    expect(mock.type).toBe("user");
  });

  it("handles z.union() — picks first option", () => {
    const schema = z.object({
      value: z.union([z.string(), z.number()]),
    });
    const mock = createMockFromSchema(schema);
    expect(typeof mock.value).toBe("string");
  });

  it("handles z.default() — uses default value", () => {
    const schema = z.object({
      page: z.number().default(1),
    });
    const mock = createMockFromSchema(schema);
    expect(mock.page).toBe(1);
  });

  it("handles nested objects recursively", () => {
    const schema = z.object({
      user: z.object({
        profile: z.object({
          name: z.string(),
          verified: z.boolean(),
        }),
      }),
    });
    const mock = createMockFromSchema(schema);
    expect(() => schema.parse(mock)).not.toThrow();
    expect(typeof mock.user.profile.name).toBe("string");
    expect(mock.user.profile.verified).toBe(false);
  });

  it("handles z.string().uuid()", () => {
    const schema = z.object({ id: z.string().uuid() });
    const mock = createMockFromSchema(schema);
    expect(mock.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("handles z.string().email()", () => {
    const schema = z.object({ email: z.string().email() });
    const mock = createMockFromSchema(schema);
    expect(mock.email).toContain("@");
  });

  it("handles z.string().url()", () => {
    const schema = z.object({ url: z.string().url() });
    const mock = createMockFromSchema(schema);
    expect(mock.url).toMatch(/^https?:\/\//);
  });

  it("handles z.string().datetime()", () => {
    const schema = z.object({ ts: z.string().datetime() });
    const mock = createMockFromSchema(schema);
    expect(() => new Date(mock.ts)).not.toThrow();
  });

  it("handles z.number().int()", () => {
    const schema = z.object({ count: z.number().int() });
    const mock = createMockFromSchema(schema);
    expect(Number.isInteger(mock.count)).toBe(true);
  });

  it("schema field additions are automatically reflected", () => {
    const schemaV1 = z.object({ name: z.string() });
    const schemaV2 = z.object({ name: z.string(), age: z.number() });

    const mockV1 = createMockFromSchema(schemaV1);
    const mockV2 = createMockFromSchema(schemaV2);

    expect("age" in mockV1).toBe(false);
    expect("age" in mockV2).toBe(true);
    expect(() => schemaV2.parse(mockV2)).not.toThrow();
  });
});

// ── createHandlerFromSchema ─────────────────────────────────────

describe("createHandlerFromSchema", () => {
  it("returns an MSW handler", () => {
    const handler = createHandlerFromSchema(
      "get",
      "/test",
      z.object({ ok: z.boolean() }),
    );
    expect(handler).toBeDefined();
    expect(handler.info.method).toBe("GET");
  });

  it("applies overrides to handler response", () => {
    const schema = z.object({
      name: z.string(),
      active: z.boolean(),
    });
    // Should not throw during creation (data is valid)
    expect(() =>
      createHandlerFromSchema("get", "/test", schema, { active: true }),
    ).not.toThrow();
  });

  it("throws at creation time if overrides break schema validity", () => {
    const schema = z.object({
      count: z.number().int().min(0),
    });
    // A negative override should cause parse to throw
    expect(() =>
      createHandlerFromSchema("get", "/test", schema, {
        count: -1 as unknown as number,
      }),
    ).toThrow();
  });
});
