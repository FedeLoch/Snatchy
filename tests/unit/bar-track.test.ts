import { it, expect } from 'vitest';
import {
  grayscale,
  createTemplate,
  matchTemplate,
  barMetrics,
  type GrayFrame,
  type BarTrack,
} from '../../src/domain/bar-track';
function frame(dx = 0, dy = 0): GrayFrame {
  const pixels = new Float32Array(100 * 100);
  for (let y = 30; y <= 50; y++)
    for (let x = 30; x <= 50; x++)
      pixels[(y + dy) * 100 + x + dx] = ((x * 31 + y * 17) % 101) / 100;
  return { width: 100, height: 100, pixels };
}
it('follows actual textured pixels and rejects blanks or ambiguous copies', () => {
  const template = createTemplate(frame(), 40, 40, 10);
  const match = matchTemplate(frame(8, -6), template, 40, 40, 10, 20);
  expect(match?.x).toBe(48);
  expect(match?.y).toBe(34);
  expect(match?.confidence).toBeCloseTo(1);
  expect(
    matchTemplate(
      { width: 100, height: 100, pixels: new Float32Array(10000) },
      template,
      40,
      40,
      10,
    ),
  ).toBeNull();
  const duplicate = frame(25, 0),
    original = frame();
  duplicate.pixels = duplicate.pixels.map((v, i) => v + original.pixels[i]);
  expect(matchTemplate(duplicate, template, 40, 40, 10)).toBeNull();
  expect(() => createTemplate(frame(), 0, 0, 10)).toThrow();
});
it('converts color frames to grayscale', () => {
  expect(
    grayscale(new Uint8ClampedArray([255, 0, 0, 255]), 1, 1).pixels[0],
  ).toBeCloseTo(0.299);
});
const track: BarTrack = {
  version: 1,
  method: 'seeded-template',
  width: 100,
  height: 100,
  metersPerPixel: 0.01,
  diameterCm: 45,
  start: 0,
  end: 0.2,
  requestedEnd: 0.2,
  reviewed: true,
  stoppedEarly: false,
  points: [
    { time: 0, x: 40, y: 80, confidence: 1 },
    { time: 0.1, x: 42, y: 70, confidence: 1 },
    { time: 0.2, x: 41, y: 60, confidence: 1 },
  ],
};
it('calculates calibrated displacement and sampled upward velocity only after review', () => {
  expect(barMetrics(track)).toEqual({
    horizontalCm: 2,
    verticalM: 0.2,
    peakVelocity: 1,
  });
  expect(barMetrics({ ...track, reviewed: false })).toBeNull();
  expect(barMetrics({ ...track, points: [] })).toBeNull();
  expect(barMetrics({ ...track, metersPerPixel: NaN })).toBeNull();
  expect(
    barMetrics({
      ...track,
      points: track.points.map((p) => ({ ...p, time: p.time * 5 })),
    })?.peakVelocity,
  ).toBeNull();
});
