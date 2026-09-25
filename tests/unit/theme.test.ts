import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyTheme,
  isTheme,
  loadTheme,
  preferredTheme,
  saveTheme,
  systemTheme,
  THEME_KEY,
  type Theme,
} from '../../src/services/theme';
import type { StoragePort } from '../../src/services/history';

const blocking: StoragePort = {
  getItem: () => {
    throw new DOMException('denied');
  },
  setItem: () => {
    throw new DOMException('quota exceeded');
  },
};

function setSystem(light: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: light && query.includes('light'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

beforeEach(() => {
  localStorage.clear();
  setSystem(false);
});

describe('theme preference', () => {
  it('recognises only the two supported themes', () => {
    expect(isTheme('light')).toBe(true);
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('sepia')).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });

  it('round trips a stored choice under a versioned key', () => {
    expect(saveTheme(localStorage, 'light')).toBe('');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    expect(loadTheme(localStorage)).toBe('light');
  });

  it('reports no choice when nothing valid is stored', () => {
    expect(loadTheme(localStorage)).toBeNull();
    localStorage.setItem(THEME_KEY, 'sepia');
    expect(loadTheme(localStorage)).toBeNull();
  });

  it('treats an unreadable store as no choice, not a failure', () => {
    expect(loadTheme(blocking)).toBeNull();
    expect(saveTheme(blocking, 'dark')).toBe(
      'This theme applies to this session only.',
    );
  });

  it('prefers the stored choice over the operating system', () => {
    setSystem(true);
    expect(systemTheme()).toBe('light');
    saveTheme(localStorage, 'dark');
    expect(preferredTheme(localStorage)).toBe('dark');
  });

  it('falls back to the operating system when no choice is stored', () => {
    expect(preferredTheme(localStorage)).toBe('dark');
    setSystem(true);
    expect(preferredTheme(localStorage)).toBe('light');
  });

  it('resolves the system theme from the colour-scheme query', () => {
    setSystem(true);
    expect(systemTheme()).toBe('light');
    setSystem(false);
    expect(systemTheme()).toBe('dark');
  });
});

describe('applying a theme', () => {
  it('sets data-theme on the document so it outlives a re-render', () => {
    for (const theme of ['light', 'dark'] as const) {
      applyTheme(document, theme);
      expect(document.documentElement.dataset.theme).toBe(theme);
    }
  });

  it('keeps the browser chrome in step with the theme', () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
    try {
      const expected: Record<Theme, string> = {
        dark: '#0d1117',
        light: '#f2f5f8',
      };
      for (const theme of ['light', 'dark'] as const) {
        applyTheme(document, theme);
        expect(meta.content).toBe(expected[theme]);
      }
    } finally {
      meta.remove();
    }
  });

  it('tolerates a page without a theme-color meta tag', () => {
    expect(document.querySelector('meta[name="theme-color"]')).toBeNull();
    expect(() => applyTheme(document, 'dark')).not.toThrow();
  });
});
