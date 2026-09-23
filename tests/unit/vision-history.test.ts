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

it('persists phase evidence and rejects corrupted optional measurements', async () => {
  const { liftFrames } = await import('../fixtures/lift-pose');
  const r = {
    ...record(),
    analysis: analyzePoseSamples(liftFrames(), 100, 100, 2),
  };
  expect(isVisionRecord(r)).toBe(true);
  saveVisionHistory(localStorage, [r]);
  expect(loadVisionHistory(localStorage)[0].analysis.lift?.score).toBe(100);
  const corrupt = (edit: (value: typeof r) => void) => {
    const value = structuredClone(r);
    edit(value);
    expect(isVisionRecord(value)).toBe(false);
  };
  corrupt((v) => {
    v.analysis.lift!.score = 83;
  });
  corrupt((v) => {
    v.analysis.lift!.phases[1].start = -1;
  });
  corrupt((v) => {
    v.analysis.lift!.phases[1].end = 99;
  });
  corrupt((v) => {
    v.analysis.lift!.phases[1].coverage = 2;
  });
  corrupt((v) => {
    v.analysis.lift!.phases.pop();
  });
  corrupt((v) => {
    v.analysis.lift!.checks[0].value = NaN;
  });
  corrupt((v) => {
    v.analysis.lift!.checks.pop();
  });
  corrupt((v) => {
    v.analysis.lift!.phases[1].start = null;
    v.analysis.lift!.phases[1].end = null;
  });
  r.analysis.bar = {
    version: 1,
    method: 'seeded-template',
    width: 100,
    height: 100,
    metersPerPixel: 0.01,
    diameterCm: 45,
    start: 0,
    end: 0.2,
    requestedEnd: 0.3,
    reviewed: true,
    stoppedEarly: true,
    points: [
      { time: 0, x: 50, y: 50, confidence: 1 },
      { time: 0.1, x: 50, y: 40, confidence: 1 },
      { time: 0.2, x: 50, y: 30, confidence: 1 },
    ],
  };
  expect(isVisionRecord(r)).toBe(true);
  corrupt((v) => {
    v.analysis.bar!.reviewed = false;
  });
  corrupt((v) => {
    v.analysis.bar!.points[1].time = 0;
  });
  corrupt((v) => {
    v.analysis.bar!.points[1].x = 200;
  });
  corrupt((v) => {
    v.analysis.bar!.end = 0.25;
  });
});
