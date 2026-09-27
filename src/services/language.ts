import { detectSystemLanguage } from '../i18n';
import { BASE_LANGUAGE, catalogs, type Language } from '../i18n/catalogs';
import type { StoragePort } from './history';

export const LANGUAGE_KEY = 'snatchy-language-v1';
export { catalogs };
export type { Language };

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && value in catalogs;
}

/**
 * Returns the stored choice, or null when the visitor has never picked one. An
 * unreadable store is treated as no choice rather than an error: the language is
 * cosmetic, so a blocked localStorage must not surface a warning.
 */
export function loadLanguage(storage: StoragePort): Language | null {
  try {
    const raw = storage.getItem(LANGUAGE_KEY);
    return isLanguage(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function saveLanguage(storage: StoragePort, language: Language): string {
  try {
    storage.setItem(LANGUAGE_KEY, language);
    return '';
  } catch {
    return 'settings.languageSessionOnly';
  }
}

/** The system locale, or the base language when it is unsupported. */
export function systemLanguage(): Language {
  return detectSystemLanguage();
}

/** An explicit choice wins; otherwise follow the operating system. */
export function preferredLanguage(storage: StoragePort): Language {
  return loadLanguage(storage) ?? systemLanguage();
}

export { BASE_LANGUAGE };

/**
 * The language lives on <html>, not inside #app, for two reasons. It survives
 * the full innerHTML re-render that every route performs, and `lang` is what
 * assistive technology, the browser's own hyphenation and `Intl` all read, so it
 * has to be set on the document rather than on a container.
 *
 * There is deliberately no change listener. The theme follows a `matchMedia`
 * query, but no browser exposes an event for `navigator.language`, so the
 * locale is resolved once at startup and then only when the visitor changes it.
 */
export function applyLanguage(doc: Document, language: Language): void {
  doc.documentElement.lang = language;
}
