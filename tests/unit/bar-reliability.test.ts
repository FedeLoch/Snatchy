import { expect, it } from 'vitest';
import {
  reliableBarPoints,
  type WristBarPoint,
} from '../../src/domain/wrist-bar';
const point = (i: number, x: number, y: number): WristBarPoint => ({
  time: i / 15,
  x,
  y,
  left: { x: x - 10, y },
  right: { x: x + 10, y },
});
it('excludes an isolated jump without inventing replacement coordinates', () => {
  const points = [point(0, 100, 300), point(1, 400, 290), point(2, 102, 280)];
  expect(reliableBarPoints(points, 640, 480, 15)).toEqual([
    points[0],
    points[2],
  ]);
  expect(points).toHaveLength(3);
});
it('preserves fast coherent motion and does not infer across tracking gaps', () => {
  const fast = [point(0, 100, 400), point(1, 100, 250), point(2, 100, 100)];
  expect(reliableBarPoints(fast, 640, 480, 15)).toEqual(fast);
  const gap = [point(0, 100, 300), point(5, 400, 290), point(6, 102, 280)];
  expect(reliableBarPoints(gap, 640, 480, 15)).toEqual(gap);
});
