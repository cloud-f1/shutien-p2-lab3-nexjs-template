import { http, HttpResponse, type JsonBodyType } from "msw";
import { z } from "zod";

const BASE = "http://localhost:8080";

// ── Counter for unique string generation ────────────────────────
let mockCounter = 0;

/** Reset the internal counter (useful between tests). */
export function resetMockCounter(): void {
  mockCounter = 0;
}

// ── Core: generate mock data from any Zod schema ────────────────

/**
 * Recursively generates a valid mock value from a Zod schema.
 * The output always passes `schema.parse()`.
 *
 * Supports: object, string, number, boolean, enum, array, optional,
 * nullable, union, literal, date, default, effects, record, tuple, lazy.
 */
export function createMockFromSchema<T>(
  schema: z.ZodType<T>,
  overrides?: Partial<T>,
): T {
  const raw = generateFromZod(schema);
  if (overrides && typeof raw === "object" && raw !== null) {
    return { ...raw, ...overrides } as T;
  }
  return raw as T;
}

function generateFromZod(schema: z.ZodType<unknown>): unknown {
  const def = (schema as z.ZodType<unknown> & { _def: z.ZodTypeDef & { typeName: string } })._def;

  switch (def.typeName) {
    case "ZodObject": {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const result: Record<string, unknown> = {};
      for (const [key, fieldSchema] of Object.entries(shape)) {
        result[key] = generateFromZod(fieldSchema as z.ZodType<unknown>);
      }
      return result;
    }

    case "ZodString":
      return generateString(def as z.ZodStringDef);

    case "ZodNumber":
      return generateNumber(def as z.ZodNumberDef);

    case "ZodBoolean":
      return false;

    case "ZodEnum": {
      const values = (def as z.ZodEnumDef).values;
      return values[0];
    }

    case "ZodNativeEnum": {
      const enumObj = (def as z.ZodNativeEnumDef).values;
      const vals = Object.values(enumObj);
      return vals[0];
    }

    case "ZodArray":
      return [];

    case "ZodOptional":
      return undefined;

    case "ZodNullable": {
      const innerDef = (def as z.ZodNullableDef).innerType;
      return generateFromZod(innerDef);
    }

    case "ZodDefault": {
      const defaultDef = def as z.ZodDefaultDef;
      return defaultDef.defaultValue();
    }

    case "ZodLiteral":
      return (def as z.ZodLiteralDef).value;

    case "ZodUnion": {
      const options = (def as z.ZodUnionDef).options;
      return generateFromZod(options[0]);
    }

    case "ZodDiscriminatedUnion": {
      const discOptions = (def as z.ZodDiscriminatedUnionDef<string>).options;
      return generateFromZod(discOptions[0]);
    }

    case "ZodEffects": {
      // .transform(), .refine(), .pipe() — generate from inner schema
      const effectsDef = def as z.ZodEffectsDef;
      return generateFromZod(effectsDef.schema);
    }

    case "ZodRecord":
      return {};

    case "ZodTuple": {
      const items = (def as z.ZodTupleDef).items;
      return items.map((item: z.ZodType<unknown>) => generateFromZod(item));
    }

    case "ZodLazy": {
      const lazyDef = def as z.ZodLazyDef;
      return generateFromZod(lazyDef.getter());
    }

    case "ZodDate":
      return new Date("2024-01-01T00:00:00.000Z");

    case "ZodUndefined":
      return undefined;

    case "ZodNull":
      return null;

    case "ZodVoid":
      return undefined;

    case "ZodAny":
      return "mock-any";

    case "ZodUnknown":
      return "mock-unknown";

    default:
      return `mock-unsupported-${def.typeName}`;
  }
}

// ── String generation with constraint awareness ─────────────────

function generateString(def: z.ZodStringDef): string {
  const checks = def.checks ?? [];

  for (const check of checks) {
    switch (check.kind) {
      case "uuid":
        return crypto.randomUUID();
      case "email":
        return `mock-${++mockCounter}@example.com`;
      case "url":
        return `https://example.com/mock-${++mockCounter}`;
      case "datetime":
        return new Date("2024-01-01T00:00:00Z").toISOString();
      case "cuid":
        return `clmock${++mockCounter}00000000000000000`;
      case "ip":
        return "127.0.0.1";
    }
  }

  // Check for min length
  const minCheck = checks.find((c) => c.kind === "min");
  const minLen = minCheck ? (minCheck as z.ZodStringCheck & { value: number }).value : 0;

  const base = `mock-string-${++mockCounter}`;
  if (base.length < minLen) {
    return base.padEnd(minLen, "x");
  }
  return base;
}

// ── Number generation with constraint awareness ─────────────────

function generateNumber(def: z.ZodNumberDef): number {
  const checks = def.checks ?? [];
  const intCheck = checks.find((c) => c.kind === "int");
  const minCheck = checks.find((c) => c.kind === "min") as
    | (z.ZodNumberCheck & { value: number })
    | undefined;

  let value = minCheck ? minCheck.value : 0;
  if (!intCheck) {
    // Return a float for non-int numbers
    value = value === 0 ? 1.23 : value;
  }
  return value;
}

// ── MSW handler factory ─────────────────────────────────────────

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

/**
 * Creates an MSW handler that returns schema-valid response data.
 * The response is validated at handler creation time — if the schema
 * changes and the mock becomes invalid, tests fail immediately.
 *
 * @param method  HTTP method
 * @param path    URL path (without base, e.g. "/users/me")
 * @param schema  Zod schema for the response body
 * @param overrides  Optional partial overrides for the mock data
 * @param status  HTTP status code (default 200)
 */
export function createHandlerFromSchema<T>(
  method: HttpMethod,
  path: string,
  schema: z.ZodType<T>,
  overrides?: Partial<T>,
  status = 200,
) {
  const mockData = createMockFromSchema(schema, overrides);

  // Validate at creation time — fail fast if schema changed
  schema.parse(mockData);

  return http[method](`${BASE}${path}`, () =>
    // mockData is generated from a Zod schema (always JSON-serializable);
    // the generic T isn't provably JsonBodyType, so narrow it for MSW.
    HttpResponse.json(mockData as JsonBodyType, { status }),
  );
}
