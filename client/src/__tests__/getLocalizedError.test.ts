import { describe, it, expect, beforeEach } from "vitest";
import { getLocalizedError } from "../utils/getLocalizedError";
import i18n from "../i18n";

describe("getLocalizedError", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("returns translated string when message_key has a translation", () => {
    const result = getLocalizedError({
      detail: "LOGIN_BAD_CREDENTIALS",
      message_key: "error.auth.invalid_credentials",
    });
    expect(result).toBe(
      "Invalid email or password. Please try again.",
    );
  });

  it("falls back to detail when message_key has no translation", () => {
    const result = getLocalizedError({
      detail: "SOME_UNKNOWN_ERROR",
      message_key: "error.nonexistent.key",
    });
    expect(result).toBe("SOME_UNKNOWN_ERROR");
  });

  it("falls back to detail when message_key is null", () => {
    const result = getLocalizedError({
      detail: "RAW_ERROR_CODE",
      message_key: null,
    });
    expect(result).toBe("RAW_ERROR_CODE");
  });

  it("falls back to detail when message_key is undefined", () => {
    const result = getLocalizedError({
      detail: "RAW_ERROR_CODE",
    });
    expect(result).toBe("RAW_ERROR_CODE");
  });

  it("returns generic error when both message_key and detail are empty", () => {
    const result = getLocalizedError({
      detail: "",
      message_key: null,
    });
    expect(result).toBe("An unexpected error occurred. Please try again.");
  });

  it("returns zh-TW translation when language is zh-TW", async () => {
    await i18n.changeLanguage("zh-TW");
    const result = getLocalizedError({
      detail: "LOGIN_BAD_CREDENTIALS",
      message_key: "error.auth.invalid_credentials",
    });
    expect(result).toBe("電子郵件或密碼錯誤，請重新嘗試。");
  });

  it("maps all known error keys correctly", () => {
    const knownKeys = [
      { key: "error.auth.invalid_credentials", expected: "Invalid email or password. Please try again." },
      { key: "error.auth.user_already_exists", expected: "An account with that email already exists." },
      { key: "error.auth.invalid_refresh_token", expected: "Your session has expired. Please sign in again." },
      { key: "error.auth.reset_bad_token", expected: "This reset link is invalid or expired. Please request a new one." },
      { key: "error.auth.verify_bad_token", expected: "This verification link is invalid or expired. Please request a new one." },
      { key: "error.teams.slug_exists", expected: "A team with that URL slug already exists." },
      { key: "error.teams.member_exists", expected: "This user is already a member of the team." },
      { key: "error.billing.already_active", expected: "This team already has an active subscription." },
      { key: "error.billing.no_customer", expected: "No billing account found. Please contact support." },
      { key: "error.billing.invalid_signature", expected: "Invalid billing webhook signature." },
      { key: "error.places.already_in_portfolio", expected: "This place is already in the portfolio." },
    ];

    for (const { key, expected } of knownKeys) {
      const result = getLocalizedError({ detail: "UNUSED", message_key: key });
      expect(result, `Failed for key: ${key}`).toBe(expected);
    }
  });
});
