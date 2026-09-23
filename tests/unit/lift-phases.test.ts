import { liftFrames } from '../fixtures/lift-pose';
import { describe, it, expect } from 'vitest';
import { analyzePoseSamples } from '../../src/domain/vision';
import { estimatePhases } from '../../src/domain/lift-phases';
describe('real phase estimation', () => {
  it('finds ordered movement boundaries from joint evidence and computes transparent checks', () => {
    const a = analyzePoseSamples(liftFrames(), 100, 100, 26 / 15);
    expect(a.lift?.phases.map((p) => p.start)).toEqual([
      0,
      4 / 15,
      6 / 15,
      9 / 15,
      12 / 15,
      15 / 15,
      20 / 15,
    ]);
    expect(a.lift?.score).toBe(100);
    expect(a.lift?.checks).toHaveLength(5);
    expect(
      a.lift?.checks.find((c) => c.name === 'Standing recovery')?.passed,
    ).toBe(true);
  });
  it('does not synthesize phases for static, incomplete, ambiguous or low-confidence footage', () => {
    const frames = liftFrames();
    for (const input of [
      [],
      frames.slice(0, 8),
      frames.map((f) => ({ ...frames[0], time: f.time })),
      frames.map((f) => ({ ...f, people: 2 })),
      frames.map((f) => ({
        ...f,
        landmarks: f.landmarks.map((p) => ({ ...p, visibility: 0.1 })),
      })),
    ]) {
      const a = analyzePoseSamples(input, 100, 100, 2);
      expect(a.lift?.score).toBeNull();
      expect(a.lift?.phases.every((p) => p.start === null)).toBe(true);
    }
  });
  it('withholds score when rebend is absent or recovery is cut off', () => {
    const frames = liftFrames();
    const a = analyzePoseSamples(frames.slice(0, 20), 100, 100, 2);
    expect(a.lift?.phases[5].start).not.toBeNull();
    expect(a.lift?.phases[6].start).toBeNull();
    expect(a.lift?.score).toBeNull();
    expect(
      estimatePhases({ ...a, frames: [] }).phases.every(
        (p) => p.start === null,
      ),
    ).toBe(true);
  });
  it('does not bridge a pose dropout into a full lift', () => {
    const frames = liftFrames();
    frames[10] = { ...frames[10], people: 0, landmarks: [] };
    expect(analyzePoseSamples(frames, 100, 100, 2).lift?.score).toBeNull();
  });
});
