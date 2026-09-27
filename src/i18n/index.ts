import {
  BASE_LANGUAGE,
  catalogs,
  LANGUAGE_OPTIONS,
  type Language,
  type MessageKey,
} from './catalogs';

type Catalog = Record<string, string>;

/**
 * Flatten a nested catalog into the dotted keys that `t()` addresses. A group
 * is only a readability device in the JSON, so it collapses away here.
 */
function flatten(source: unknown, prefix = ''): Catalog {
  const out: Catalog = {};
  if (!source || typeof source !== 'object') return out;
  for (const [name, value] of Object.entries(source)) {
    const key = prefix ? `${prefix}.${name}` : name;
    if (typeof value === 'string') out[key] = value;
    else Object.assign(out, flatten(value, key));
  }
  return out;
}

/** Look a language up by its base subtag, so `es-MX` resolves to `es`. */
function byBaseSubtag(tag: string): Language | null {
  const base = tag.trim().toLowerCase().split(/[-_]/)[0];
  const match = LANGUAGE_OPTIONS.find((o) => o.code === base);
  return match?.code ?? null;
}

/**
 * Flattened once at module load. Doing it per lookup would walk a 300-key
 * object on every one of the hundreds of `t()` calls a single render makes.
 */
const tables: Record<Language, Catalog> = {
  en: flatten(catalogs.en),
  es: flatten(catalogs.es),
  fr: flatten(catalogs.fr),
};

let current: Language = BASE_LANGUAGE;

export function setLang(language: Language): void {
  current = language;
}

export function getLang(): Language {
  return current;
}

/** The BCP 47 tag written to `<html lang>`; also drives Intl formatting. */
export function localeTag(): string {
  return current;
}

/**
 * The visitor's system locale, or the base language when it is unsupported or
 * undetectable. `navigator.languages` is checked before `navigator.language`
 * because the latter is only the first entry, and `Intl` is the last resort:
 * a browser that hides both still reports a resolved locale.
 */
export function detectSystemLanguage(): Language {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  const candidates = [
    ...(nav?.languages ?? []),
    ...(nav?.language ? [nav.language] : []),
    Intl.DateTimeFormat().resolvedOptions().locale,
  ];
  for (const tag of candidates) {
    const hit = byBaseSubtag(tag ?? '');
    if (hit) return hit;
  }
  return BASE_LANGUAGE;
}

export function interpolate(
  text: string,
  replacements: Record<string, string | number> = {},
): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = replacements[name];
    // An unused placeholder is left visible rather than blanked, so a missing
    // argument is obvious in review instead of silently reading "at  s".
    return value === undefined ? match : String(value);
  });
}

function lookup(key: string): string | undefined {
  return tables[current][key] ?? tables[BASE_LANGUAGE][key];
}

/**
 * Translate a dotted key, interpolating `{name}` placeholders. Falls back to the
 * English catalog and finally to the key itself, so a missing translation
 * renders a readable key instead of throwing.
 */
export function t(
  key: MessageKey,
  replacements?: Record<string, string | number>,
): string {
  const text = lookup(key);
  return text === undefined ? key : interpolate(text, replacements);
}

/** `t` for keys read from data, where the value is only known to be a string. */
export function td(
  key: string,
  replacements?: Record<string, string | number>,
): string {
  const text = lookup(key);
  return text === undefined ? key : interpolate(text, replacements);
}

/**
 * The English catalog string, ignoring the active language.
 *
 * Analysis output is written to disk, so it has to be stored in the base
 * language regardless of the device's locale: a record produced on a Spanish
 * phone must stay readable when it is reopened in French, and the saved
 * validation rules in `services/vision-history.ts` compare against English.
 * `t()` is for display, this is for anything that gets persisted. Callers that
 * persist a key alongside the text re-translate it at render time.
 */
export function source(
  key: string,
  replacements?: Record<string, string | number>,
): string {
  const text = tables[BASE_LANGUAGE][key];
  return text === undefined ? key : interpolate(text, replacements);
}

/**
 * Numbers follow the active language, so French reads `1,24 m/s`. Only call
 * this for values a person reads: SVG path coordinates must stay raw, or the
 * shape the browser cannot parse silently stops drawing.
 *
 * Omit `decimals` to keep a value's own precision, which is what the demo's
 * hand-tuned metrics want (`6.4 cm` should not become `6.40 cm`).
 */
export function formatNumber(
  value: number,
  decimals?: number,
  options: { percent?: boolean } = {},
): string {
  return new Intl.NumberFormat(current, {
    ...(decimals === undefined
      ? { maximumFractionDigits: 3 }
      : { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
    ...(options.percent ? { style: 'percent' } : {}),
  }).format(options.percent ? value / 100 : value);
}

/**
 * A measurement unit, spaced the way the active language writes it. French
 * needs a narrow no-break space before `%` so a value and its unit cannot be
 * split across a line, but no space before `°`, which ISO 80000-1 keeps tight.
 */
const UNIT_SPACE: Record<string, string> = {
  en: ' ',
  es: ' ',
  // U+202F narrow no-break space. Written as an escape so it stays visible in
  // review instead of being an invisible character in the source.
  fr: '\u202F',
};

export function formatUnit(value: string, unit: string): string {
  return `${value}${UNIT_SPACE[current] ?? UNIT_SPACE.en}${unit}`;
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(current, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
