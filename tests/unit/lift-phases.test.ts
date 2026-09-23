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
  it('scores available checks when recovery is cut off', () => {
    const frames = liftFrames();
    const a = analyzePoseSamples(frames.slice(0, 20), 100, 100, 2);
    expect(a.lift?.phases[5].start).not.toBeNull();
    expect(a.lift?.phases[6].start).toBeNull();
    expect(a.lift?.score).toBe(100);
    expect(a.lift?.checks).toHaveLength(4);
    expect(
      estimatePhases({ ...a, frames: [] }).phases.every(
        (p) => p.start === null,
      ),
    ).toBe(true);
  });
  it('tolerates one missing sample while flagging the affected phase timing', () => {
    const frames = liftFrames();
    frames[10] = { ...frames[10], people: 0, landmarks: [] };
    const lift = analyzePoseSamples(frames, 100, 100, 2).lift!;
    expect(lift.phases[4].start).toBe(12 / 15);
    expect(lift.phases[3].estimated).toBe(true);
    expect(lift.phases[3].evidence).toContain('unavailable');
    expect(lift.checks).toHaveLength(5);
    expect(lift.score).toBe(100);
  });
});

it('scores the pull without needing a catch, and the catch without needing setup', () => {
  const pull = analyzePoseSamples(liftFrames().slice(0, 14), 100, 100, 1).lift!;
  expect(pull.checks.map((c) => c.name)).toEqual([
    'Arms through the pull',
    'Hip extension',
    'Knee extension',
  ]);
  expect(pull.score).toBe(100);
  expect(pull.phases[5].start).toBeNull();
  const receiving = analyzePoseSamples(
    liftFrames().slice(14),
    100,
    100,
    2,
  ).lift!;
  expect(receiving.checks.map((c) => c.name)).toEqual([
    'Receiving arm extension',
    'Standing recovery',
  ]);
  expect(receiving.phases[0].start).toBeNull();
  expect(receiving.score).toBe(100);
});
it('does not penalize unknown phases but still deducts for observed failed checks', () => {
  const frames = liftFrames().slice(0, 20);
  frames[5].landmarks[13] = {
    ...frames[5].landmarks[13],
    x: frames[5].landmarks[13].x + 0.1,
  };
  frames[5].landmarks[14] = {
    ...frames[5].landmarks[14],
    x: frames[5].landmarks[14].x + 0.1,
  };
  const lift = analyzePoseSamples(frames, 100, 100, 2).lift!;
  expect(lift.checks).toHaveLength(4);
  expect(lift.score).toBe(75);
});
it('keeps missing transition phases unresolved while scoring other measurements', () => {
  const frames = liftFrames();
  for (let i = 7; i <= 10; i++)
    for (const joint of [23, 24, 25, 26, 27, 28])
      frames[i].landmarks[joint] = { ...frames[6].landmarks[joint] };
  const lift = analyzePoseSamples(frames, 100, 100, 2).lift!;
  expect(lift.phases[2].start).toBeNull();
  expect(lift.phases[3].start).toBeNull();
  expect(lift.score).not.toBeNull();
  expect(lift.checks).toHaveLength(5);
});

it('does not bridge prolonged occlusion or multiple-person ambiguity', () => {
  for (const people of [0, 2]) {
    const frames = liftFrames();
    for (const i of people === 2 ? [10] : [9, 10, 11])
      frames[i] = {
        ...frames[i],
        people,
        landmarks: people === 2 ? frames[i].landmarks : [],
      };
    const lift = analyzePoseSamples(frames, 100, 100, 2).lift!;
    expect(lift.phases[4].start).toBeNull();
    expect(lift.checks.map((c) => c.name)).toEqual([
      'Receiving arm extension',
      'Standing recovery',
    ]);
  }
});
it('uses phase-specific joints instead of discarding the pull when elbows are obscured', () => {
  const frames = liftFrames();
  for (let i = 0; i < 15; i++)
    for (const joint of [13, 14])
      frames[i].landmarks[joint] = {
        ...frames[i].landmarks[joint],
        visibility: 0.1,
      };
  const a = analyzePoseSamples(frames, 100, 100, 2);
  expect(a.status).toBe('insufficient');
  expect(a.lift!.phases[1].start).not.toBeNull();
  expect(a.lift!.phases[4].start).not.toBeNull();
  expect(a.lift!.checks.map((c) => c.name)).not.toContain(
    'Arms through the pull',
  );
  expect(a.lift!.checks).toHaveLength(4);
});
