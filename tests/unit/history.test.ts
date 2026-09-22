import { beforeEach, describe, expect, it } from 'vitest';
import {
  addRecord,
  HISTORY_KEY,
  loadHistory,
  MAX_HISTORY,
  saveHistory,
} from '../../src/services/history';
import { snatchDemo } from '../../src/data/snatch';
import type { LiftRecord } from '../../src/domain/types';
const record = (id = 'one', createdAt = 100): LiftRecord => ({
  id,
  createdAt,
  source: 'demo',
  analysis: structuredClone(snatchDemo),
});
beforeEach(() => localStorage.clear());
describe('persistent history', () => {
  it('round trips analysis snapshots without video URLs or filenames', () => {
    expect(saveHistory(localStorage, [record()])).toBe('');
    expect(loadHistory(localStorage).records).toEqual([record()]);
    expect(localStorage.getItem(HISTORY_KEY)).not.toContain('blob:');
  });
  it('handles an empty history', () =>
    expect(loadHistory(localStorage)).toEqual({ records: [], warning: '' }));
  it('migrates valid legacy entries and ignores invalid ones', () => {
    localStorage.setItem(
      'snatchy-history',
      JSON.stringify([{ id: 42 }, { id: 'no' }, null, { id: -1 }]),
    );
    expect(loadHistory(localStorage).records[0].id).toBe('legacy-42');
    expect(loadHistory(localStorage).records).toHaveLength(1);
  });
  it('handles non-array legacy data', () => {
    localStorage.setItem('snatchy-history', '{}');
    expect(loadHistory(localStorage).records).toEqual([]);
  });
  it.each(['broken', '{}', 'null'])('survives corrupt storage %s', (value) => {
    localStorage.setItem(HISTORY_KEY, value);
    expect(loadHistory(localStorage).records).toEqual([]);
    expect(loadHistory(localStorage).warning).not.toBe('');
  });
  it('salvages valid entries, removes duplicates, sorts and caps history', () => {
    const records = Array.from({ length: 40 }, (_, i) =>
      record('id-' + i, i + 1),
    );
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([...records, records[0], { id: 'invalid' }, null]),
    );
    const result = loadHistory(localStorage);
    expect(result.records).toHaveLength(MAX_HISTORY);
    expect(result.records[0].createdAt).toBe(40);
    expect(result.warning).not.toBe('');
  });
  it('rejects unsafe ids, invalid dates, unknown movements and sources', () => {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify([
        { ...record(), id: '<svg>' },
        { ...record(), createdAt: 1e20 },
        { ...record(), analysis: { ...snatchDemo, movementId: 'unknown' } },
        { ...record(), source: 'remote' },
      ]),
    );
    expect(loadHistory(localStorage).records).toEqual([]);
  });
  it('tolerates denied storage and full quota without losing session data', () => {
    const denied = {
      getItem() {
        throw Error('denied');
      },
      setItem() {
        throw Error('quota');
      },
    };
    expect(loadHistory(denied).warning).not.toBe('');
    expect(saveHistory(denied, [record()])).toContain('session');
  });
  it('caps writes and prepends records without duplicate ids', () => {
    const records = Array.from({ length: 35 }, (_, i) =>
      record('id-' + i, i + 1),
    );
    saveHistory(localStorage, records);
    expect(JSON.parse(localStorage.getItem(HISTORY_KEY)!)).toHaveLength(30);
    expect(addRecord(records, record('id-1', 99))[0].createdAt).toBe(99);
    expect(
      addRecord(records, record('id-1', 99)).filter((r) => r.id === 'id-1'),
    ).toHaveLength(1);
  });
});
