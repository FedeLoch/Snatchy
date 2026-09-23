import { expect, it } from 'vitest';
import {
  AutomaticBarTracker,
  detectPlate,
  relativeBarMetrics,
} from '../../src/domain/automatic-bar';
import type { GrayFrame } from '../../src/domain/bar-track';
import type { PoseSample } from '../../src/domain/vision';
function frame(y = 68, duplicate = false): GrayFrame {
  const width = 120,
    height = 100,
    pixels = new Float32Array(width * height);
  for (let py = 0; py < height; py++)
    for (let x = 0; x < width; x++) {
      if (
        Math.hypot(x - 59, py - y) <= 12 ||
        (duplicate && Math.hypot(x - 80, py - y) <= 10)
      )
        pixels[py * width + x] =
          0.65 + ((x * 17 + (py - y) * 31 + 9000) % 30) / 100;
    }
  return { width, height, pixels };
}
function pose(time = 0, y = 68): PoseSample {
  return {
    time,
    people: 1,
    landmarks: Array.from({ length: 33 }, () => ({
      x: 59 / 120,
      y: y / 100,
      visibility: 1,
    })),
  };
}
it('finds a circular plate candidate near visible hands, rejects blank and missing evidence', () => {
  expect(detectPlate(frame(), pose())?.x).toBeCloseTo(59, 0);
  expect(
    detectPlate({ ...frame(), pixels: new Float32Array(12000) }, pose()),
  ).toBeNull();
  expect(detectPlate(frame(), { ...pose(), people: 2 })).toBeNull();
  expect(detectPlate(frame(), { ...pose(), landmarks: [] })).toBeNull();
  expect(
    detectPlate(frame(), {
      ...pose(),
      landmarks: pose().landmarks.map((p) => ({ ...p, y: 0 })),
    }),
  ).toBeNull();
});
it('tracks actual moving plate pixels automatically and exposes frame-relative units', () => {
  const tracker = new AutomaticBarTracker();
  for (let i = 0; i < 10; i++)
    tracker.push(frame(68 - i * 2), pose(i / 15, 68 - i * 2));
  const result = tracker.result()!;
  expect(result.points).toHaveLength(10);
  expect(relativeBarMetrics(result).rise).toBeCloseTo(18);
  expect(relativeBarMetrics(result).horizontal).toBeCloseTo(0);
  tracker.push({ ...frame(), pixels: new Float32Array(12000) }, pose(10 / 15));
  tracker.push(frame(46), pose(11 / 15));
  expect(tracker.result()!.stoppedEarly).toBe(true);
  expect(tracker.result()!.points).toHaveLength(10);
});
it('withholds static objects, short tracks, and discontinuous tracks', () => {
  const tracker = new AutomaticBarTracker();
  expect(tracker.result()).toBeUndefined();
  for (let i = 0; i < 10; i++) tracker.push(frame(), pose(i / 15));
  expect(tracker.result()).toBeUndefined();
  const gap = new AutomaticBarTracker();
  gap.push(frame(), pose());
  gap.push(frame(66), pose(1, 66));
  expect(gap.result()).toBeUndefined();
});
