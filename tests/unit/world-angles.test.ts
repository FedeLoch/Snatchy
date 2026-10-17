import { expect, it } from 'vitest';
import {
  anglesAt,
  measuredAngle,
  worldAngle,
  type Landmark,
  type PoseSample,
  type WorldPoint,
} from '../../src/domain/vision';

const flat = (points: [number, number][]): Landmark[] =>
  points.map(([x, y]) => ({ x, y, visibility: 0.9 }));

it('measures a right angle in 3D', () => {
  expect(
    worldAngle(
      { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
    ),
  ).toBeCloseTo(90);
});

it('keeps the 2D angle for limbs near the image plane', () => {
  const landmarks = flat([
    [0.5, 0.3],
    [0.5, 0.5],
    [0.7, 0.5],
  ]);
  const world: WorldPoint[] = [
    { x: 0, y: -0.2, z: 0.02 },
    { x: 0, y: 0, z: 0 },
    // A noisy depth estimate must not override a side-on measurement.
    { x: 0.2, y: 0, z: 0.05 },
  ];
  const frame: PoseSample = { time: 0, people: 1, landmarks, world };
  expect(measuredAngle(frame, [0, 1, 2], 1000, 1000)).toBeCloseTo(90);
});

it('uses the 3D angle when a limb points at the camera', () => {
  // Front view of a deep squat: the thigh points toward the camera, so the
  // projected knee looks almost straight while the real knee is bent.
  const landmarks = flat([
    [0.5, 0.48],
    [0.5, 0.5],
    [0.5, 0.7],
  ]);
  const world: WorldPoint[] = [
    { x: 0, y: -0.02, z: 0.4 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0.4, z: 0 },
  ];
  const frame: PoseSample = { time: 0, people: 1, landmarks, world };
  expect(measuredAngle(frame, [0, 1, 2], 1000, 1000)! < 100).toBe(true);
  // Without depth the projected value remains the measurement.
  expect(
    measuredAngle({ ...frame, world: undefined }, [0, 1, 2], 1000, 1000),
  ).toBeCloseTo(180);
  // Visibility still gates the 3D path.
  landmarks[0].visibility = 0.1;
  expect(measuredAngle(frame, [0, 1, 2], 1000, 1000)).toBeNull();
});

it('applies to every analysed joint', () => {
  const landmarks = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0.9,
  }));
  const frame: PoseSample = { time: 0, people: 1, landmarks };
  expect(anglesAt(frame, 'left', 1000, 1000)).toEqual({
    elbow: null,
    hip: null,
    knee: null,
  });
});
