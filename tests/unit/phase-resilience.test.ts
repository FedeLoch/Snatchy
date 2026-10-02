import { expect, it } from 'vitest';
import { liftFrames } from '../fixtures/lift-pose';
import { analyzePoseSamples } from '../../src/domain/vision';
import { isVisionRecord } from '../../src/services/vision-history';
import { movementPhases } from '../../src/ui/lift-analysis';
import { cleanFrames } from '../fixtures/clean-pose';

it('keeps phase continuity through two missing samples without inventing measurements', () => {
  const frames = liftFrames();
  for (const i of [9, 10])
    frames[i] = { ...frames[i], people: 0, landmarks: [] };
  const a = analyzePoseSamples(frames, 100, 100, 2);
  expect(a.lift!.phases[4].start).toBe(12 / 15);
  expect(a.lift!.checks).toHaveLength(5);
  expect(a.lift!.phases.some((p) => p.estimated)).toBe(true);
  expect(
    a.lift!.checks.every((c) =>
      frames.some((f) => f.time === c.time && f.people === 1),
    ),
  ).toBe(true);
  expect(isVisionRecord({ id: 'gap', createdAt: 1, analysis: a })).toBe(true);
});

it('measures a short extension instead of withholding its failed checks', () => {
  const frames = liftFrames([
    110, 110, 110, 115, 120, 125, 135, 130, 125, 120, 125, 140, 150, 145, 140,
    120, 95, 85, 85, 95, 115, 140, 165, 175, 175, 175,
  ]);
  for (let i = 0; i < 15; i++)
    for (const [si, ei, wi, hi, ki] of [
      [11, 13, 15, 23, 25],
      [12, 14, 16, 24, 26],
    ]) {
      const h = frames[i].landmarks[hi],
        k = frames[i].landmarks[ki];
      const angle = ((i === 12 ? 150 : 120) * Math.PI) / 180;
      const dir = Math.atan2(k.y - h.y, k.x - h.x) - angle;
      const shoulder = {
        x: h.x + Math.cos(dir) * 0.2,
        y: h.y + Math.sin(dir) * 0.2,
        visibility: 1,
      };
      frames[i].landmarks[si] = shoulder;
      const w = frames[i].landmarks[wi];
      frames[i].landmarks[ei] = {
        x: (shoulder.x + w.x) / 2,
        y: (shoulder.y + w.y) / 2,
        visibility: 1,
      };
    }
  const a = analyzePoseSamples(frames, 100, 100, 2);
  expect(a.lift!.phases[4].start).toBe(12 / 15);
  expect(a.lift!.phases[4].estimated).toBe(true);
  expect(a.lift!.checks).toHaveLength(5);
  const checks = a.lift!.checks.filter((c) =>
    ['Hip extension', 'Knee extension'].includes(c.name),
  );
  expect(checks).toHaveLength(2);
  expect(checks.every((c) => !c.passed && c.target === 165)).toBe(true);
  expect(isVisionRecord({ id: 'short', createdAt: 1, analysis: a })).toBe(true);
});

it('shows high-hang coverage against applicable phases and bounds setup to the upper pull', () => {
  const a = analyzePoseSamples(
    cleanFrames(false, true),
    100,
    100,
    2,
    15,
    'high-hang-clean',
  );
  expect(a.lift!.phases[0].end).toBe(a.lift!.phases[3].start);
  expect(movementPhases(a, true)).toContain('5 / 5 applicable phases');
});

it('uses ordered knee and hip crossings when no knee rebend is visible', () => {
  const frames = liftFrames([
    110, 110, 110, 120, 130, 135, 140, 145, 150, 155, 160, 165, 175, 170, 150,
    120, 95, 85, 85, 95, 115, 140, 165, 175, 175, 175,
  ]);
  for (const [i, y] of [
    [11, 0.54],
    [12, 0.49],
  ]) {
    for (const [s, e, w] of [
      [11, 13, 15],
      [12, 14, 16],
    ]) {
      frames[i].landmarks[w].y = y;
      frames[i].landmarks[e].y = (frames[i].landmarks[s].y + y) / 2;
    }
  }
  const a = analyzePoseSamples(frames, 100, 100, 2);
  const phases = a.lift!.phases;
  expect(phases[2].evidenceKey).toBe('phaseEvidence.kneeCrossing');
  expect(phases[3].evidenceKey).toBe('phaseEvidence.handUpperPull');
  expect(phases[2].estimated).toBe(true);
  expect(phases[3].estimated).toBe(true);
  expect(phases[2].start!).toBeGreaterThan(phases[1].start!);
  expect(phases[3].start!).toBeGreaterThan(phases[2].start!);
  expect(phases[4].start!).toBeGreaterThan(phases[3].start!);
  expect(isVisionRecord({ id: 'crossing', createdAt: 1, analysis: a })).toBe(
    true,
  );
});

it('recognizes the same movement when the athlete is smaller in the frame', () => {
  const frames = liftFrames();
  const distant = frames.map((f) => ({
    ...f,
    landmarks: f.landmarks.map((p) => ({
      ...p,
      x: 0.25 + p.x * 0.5,
      y: 0.25 + p.y * 0.5,
    })),
  }));
  const near = analyzePoseSamples(frames, 100, 100, 2);
  const far = analyzePoseSamples(distant, 100, 100, 2);
  expect(far.lift!.phases.map((p) => p.start)).toEqual(
    near.lift!.phases.map((p) => p.start),
  );
  expect(far.lift!.checks.map((c) => c.value)).toEqual(
    near.lift!.checks.map((c) => c.value),
  );
});
