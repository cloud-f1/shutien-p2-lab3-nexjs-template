import i18n from '../i18n';

interface ErrorWithMessageKey {
  detail: string;
  message_key?: string | null;
}

/**
 * Maps an API error response to a localized string.
 *
 * Fallback chain:
 * 1. If `message_key` is present, look up translation in `errors` namespace
 * 2. If no translation found (i18next returns the key itself), fall back to raw `detail`
 * 3. If `detail` is also empty, return a generic error string
 */
export function getLocalizedError(error: ErrorWithMessageKey): string {
  if (error.message_key) {
    const translated = i18n.t(error.message_key, { ns: 'errors' });
    // i18n.t returns the key itself if no translation found
    if (translated !== error.message_key) {
      return translated;
    }
  }
  // Fallback: raw detail string or generic message
  return error.detail || i18n.t('error.generic', { ns: 'errors' });
}
