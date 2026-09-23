import { expect, it } from 'vitest';
import { liftFrames } from '../fixtures/lift-pose';
import { analyzePoseSamples, type PoseSample } from '../../src/domain/vision';
import {
  analyzeRepetitions,
  detectRepetitions,
} from '../../src/domain/repetitions';
import {
  isVisionRecord,
  loadVisionHistory,
  saveVisionHistory,
} from '../../src/services/vision-history';
const analyze = (
  frames: PoseSample[],
  duration = frames.at(-1)!.time + 1 / 15,
) => analyzePoseSamples(frames, 1000, 1000, duration);
it('isolates two lifts from untracked lead-in, rest and lead-out without mixing scores', () => {
  const frames: PoseSample[] = Array.from({ length: 240 }, (_, i) => ({
    time: i / 15,
    people: 0,
    landmarks: [],
  }));
  for (const offset of [45, 150])
    liftFrames().forEach((f, i) => {
      frames[offset + i] = { ...f, time: (offset + i) / 15 };
    });
  const a = analyze(frames);
  expect(a.status).toBe('insufficient');
  const reps = analyzeRepetitions(a);
  expect(reps).toHaveLength(2);
  expect(reps.map((r) => r.lift?.score)).toEqual([100, 100]);
  expect(reps[0].interval!.start).toBeGreaterThan(2);
  expect(reps[0].interval!.end).toBeLessThan(6);
  expect(reps[1].lift!.phases[5].start).toBeCloseTo(11);
  a.repetitions = reps;
  const record = { id: 'reps', createdAt: 1234, analysis: a };
  expect(isVisionRecord(record)).toBe(true);
  saveVisionHistory(localStorage, [record]);
  const loaded = loadVisionHistory(localStorage)[0];
  expect(loaded.analysis.repetitions![1].lift!.score).toBe(100);
  expect(loaded.analysis.repetitions!.every((r) => r.frames.length === 0)).toBe(
    true,
  );
  expect(
    isVisionRecord({
      ...record,
      analysis: { ...a, repetitions: [{ ...reps[0], repetitions: [] }] },
    }),
  ).toBe(false);
});
it('does not classify static overhead, blank, or aborted pulls as complete repetitions', () => {
  expect(detectRepetitions(analyze(liftFrames().slice(0, 14)))).toEqual([]);
  expect(detectRepetitions(analyze(liftFrames().slice(15)))).toEqual([]);
  expect(
    detectRepetitions(analyze([{ time: 0, people: 0, landmarks: [] }])),
  ).toEqual([]);
});
it('keeps one candidate through a brief overhead visibility gap and closes at video end', () => {
  const frames = liftFrames();
  frames[20] = { ...frames[20], people: 0, landmarks: [] };
  expect(detectRepetitions(analyze(frames))).toHaveLength(1);
});

it('persists per-rep summaries in a landscape frame with original timestamps', () => {
  const frames: PoseSample[] = Array.from({ length: 60 }, (_, i) => ({
    time: i / 15,
    people: 0,
    landmarks: [],
  }));
  for (const offset of [0, 33])
    liftFrames().forEach((f, i) => {
      frames[offset + i] = { ...f, time: (offset + i) / 15 };
    });
  const a = analyzePoseSamples(frames, 320, 240, 4);
  a.repetitions = analyzeRepetitions(a);
  expect(a.repetitions).toHaveLength(2);
  expect(a.repetitions[1].lift?.phases[5].start).toBeCloseTo(3.2);
  expect(
    isVisionRecord({ id: 'landscape', createdAt: 1234, analysis: a }),
  ).toBe(true);
});
