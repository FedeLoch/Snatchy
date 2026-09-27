import en from './locales/en/messages.json' with { type: 'json' };
import es from './locales/es/messages.json' with { type: 'json' };
import fr from './locales/fr/messages.json' with { type: 'json' };

/**
 * Every supported language needs two things: a statically imported catalog so
 * `t()` can stay synchronous, and a picker entry. Adding a language is
 * therefore a three-step change: drop the JSON file in, add the import and the
 * `catalogs` entry here, add one `LANGUAGE_OPTIONS` row.
 */
export const catalogs = { en, es, fr };

export type Language = keyof typeof catalogs;

/** Fallback for an unsupported or undetectable system locale. */
export const BASE_LANGUAGE: Language = 'en';

/**
 * `label` is the endonym, so a visitor who cannot read the app's current
 * language can still find their own in the picker. Each option is therefore
 * shown in its own language on purpose.
 */
export const LANGUAGE_OPTIONS: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
];

/**
 * The endonym, for prose that has to name a language: the picker's "System"
 * row and the confirmation after a change. An endonym rather than a
 * translation, so it is readable whichever language the sentence is in.
 */
export function languageEndonym(code: Language): string {
  return LANGUAGE_OPTIONS.find((option) => option.code === code)?.label ?? code;
}

/**
 * The catalogs are nested JSON because that is what a translator can read, but
 * messages are addressed by a flat dotted key. This maps the shape of the
 * English catalog onto that flat union so a typo like `t('ui.nav.hom')` is a
 * compile error rather than a blank button at runtime. English is the source of
 * truth; the other catalogs are checked against it in
 * tests/unit/i18n-catalogs.test.ts.
 */
type Dotted<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Dotted<T[K]>}`;
}[keyof T & string];

export type MessageKey = Dotted<typeof en>;
