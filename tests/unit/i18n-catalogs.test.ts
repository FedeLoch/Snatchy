import { describe, expect, it } from 'vitest';
import { catalogs, LANGUAGE_OPTIONS } from '../../src/i18n/catalogs';

function flatten(source: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (!source || typeof source !== 'object') return out;
  for (const [name, value] of Object.entries(source)) {
    const key = prefix ? `${prefix}.${name}` : name;
    if (typeof value === 'string') out[key] = value;
    else Object.assign(out, flatten(value, key));
  }
  return out;
}

const en = flatten(catalogs.en);

/**
 * Values that are correct as English in every locale. Keeping the Olympic lift
 * names in English for Spanish is a product decision; the rest are the brand, a
 * person, or words French and Spanish spell the same way.
 */
const SHARED_KEYS = new Set([
  'app.brand',
  'app.volume',
  'settings.creator',
  'settings.version',
  'capture.eyebrow',
  'phases.transition',
  'repetitions.label',
  'result.issuesSection',
  'result.observationsCount',
  'result.phaseScoreAria',
  'result.phasesCount',
  'movements.snatch',
  'movements.power-snatch',
  'movements.clean',
  'movements.power-clean',
  'movements.muscle-clean',
  'movements.jerk',
  'movements.clean-and-jerk',
]);

describe('catalogs', () => {
  it('offers English, Spanish, and French', () => {
    expect(LANGUAGE_OPTIONS.map((o) => o.code)).toEqual(['en', 'es', 'fr']);
  });

  it('has a substantial English catalog', () => {
    // A floor, not an exact count: the number moves as copy is revised, but a
    // silently emptied catalog should fail here rather than ship.
    expect(Object.keys(en).length).toBeGreaterThan(400);
  });

  for (const { code } of LANGUAGE_OPTIONS) {
    describe(code, () => {
      const table = flatten(catalogs[code]);

      it('defines exactly the same keys as English', () => {
        const expected = Object.keys(en).sort();
        const actual = Object.keys(table).sort();
        expect(actual.filter((k) => !expected.includes(k))).toEqual([]);
        expect(expected.filter((k) => !actual.includes(k))).toEqual([]);
      });

      it('has no empty strings', () => {
        const empty = Object.entries(table)
          .filter(([, v]) => v.trim() === '')
          .map(([k]) => k);
        expect(empty).toEqual([]);
      });

      it('uses the same {placeholders} as English', () => {
        const mismatched: string[] = [];
        for (const [key, value] of Object.entries(table)) {
          const placeholders = (text: string) =>
            (text.match(/\{(\w+)\}/g) ?? []).sort();
          if (
            JSON.stringify(placeholders(value)) !==
            JSON.stringify(placeholders(en[key]))
          ) {
            mismatched.push(key);
          }
        }
        expect(mismatched).toEqual([]);
      });
    });
  }

  it('translates every string that is not intentionally shared', () => {
    // Some values must stay identical across languages: the brand, the volume
    // label, a person's name, and the Olympic lift names Spanish keeps in
    // English. Everything else differing by word is almost always a forgotten
    // translation, so this fails loudly instead of shipping English inside a
    // language picker.
    const report: string[] = [];
    for (const code of ['es', 'fr'] as const) {
      const table = flatten(catalogs[code]);
      const identical = Object.keys(table).filter(
        (k) => !SHARED_KEYS.has(k) && table[k] === en[k] && en[k].length > 3,
      );
      if (identical.length) report.push(`${code}: ${identical.join(', ')}`);
    }
    expect(report).toEqual([]);
  });
});
