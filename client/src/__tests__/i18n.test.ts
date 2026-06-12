import { describe, it, expect } from "vitest";

// Static imports of all translation files
import enCommon from "../locales/en/common.json";
import enAuth from "../locales/en/auth.json";
import enDashboard from "../locales/en/dashboard.json";
import enLanding from "../locales/en/landing.json";
import enErrors from "../locales/en/errors.json";
import enPrimitives from "../locales/en/primitives.json";
import zhTWCommon from "../locales/zh-TW/common.json";
import zhTWAuth from "../locales/zh-TW/auth.json";
import zhTWDashboard from "../locales/zh-TW/dashboard.json";
import zhTWLanding from "../locales/zh-TW/landing.json";
import zhTWErrors from "../locales/zh-TW/errors.json";
import zhTWPrimitives from "../locales/zh-TW/primitives.json";

const NAMESPACES: Record<string, { en: Record<string, unknown>; zhTW: Record<string, unknown> }> = {
  common: { en: enCommon, zhTW: zhTWCommon },
  auth: { en: enAuth, zhTW: zhTWAuth },
  dashboard: { en: enDashboard, zhTW: zhTWDashboard },
  landing: { en: enLanding, zhTW: zhTWLanding },
  errors: { en: enErrors, zhTW: zhTWErrors },
  primitives: { en: enPrimitives, zhTW: zhTWPrimitives },
};

describe("Translation key completeness", () => {
  for (const [ns, { en, zhTW }] of Object.entries(NAMESPACES)) {
    it(`${ns}: en and zh-TW have identical key sets`, () => {
      const enKeys = Object.keys(en).sort();
      const zhKeys = Object.keys(zhTW).sort();

      // Check for keys in en but missing in zh-TW
      const missingInZhTW = enKeys.filter((k) => !zhKeys.includes(k));
      expect(
        missingInZhTW,
        `Keys in en/${ns}.json missing from zh-TW/${ns}.json: ${missingInZhTW.join(", ")}`,
      ).toHaveLength(0);

      // Check for keys in zh-TW but missing in en
      const missingInEn = zhKeys.filter((k) => !enKeys.includes(k));
      expect(
        missingInEn,
        `Keys in zh-TW/${ns}.json missing from en/${ns}.json: ${missingInEn.join(", ")}`,
      ).toHaveLength(0);
    });
  }

  it("no empty translation values in any locale", () => {
    for (const [ns, { en, zhTW }] of Object.entries(NAMESPACES)) {
      const emptyInEn = Object.entries(en)
        .filter(([, v]) => typeof v === "string" && v.trim() === "")
        .map(([k]) => k);
      expect(
        emptyInEn,
        `Empty values in en/${ns}.json: ${emptyInEn.join(", ")}`,
      ).toHaveLength(0);

      const emptyInZhTW = Object.entries(zhTW)
        .filter(([, v]) => typeof v === "string" && v.trim() === "")
        .map(([k]) => k);
      expect(
        emptyInZhTW,
        `Empty values in zh-TW/${ns}.json: ${emptyInZhTW.join(", ")}`,
      ).toHaveLength(0);
    }
  });
});
