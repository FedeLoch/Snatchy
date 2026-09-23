import { describe, expect, it } from 'vitest';
import {
  analyzePoseSamples,
  anglesAt,
  jointAngle,
  nearestSample,
  visible,
  type Landmark,
  type PoseSample,
} from '../../src/domain/vision';
const p = (x: number, y: number, visibility = 0.99): Landmark => ({
  x,
  y,
  visibility,
});
function sample(time = 0): PoseSample {
  const points = Array.from({ length: 33 }, () => p(0.5, 0.5, 0));
  for (const i of [11, 12]) points[i] = p(0.5, 0.2);
  for (const i of [13, 14]) points[i] = p(0.6, 0.3);
  for (const i of [15, 16]) points[i] = p(0.7, 0.4);
  for (const i of [23, 24]) points[i] = p(0.5, 0.5);
  for (const i of [25, 26]) points[i] = p(0.6, 0.7);
  for (const i of [27, 28]) points[i] = p(0.6, 0.9);
  return { time, people: 1, landmarks: points };
}
export const poseFixture = sample;
describe('measured pose geometry', () => {
  it('calculates pixel-correct angles for non-square video', () => {
    expect(jointAngle(p(0, 0), p(0.5, 0.5), p(1, 0), 200, 100)).toBeCloseTo(
      126.8699,
      3,
    );
    expect(jointAngle(p(0, 0.5), p(0.5, 0.5), p(1, 0.5), 100, 100)).toBe(180);
  });
  it('refuses low-visibility, out-of-frame and degenerate joints', () => {
    expect(visible(undefined)).toBe(false);
    expect(visible(p(-0.1, 0.5))).toBe(false);
    expect(visible(p(0.5, 0.5, 0.1))).toBe(false);
    expect(
      jointAngle(p(0.5, 0.5), p(0.5, 0.5), p(0.5, 0.5), 10, 10),
    ).toBeNull();
    expect(jointAngle(p(0, 0), p(0.5, 0.5), p(1, 0), 0, 100)).toBeNull();
    expect(jointAngle(undefined, p(0.5, 0.5), p(1, 0), 100, 100)).toBeNull();
  });
  it('never measures across multiple people or interpolates missing tracking', () => {
    expect(anglesAt({ ...sample(), people: 2 }, 'left', 100, 100)).toEqual({
      elbow: null,
      hip: null,
      knee: null,
    });
    expect(nearestSample([], 0)).toBeNull();
    expect(nearestSample([sample()], NaN)).toBeNull();
    expect(nearestSample([sample()], 2)).toBeNull();
    expect(nearestSample([sample(0), sample(0.1)], 0.08)?.time).toBe(0.1);
    expect(nearestSample([sample(0), sample(0.1)], 0.01)?.time).toBe(0);
  });
});
describe('confidence-aware video analysis', () => {
  it('produces measured values from the input with no overall score', () => {
    const result = analyzePoseSamples(
      Array.from({ length: 20 }, (_, i) => sample(i / 15)),
      640,
      480,
      1.4,
    );
    expect(result.status).toBe('tracked');
    expect(result.coverage).toBe(1);
    expect(result.ranges.elbow?.max).toBe(180);
    expect(result.simulated).toBe(false);
    expect(result).not.toHaveProperty('score');
    expect(result.events).toHaveLength(0);
  });
  it('withholds ranges and events for blank, multiple-person and short input', () => {
    for (const frames of [
      [],
      [sample()],
      Array.from({ length: 20 }, (_, i) => ({
        ...sample(i / 15),
        people: 0,
        landmarks: [],
      })),
      Array.from({ length: 20 }, (_, i) => ({ ...sample(i / 15), people: 2 })),
    ]) {
      const result = analyzePoseSamples(frames, 100, 100, 2);
      expect(result.status).toBe('insufficient');
      expect(result.events).toEqual([]);
      expect(result.ranges.elbow).toBeNull();
    }
  });
  it('selects one side consistently based on visibility', () => {
    const frames = Array.from({ length: 20 }, (_, i) => {
      const f = sample(i / 15);
      f.landmarks[13].visibility = 0.1;
      return f;
    });
    const result = analyzePoseSamples(frames, 100, 100, 2);
    expect(result.side).toBe('right');
    expect(result.status).toBe('tracked');
  });
  it('reports input-dependent motion events and sustained overhead extension', () => {
    const frames = Array.from({ length: 30 }, (_, i) => {
      const f = sample(i / 15);
      const t = i / 29;
      for (const [s, e, w, h, k, a] of [
        [11, 13, 15, 23, 25, 27],
        [12, 14, 16, 24, 26, 28],
      ]) {
        f.landmarks[s] = p(0.5, 0.3);
        f.landmarks[h] = p(0.5, 0.5);
        f.landmarks[k] = p(0.5 + 0.18 * (1 - t), 0.7);
        f.landmarks[a] = p(0.5, 0.9);
        if (i < 15) {
          f.landmarks[e] = p(0.65, 0.35);
          f.landmarks[w] = p(0.55, 0.45);
        } else {
          f.landmarks[e] = p(0.5, 0.2);
          f.landmarks[w] = p(0.5, 0.1);
        }
      }
      return f;
    });
    const result = analyzePoseSamples(frames, 100, 100, 2);
    expect(result.events.some((e) => e.id === 'extension')).toBe(true);
    expect(result.events.some((e) => e.id === 'knee-flexion')).toBe(true);
    expect(result.events.some((e) => e.id === 'elbow-flexion')).toBe(true);
    expect(result.events.some((e) => e.id === 'overhead')).toBe(true);
  });
  it('does not join unrelated overhead samples across a detection gap', () => {
    const frames = Array.from({ length: 20 }, (_, i) => sample(i / 15));
    for (const index of [1, 8, 15]) {
      for (const [e, w] of [
        [13, 15],
        [14, 16],
      ]) {
        frames[index].landmarks[e] = p(0.5, 0.1);
        frames[index].landmarks[w] = p(0.5, 0);
      }
    }
    expect(
      analyzePoseSamples(frames, 100, 100, 2).events.some(
        (e) => e.id === 'overhead',
      ),
    ).toBe(false);
  });
});
