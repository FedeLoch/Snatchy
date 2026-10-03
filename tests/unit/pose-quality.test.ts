import { expect, it } from 'vitest';
import {
  reliablePoseFrames,
  reliableSide,
  sustainedMinimum,
} from '../../src/domain/pose-quality';
import { analyzePoseSamples } from '../../src/domain/vision';
import { liftFrames } from '../fixtures/lift-pose';
import {
  loadVisionHistory,
  saveVisionHistory,
} from '../../src/services/vision-history';

it('excludes an isolated geometric spike, preserves raw samples, and is repeatable', () => {
  const frames = liftFrames();
  for (const id of [13, 14])
    frames[1].landmarks[id] = {
      ...frames[1].landmarks[id],
      x: frames[1].landmarks[id].x - 0.28,
    };
  const original = structuredClone(frames);
  const filtered = reliablePoseFrames(frames, 1000, 1000, 15);
  expect(frames).toEqual(original);
  expect(filtered[1].landmarks[13].visibility).toBe(0);
  expect(filtered[1].rawLandmarks).toEqual(original[1].landmarks);
  expect(reliablePoseFrames(filtered, 1000, 1000, 15)).toEqual(filtered);
  // The known brief extension peak must not be erased merely for being fast.
  expect(filtered[12].landmarks).toEqual(original[12].landmarks);
});
it('does not interpolate occlusions or use another person as a temporal neighbor', () => {
  const frames = liftFrames();
  frames[4] = { ...frames[4], people: 2 };
  frames[5].landmarks[13] = {
    ...frames[5].landmarks[13],
    x: frames[5].landmarks[13].x - 0.28,
  };
  const filtered = reliablePoseFrames(frames, 1000, 1000, 15);
  expect(filtered[5].landmarks[13]).toEqual(frames[5].landmarks[13]);
  frames[5] = { ...frames[5], people: 0, landmarks: [] };
  expect(reliablePoseFrames(frames, 1000, 1000, 15)[5].landmarks).toEqual([]);
});
it('prefers complete visible joint chains over a higher sum on incomplete chains', () => {
  const frames = liftFrames();
  for (const f of frames) {
    f.landmarks[11] = { ...f.landmarks[11], visibility: 0.64 };
    for (const i of [12, 14, 16, 24, 26, 28])
      f.landmarks[i] = { ...f.landmarks[i], visibility: 0.8 };
  }
  expect(reliableSide(frames, 100, 100)).toBe('right');
});
it('ignores one-frame bending but keeps persistent bending and original sample timestamps', () => {
  const once = liftFrames(),
    sustained = liftFrames();
  for (const id of [13, 14])
    once[5].landmarks[id] = {
      ...once[5].landmarks[id],
      x: once[5].landmarks[id].x + 0.1,
    };
  for (const i of [5, 6, 7])
    for (const id of [13, 14])
      sustained[i].landmarks[id] = {
        ...sustained[i].landmarks[id],
        x: sustained[i].landmarks[id].x + 0.1,
      };
  const a = analyzePoseSamples(once, 100, 100, 2),
    b = analyzePoseSamples(sustained, 100, 100, 2);
  expect(
    a.lift!.checks.find((c) => c.name === 'Arms through the pull')!.passed,
  ).toBe(true);
  const failed = b.lift!.checks.find(
    (c) => c.name === 'Arms through the pull',
  )!;
  expect(failed.passed).toBe(false);
  expect(sustained.some((f) => f.time === failed.time)).toBe(true);
  expect(
    sustainedMinimum(
      [
        { time: 0, v: 180 },
        { time: 1, v: 100 },
        { time: 2, v: 180 },
      ],
      (r) => r.v,
      15,
    ),
  ).toBeNull();
});
it('does not persist raw or filtered full-body frames in saved summaries', () => {
  const analysis = analyzePoseSamples(liftFrames(), 100, 100, 2);
  expect(analysis.frames[0].rawLandmarks).toBeDefined();
  saveVisionHistory(localStorage, [{ id: 'quality', createdAt: 1, analysis }]);
  expect(loadVisionHistory(localStorage)[0].analysis.frames).toEqual([]);
  expect(localStorage.getItem('snatchy-vision-history-v1')).not.toContain(
    'rawLandmarks',
  );
});
