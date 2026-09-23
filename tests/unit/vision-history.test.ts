import { beforeEach, expect, it } from 'vitest';
import { analyzePoseSamples, type VisionRecord } from '../../src/domain/vision';
import {
  isVisionRecord,
  loadVisionHistory,
  saveVisionHistory,
  VISION_HISTORY_KEY,
} from '../../src/services/vision-history';
const record = (): VisionRecord => ({
  id: 'measured-1',
  createdAt: 1234,
  analysis: analyzePoseSamples(
    [{ time: 0, people: 0, landmarks: [] }],
    640,
    480,
    1,
  ),
});
beforeEach(() => localStorage.clear());
it('saves measured summaries without frames, video bytes, filenames or URLs', () => {
  expect(saveVisionHistory(localStorage, [record()])).toBe('');
  const loaded = loadVisionHistory(localStorage);
  expect(loaded).toHaveLength(1);
  expect(loaded[0].analysis.frames).toEqual([]);
  expect(loaded[0].analysis.simulated).toBe(false);
  expect(localStorage.getItem(VISION_HISTORY_KEY)).not.toContain('blob:');
});
it('bounds history and survives inaccessible, malformed and absent storage', () => {
  expect(loadVisionHistory(localStorage)).toEqual([]);
  saveVisionHistory(
    localStorage,
    Array.from({ length: 20 }, (_, i) => ({ ...record(), id: 'id-' + i })),
  );
  expect(loadVisionHistory(localStorage)).toHaveLength(10);
  for (const value of ['broken', 'null', '{}']) {
    localStorage.setItem(VISION_HISTORY_KEY, value);
    expect(loadVisionHistory(localStorage)).toEqual([]);
  }
  const denied = {
    getItem() {
      throw Error();
    },
    setItem() {
      throw Error();
    },
  };
  expect(loadVisionHistory(denied)).toEqual([]);
  expect(saveVisionHistory(denied, [record()])).toContain('could not be saved');
});
it('validates result identity, ranges, timestamps and events', () => {
  const r = record();
  expect(isVisionRecord(r)).toBe(true);
  for (const invalid of [
    null,
    {},
    { ...r, id: '<svg>' },
    { ...r, createdAt: NaN },
    { ...r, analysis: null },
    { ...r, analysis: { ...r.analysis, kind: 'demo' } },
    { ...r, analysis: { ...r.analysis, coverage: 2 } },
    {
      ...r,
      analysis: {
        ...r.analysis,
        ranges: {
          elbow: { min: -1, max: 200, minTime: 0, maxTime: 0 },
          hip: null,
          knee: null,
        },
      },
    },
    {
      ...r,
      analysis: {
        ...r.analysis,
        events: [
          { id: 'bad!', time: 2, title: 'x', detail: 'x', kind: 'measurement' },
        ],
      },
    },
  ])
    expect(isVisionRecord(invalid)).toBe(false);
  const withRange = {
    ...r,
    analysis: {
      ...r.analysis,
      ranges: {
        elbow: { min: 100, max: 160, minTime: 0, maxTime: 0.5 },
        hip: null,
        knee: null,
      },
      events: [
        {
          id: 'test',
          time: 0.5,
          title: 'x',
          detail: 'x',
          kind: 'measurement' as const,
        },
      ],
    },
  };
  expect(isVisionRecord(withRange)).toBe(true);
});
