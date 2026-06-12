import { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "../../locales/en/common.json";
import enAuth from "../../locales/en/auth.json";
import enDashboard from "../../locales/en/dashboard.json";
import enLanding from "../../locales/en/landing.json";
import enErrors from "../../locales/en/errors.json";
import enPrimitives from "../../locales/en/primitives.json";
import zhTWCommon from "../../locales/zh-TW/common.json";
import zhTWAuth from "../../locales/zh-TW/auth.json";
import zhTWDashboard from "../../locales/zh-TW/dashboard.json";
import zhTWLanding from "../../locales/zh-TW/landing.json";
import zhTWErrors from "../../locales/zh-TW/errors.json";
import zhTWPrimitives from "../../locales/zh-TW/primitives.json";

/**
 * Creates a fresh i18next instance for testing.
 * Each test gets its own instance to avoid state leakage.
 */
export function createTestI18n(language = "en"): typeof i18n {
  const testI18n = i18n.createInstance();
  testI18n.use(initReactI18next).init({
    resources: {
      en: {
        common: enCommon,
        auth: enAuth,
        dashboard: enDashboard,
        landing: enLanding,
        errors: enErrors,
        primitives: enPrimitives,
      },
      "zh-TW": {
        common: zhTWCommon,
        auth: zhTWAuth,
        dashboard: zhTWDashboard,
        landing: zhTWLanding,
        errors: zhTWErrors,
        primitives: zhTWPrimitives,
      },
    },
    lng: language,
    fallbackLng: "en",
    defaultNS: "common",
    ns: ["common", "auth", "dashboard", "landing", "errors", "primitives"],
    interpolation: { escapeValue: false },
  });
  return testI18n;
}

/**
 * Wraps children with I18nextProvider for test rendering.
 */
export function I18nTestWrapper({
  children,
  language = "en",
}: {
  children: ReactNode;
  language?: string;
}) {
  const testI18n = createTestI18n(language);
  return <I18nextProvider i18n={testI18n}>{children}</I18nextProvider>;
}
