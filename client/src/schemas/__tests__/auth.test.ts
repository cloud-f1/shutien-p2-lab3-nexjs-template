import { describe, it, expect } from "vitest";
import {
  registerRequestSchema,
  loginRequestSchema,
  forgotPasswordRequestSchema,
  resetPasswordRequestSchema,
  userSchema,
} from "../auth";

describe("registerRequestSchema", () => {
  it("accepts valid registration data", () => {
    const result = registerRequestSchema.safeParse({
      email: "test@example.com",
      password: "securePass1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing email", () => {
    const result = registerRequestSchema.safeParse({
      password: "securePass1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short password (less than 8 chars)", () => {
    const result = registerRequestSchema.safeParse({
      email: "test@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginRequestSchema", () => {
  it("accepts valid login data", () => {
    const result = loginRequestSchema.safeParse({
      email: "test@example.com",
      password: "anyPassword",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing fields", () => {
    const result = loginRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("forgotPasswordRequestSchema", () => {
  it("accepts valid email", () => {
    const result = forgotPasswordRequestSchema.safeParse({
      email: "test@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = forgotPasswordRequestSchema.safeParse({
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });
});

describe("resetPasswordRequestSchema", () => {
  it("accepts valid data", () => {
    const result = resetPasswordRequestSchema.safeParse({
      token: "some-reset-token",
      new_password: "newSecure1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing token", () => {
    const result = resetPasswordRequestSchema.safeParse({
      new_password: "newSecure1",
    });
    expect(result.success).toBe(false);
  });
});

describe("userSchema", () => {
  it("parses a valid user object", () => {
    const result = userSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      email: "alex@example.com",
      display_name: "Alex",
      avatar_url: null,
      is_verified: true,
      is_active: true,
      is_superuser: false,
      social_providers: ["google"],
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("alex@example.com");
    }
  });
});
