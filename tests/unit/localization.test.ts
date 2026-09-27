import { afterEach, describe, expect, it } from 'vitest';
import { analyzePoseSamples } from '../../src/domain/vision';
import type { StoragePort } from '../../src/services/history';
import {
  applyLanguage,
  isLanguage,
  LANGUAGE_KEY,
  loadLanguage,
  preferredLanguage,
  saveLanguage,
  systemLanguage,
} from '../../src/services/language';
import { detectSystemLanguage, setLang, source, t, td } from '../../src/i18n';
import { settings } from '../../src/ui/settings';
import { shell } from '../../src/ui/views';
import { visionRows } from '../../src/ui/vision';
import {
  checkName,
  demoMeasurement,
  demoMetric,
  demoSummary,
  demoVerdict,
  drillName,
  eventDetail,
  issueName,
  movementName,
  phaseName,
  sideName,
} from '../../src/ui/labels';
import { liftFrames } from '../fixtures/lift-pose';

const store = (value: string | null): StoragePort => ({
  getItem: () => value,
  setItem: () => {
    throw new Error('denied');
  },
});

function withSystemLocales(locales: string[], run: () => void): void {
  const nav = globalThis.navigator;
  const saved = Object.getOwnPropertyDescriptors(nav);
  for (const [key, value] of [
    ['languages', locales],
    ['language', locales[0] ?? ''],
  ] as const) {
    Object.defineProperty(nav, key, { value, configurable: true });
  }
  try {
    run();
  } finally {
    for (const key of ['languages', 'language'])
      if (saved[key]) Object.defineProperty(nav, key, saved[key]);
  }
}

afterEach(() => setLang('en'));

describe('language selection', () => {
  it('round-trips an explicit choice and rejects anything else', () => {
    expect(isLanguage('fr')).toBe(true);
    expect(isLanguage('de')).toBe(false);
    expect(isLanguage(null)).toBe(false);
    expect(LANGUAGE_KEY).toBe('snatchy-language-v1');
  });

  it('treats an unreadable store as no choice, not a failure', () => {
    const denied: StoragePort = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadLanguage(denied)).toBeNull();
    expect(saveLanguage(denied, 'es')).toBe('settings.languageSessionOnly');
  });

  it('prefers the stored choice over the system locale', () => {
    withSystemLocales(['fr-CA'], () => {
      expect(detectSystemLanguage()).toBe('fr');
      expect(systemLanguage()).toBe('fr');
      expect(preferredLanguage(store('es'))).toBe('es');
      expect(preferredLanguage(store('klingon'))).toBe('fr');
      expect(preferredLanguage(store(null))).toBe('fr');
    });
  });

  it('falls back to the base language for unsupported locales', () => {
    withSystemLocales(['de-AT', 'ja-JP'], () => {
      expect(detectSystemLanguage()).toBe('en');
    });
  });

  it('puts the language on the document so assistive tech can read it', () => {
    applyLanguage(document, 'es');
    expect(document.documentElement.lang).toBe('es');
    applyLanguage(document, 'en');
  });
});

describe('lookup runtime', () => {
  it('interpolates and leaves an unused placeholder visible', () => {
    setLang('en');
    expect(t('settings.version', { version: '1.2.3' })).toBe('Version 1.2.3');
    expect(t('settings.version')).toBe('Version {version}');
  });

  it('translates keys read from data and passes prose through', () => {
    setLang('es');
    expect(td('errors.media.empty')).toBe(
      'Este vídeo está vacío. Elige otra grabación.',
    );
    expect(td('Some saved text')).toBe('Some saved text');
    expect(t('errors.media.empty')).toBe(
      'Este vídeo está vacío. Elige otra grabación.',
    );
  });

  it('stores analysis prose in the base language whatever the device locale', () => {
    setLang('fr');
    expect(source('verdicts.strong')).toBe('Strong lift');
    expect(source('phaseEvidence.turnover')).toBe(
      'Largest combined hip/knee extension before the receiving position.',
    );
    expect(t('verdicts.strong')).toBe('Mouvement maîtrisé');
  });
});

describe('persisted labels', () => {
  it('re-renders stored English names in the active language', () => {
    setLang('fr');
    expect(phaseName('First pull')).toBe('Première traction');
    expect(checkName('Hip extension')).toBe('Extension de hanche');
    expect(movementName('clean')).toBe('Épaulé');
    expect(movementName('not-a-movement', 'Fallback')).toBe('Fallback');
    expect(drillName('snatch-pull', 'Snatch Pull')).toBe('Traction balancée');
    expect(issueName('drift', 'Forward bar drift')).toBe(
      "Dérive de la barre vers l'avant",
    );
    expect(sideName('left')).toBe('gauche');
    expect(demoVerdict('Good lift')).toBe('verdicts.good');
    expect(demoSummary('A strong foundation. Let’s refine the details.')).toBe(
      'Une base solide. Affinons les détails.',
    );
    expect(demoMetric('Peak velocity')).toBe('Vitesse maximale');
    expect(demoMetric('Unknown label')).toBe('Unknown label');
    expect(demoMeasurement('6.4 cm horizontal displacement')).toBe(
      '6,4 cm de déplacement horizontal',
    );
  });

  it('rebuilds an event sentence from the measured numbers', () => {
    setLang('es');
    expect(eventDetail('extension', 'fallback', [153])).toBe(
      'Ángulo de cadera proyectado 153°. Este es un ángulo medido en el plano de la imagen, no una prueba de extensión completa.',
    );
    // An overhead event has no numbers, so it must translate without any.
    expect(eventDetail('overhead', 'fallback', [])).not.toBe('fallback');
    // A record saved before this build keeps its own English sentence.
    expect(eventDetail('extension', 'stored English', [])).toBe(
      'stored English',
    );
    expect(eventDetail('unknown-id', 'stored English', [1])).toBe(
      'stored English',
    );
  });
});

describe('localized rendering', () => {
  it('renders a history row and its score label in Spanish', () => {
    const analysis = analyzePoseSamples(liftFrames(), 100, 100, 2);
    setLang('es');
    const row = visionRows([
      { id: 'v1', createdAt: Date.UTC(2026, 0, 2, 15, 4), analysis },
    ]);
    expect(row).toContain('Pose con seguimiento');
    expect(row).toContain('aria-label="100 sobre 100"');
    expect(row).toContain('2 ene');
    expect(row).not.toContain('{score}');
    expect(row).not.toContain('Pose tracked');
  });

  it('labels the settings picker in every offered language', () => {
    setLang('fr');
    const html = settings(null, 'es');
    expect(html).toContain('Español');
    expect(html).toContain('Français');
    expect(html).toContain('Système (Español)');
    expect(html).toContain('Préférences');
    expect(html).toContain('value="system" selected');
    expect(settings('fr', 'en')).toContain('value="fr" selected');
  });
});

describe('shell navigation', () => {
  const navOf = (html: string) => html.match(/<nav[\s\S]*?<\/nav>/)![0];
  const currentTab = (html: string) =>
    navOf(html).match(/href="#\w+" aria-current="page"/)?.[0];

  it('gives the bottom bar a class the stylesheet can rely on in any language', () => {
    for (const lang of ['en', 'es', 'fr'] as const) {
      setLang(lang);
      const nav = navOf(shell('<p>content</p>', 'home', 'dark'));
      // The class positions the bar; the aria-label is for screen readers and
      // follows the language. Selecting on the label instead silently un-pinned
      // the bar as soon as the visitor switched away from English.
      expect(nav.startsWith('<nav class="app-nav"')).toBe(true);
      expect(nav).toContain('aria-label="');
      if (lang !== 'en') expect(nav).not.toContain('Main navigation');
    }
  });

  it('lists four tabs with settings last, and no settings button in the header', () => {
    setLang('en');
    const html = shell('<p>content</p>', 'home', 'dark');
    expect(
      [...navOf(html).matchAll(/<a href="#(\w+)"/g)].map((match) => match[1]),
    ).toEqual(['home', 'capture', 'history', 'settings']);
    expect(html.match(/<header[\s\S]*?<\/header>/)![0]).not.toContain(
      '#settings',
    );
  });

  it('marks exactly one tab current, and a result belongs to the analyze tab', () => {
    setLang('en');
    expect(currentTab(shell('', 'home', 'dark'))).toBe(
      'href="#home" aria-current="page"',
    );
    expect(currentTab(shell('', 'capture', 'dark'))).toBe(
      'href="#capture" aria-current="page"',
    );
    expect(currentTab(shell('', 'history', 'dark'))).toBe(
      'href="#history" aria-current="page"',
    );
    expect(currentTab(shell('', 'settings', 'dark'))).toBe(
      'href="#settings" aria-current="page"',
    );
    expect(currentTab(shell('', 'result', 'dark'))).toBe(
      'href="#capture" aria-current="page"',
    );
    for (const page of [
      'home',
      'capture',
      'history',
      'settings',
      'result',
    ] as const)
      expect(
        navOf(shell('', page, 'dark')).match(/aria-current/g),
      ).toHaveLength(1);
  });
});
