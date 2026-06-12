import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Static imports — JSON bundled at build time (~10-15KB gzipped for 2 locales)
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enDashboard from './locales/en/dashboard.json';
import enLanding from './locales/en/landing.json';
import enErrors from './locales/en/errors.json';
import enPrimitives from './locales/en/primitives.json';
import zhTWCommon from './locales/zh-TW/common.json';
import zhTWAuth from './locales/zh-TW/auth.json';
import zhTWDashboard from './locales/zh-TW/dashboard.json';
import zhTWLanding from './locales/zh-TW/landing.json';
import zhTWErrors from './locales/zh-TW/errors.json';
import zhTWPrimitives from './locales/zh-TW/primitives.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh-TW', label: '繁體中文' },
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        auth: enAuth,
        dashboard: enDashboard,
        landing: enLanding,
        errors: enErrors,
        primitives: enPrimitives,
      },
      'zh-TW': {
        common: zhTWCommon,
        auth: zhTWAuth,
        dashboard: zhTWDashboard,
        landing: zhTWLanding,
        errors: zhTWErrors,
        primitives: zhTWPrimitives,
      },
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'auth', 'dashboard', 'landing', 'errors', 'primitives'],
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
  });

// Update <html lang="..."> when language changes (WCAG requirement for screen readers)
i18n.on('languageChanged', (lng: string) => {
  document.documentElement.setAttribute('lang', lng);
});

// Set initial lang attribute
if (i18n.language) {
  document.documentElement.setAttribute('lang', i18n.language);
}

export default i18n;
