import { expect, it, vi } from 'vitest';
import { coachingGroup, referenceVector } from '../../src/domain/coaching';
import { analyzePoseSamples, SIDES } from '../../src/domain/vision';
import { cleanFrames } from '../fixtures/clean-pose';
import { liftFrames } from '../fixtures/lift-pose';
import { loadFeatures, FEATURE_KEY } from '../../src/services/features';
it('defaults ads and coaching on, validates stored settings and tolerates unavailable storage', () => {
  localStorage.clear();
  expect(loadFeatures(localStorage)).toEqual({
    ads: true,
    coachingPreview: true,
  });
  for (const value of ['null', '[]', 'oops', '{"ads":"false"}']) {
    localStorage.setItem(FEATURE_KEY, value);
    expect(loadFeatures(localStorage).ads).toBe(true);
  }
  localStorage.setItem(
    FEATURE_KEY,
    JSON.stringify({ ads: false, coachingPreview: true }),
  );
  expect(loadFeatures(localStorage)).toEqual({
    ads: false,
    coachingPreview: false,
  });
  expect(
    loadFeatures({
      getItem: () => {
        throw Error('blocked');
      },
      setItem: () => {},
    }).ads,
  ).toBe(true);
});
it('persists settings and keeps a session choice if storage is blocked', async () => {
  vi.resetModules();
  localStorage.clear();
  const { features, setFeature } = await import('../../src/services/features');
  expect(features().ads).toBe(true);
  expect(setFeature('ads', false)).toBe(true);
  expect(loadFeatures(localStorage).ads).toBe(false);
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('blocked');
  });
  expect(setFeature('coachingPreview', true)).toBe(false);
  expect(features().coachingPreview).toBe(false);
  expect(setFeature('ads', true)).toBe(false);
  expect(features().coachingPreview).toBe(true);
  spy.mockRestore();
});
it('illustrates the actual check threshold at its own sample, preserves segment length, and rejects gaps', () => {
  for (const frames of [liftFrames(), cleanFrames()]) {
    const a = analyzePoseSamples(
      frames,
      100,
      100,
      2,
      15,
      frames[15].landmarks[15].y > frames[15].landmarks[11].y
        ? 'clean'
        : 'snatch',
    );
    for (const check of a.lift!.checks) {
      const f = a.frames.find((f) => f.time === check.time)!;
      const vector = referenceVector(a, f, check);
      expect(vector).not.toBeNull();
      const [shoulder, elbow, wrist, hip, knee, ankle] = SIDES[a.side];
      const [proximal, center, distal] =
        check.name === 'Hip extension'
          ? [shoulder, hip, knee]
          : check.name === 'Knee extension' ||
              check.name === 'Standing recovery'
            ? [hip, knee, ankle]
            : [shoulder, elbow, wrist];
      const c = f.landmarks[center],
        p = f.landmarks[proximal],
        d = f.landmarks[distal];
      const u = { x: (p.x - c.x) * a.width, y: (p.y - c.y) * a.height };
      const v = {
        x: vector!.end.x - vector!.start.x,
        y: vector!.end.y - vector!.start.y,
      };
      expect(Math.hypot(v.x, v.y)).toBeCloseTo(
        Math.hypot((d.x - c.x) * a.width, (d.y - c.y) * a.height),
      );
      const angle =
        (Math.acos(
          Math.max(
            -1,
            Math.min(
              1,
              (u.x * v.x + u.y * v.y) /
                (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y)),
            ),
          ),
        ) *
          180) /
        Math.PI;
      expect(angle).toBeCloseTo(vector!.target);

      expect(vector!.target).toBe(
        check.name === 'Front-rack arm flexion'
          ? 180 - check.target
          : check.target,
      );
      expect(referenceVector(a, { ...f, time: f.time + 1 }, check)).toBeNull();
      expect(referenceVector(a, { ...f, people: 2 }, check)).toBeNull();
      expect(referenceVector(a, { ...f, landmarks: [] }, check)).toBeNull();
      expect(['pull', 'receive', 'recover']).toContain(
        coachingGroup(check.name),
      );
    }
  }
});
it('recognizes an upright high-hang setup without inventing phases for a static clip', () => {
  const frames = cleanFrames(false, true);
  for (const f of frames.slice(0, 3))
    for (const side of Object.values(SIDES)) {
      const [s, e, w, h, k, ankle] = side;
      for (const [i, y] of [
        [s, 0.3],
        [e, 0.43],
        [w, 0.56],
        [h, 0.52],
        [k, 0.7],
        [ankle, 0.9],
      ])
        f.landmarks[i] = { x: 0.5, y, visibility: 1 };
    }
  const a = analyzePoseSamples(frames, 100, 100, 2, 15, 'high-hang-clean');
  expect(a.lift!.phases[0].start).toBe(0);
  expect(a.lift!.phases[1].applicable).toBe(false);
  const staticFrames = frames.map((f) => ({ ...frames[0], time: f.time }));
  expect(
    analyzePoseSamples(staticFrames, 100, 100, 2, 15, 'high-hang-clean').lift!
      .score,
  ).toBeNull();
});
it('smooths only display points without moving endpoints or bridging tracking gaps', async () => {
  const { smoothWristPath } = await import('../../src/domain/wrist-bar');
  const points = [
    { time: 0, x: 0, y: 0 },
    { time: 0.06, x: 3, y: 3 },
    { time: 0.12, x: 0, y: 0 },
    { time: 1, x: 5, y: 5 },
  ];
  const before = structuredClone(points),
    display = smoothWristPath(points, 15);
  expect(points).toEqual(before);
  expect(display[0]).toEqual(points[0]);
  expect(display[1].y).toBe(1);
  expect(display[2]).toEqual(points[2]);
  expect(display[3]).toEqual(points[3]);
});
