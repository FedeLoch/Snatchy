import type { StoragePort } from './history';
export const THEME_KEY = 'snatchy-theme-v1';
export type Theme = 'light' | 'dark';
/** `theme-color` values must match the palette in style.css. */
const CHROME: Record<Theme, string> = {
  dark: '#0d1117',
  light: '#f2f5f8',
};
export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}
/**
 * Returns the stored choice, or null when the visitor has never picked one. An
 * unreadable store is treated as no choice rather than an error: the theme is
 * cosmetic, so a blocked localStorage must not surface a warning.
 */
export function loadTheme(storage: StoragePort): Theme | null {
  try {
    const raw = storage.getItem(THEME_KEY);
    return isTheme(raw) ? raw : null;
  } catch {
    return null;
  }
}
export function saveTheme(storage: StoragePort, theme: Theme): string {
  try {
    storage.setItem(THEME_KEY, theme);
    return '';
  } catch {
    return 'This theme applies to this session only.';
  }
}
export function systemTheme(): Theme {
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
/** An explicit choice wins; otherwise follow the operating system. */
export function preferredTheme(storage: StoragePort): Theme {
  return loadTheme(storage) ?? systemTheme();
}
/**
 * Theme state lives on <html>, not inside #app, so it survives the full
 * innerHTML re-render that every route performs.
 */
export function applyTheme(doc: Document, theme: Theme): void {
  doc.documentElement.dataset.theme = theme;
  const meta = doc.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = CHROME[theme];
}
