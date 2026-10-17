import { expect, it } from 'vitest';
import {
  decodePose,
  encodePose,
  loadPose,
  savePose,
} from '../../src/services/pose-store';
import { liftFrames } from '../fixtures/lift-pose';

it('round-trips body, hands, 3D and bar detections through compact arrays', () => {
  const frames = liftFrames().slice(0, 3);
  frames[0].world = frames[0].landmarks.map((p) => ({
    x: p.x,
    y: p.y,
    z: 0.25,
  }));
  frames[1].hands = {
    left: Array.from({ length: 21 }, (_, i) => ({
      x: i / 40,
      y: 0.5,
      visibility: 0.9,
    })),
  };
  frames[2].barShaft = {
    time: frames[2].time,
    left: { x: 0.2, y: 0.6 },
    right: { x: 0.8, y: 0.62 },
    x: 0.5,
    y: 0.61,
  };
  frames[2].rawLandmarks = frames[2].landmarks.map((p) => ({
    ...p,
    x: p.x + 0.01,
  }));
  const decoded = decodePose(encodePose(frames));
  expect(decoded).toHaveLength(3);
  expect(decoded[0].landmarks[11].x).toBeCloseTo(frames[0].landmarks[11].x, 5);
  expect(decoded[0].world![11].z).toBeCloseTo(0.25, 5);
  expect(decoded[1].hands!.left).toHaveLength(21);
  expect(decoded[1].hands!.right).toBeUndefined();
  expect(decoded[2].barShaft!.right.y).toBeCloseTo(0.62, 5);
  // Unfiltered input is stored so reanalysis repeats the same filtering.
  expect(decoded[2].landmarks[11].x).toBeCloseTo(
    frames[2].rawLandmarks[11].x,
    5,
  );
});

it('degrades quietly where IndexedDB is unavailable', async () => {
  expect(await savePose('x', liftFrames())).toBe(false);
  expect(await loadPose('x')).toBeNull();
});
