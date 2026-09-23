import { expect, it } from 'vitest';
import { analyzePoseSamples } from '../../src/domain/vision';
import { exercises, detectExercise } from '../../src/domain/exercises';
import { cleanFrames } from '../fixtures/clean-pose';
import { liftFrames } from '../fixtures/lift-pose';
import {
  isVisionRecord,
  saveVisionHistory,
  loadVisionHistory,
} from '../../src/services/vision-history';
import { historyScore, scoreVerdict } from '../../src/domain/score-summary';
import { estimateWristBar, wristMetrics } from '../../src/domain/wrist-bar';
import { bodyMeasurements } from '../../src/domain/body-measurements';
it('distinguishes overhead snatches, rack cleans and power receiving, and leaves static footage unresolved', () => {
  const a = analyzePoseSamples(liftFrames(), 100, 100, 2, 15, 'auto');
  expect(a.exercise?.id).toBe('snatch');
  expect(
    analyzePoseSamples(cleanFrames(), 100, 100, 2, 15, 'auto').exercise?.id,
  ).toBe('clean');
  expect(
    analyzePoseSamples(cleanFrames(true), 100, 100, 2, 15, 'auto').exercise?.id,
  ).toBe('power-clean');
  expect(
    analyzePoseSamples(cleanFrames(false, true), 100, 100, 2, 15, 'auto')
      .exercise?.id,
  ).toBe('high-hang-clean');
  expect(
    detectExercise({
      ...a,
      frames: a.frames.map((f) => ({ ...a.frames[0], time: f.time })),
    }).id,
  ).toBeNull();
  expect(detectExercise({ ...a, frames: [] }).id).toBeNull();
});
it.each(exercises.filter((e) => e.family === 'clean'))(
  'uses receiving flexion for $name rather than snatch lockout',
  (e) => {
    const a = analyzePoseSamples(
      cleanFrames(
        e.receiving === 'power',
        e.start === 'high-hang',
        e.receiving === 'muscle',
      ),
      100,
      100,
      2,
      15,
      e.id,
    );
    expect(a.lift!.phases[5].start).not.toBeNull();
    expect(a.lift!.checks.map((c) => c.name)).toContain(
      'Front-rack arm flexion',
    );
    expect(a.lift!.checks.map((c) => c.name)).not.toContain(
      'Receiving arm extension',
    );
    expect(a.lift!.score).not.toBeNull();
    if (e.start === 'high-hang')
      expect(a.lift!.phases[1].applicable).toBe(false);
    expect(
      isVisionRecord({ id: 'clean-test', createdAt: 1, analysis: a }),
    ).toBe(true);
  },
);
it('persists wrist estimates, body summaries and manual selection with partial history scores', () => {
  const a = analyzePoseSamples(
    liftFrames().slice(0, 20),
    100,
    100,
    2,
    15,
    'high-hang-snatch',
  );
  saveVisionHistory(localStorage, [
    { id: 'new-data', createdAt: 1, analysis: a },
  ]);
  const saved = loadVisionHistory(localStorage)[0].analysis;
  expect(saved.exercise?.id).toBe('high-hang-snatch');
  expect(saved.frames).toEqual([]);
  expect(saved.wristBar!.points.length).toBe(20);
  expect(saved.body!.meanVisible).toBe(33);
  expect(historyScore(saved).partial).toBe(true);
  for (const score of [0, 40, 60, 80, 100, null])
    expect(scoreVerdict(score)).toBeTruthy();
  expect(
    historyScore({
      ...saved,
      repetitions: [
        { ...saved, lift: { ...saved.lift!, score: 40 } },
        { ...saved, lift: { ...saved.lift!, score: 80 } },
      ],
    }).value,
  ).toBe(60);
  const broken = structuredClone(saved);
  broken.wristBar!.points[0].left.x = NaN;
  expect(isVisionRecord({ id: 'bad', createdAt: 1, analysis: broken })).toBe(
    false,
  );
});
it('uses both real wrist positions, leaves gaps and derives relative displacement and velocity', () => {
  const a = analyzePoseSamples(liftFrames(), 100, 100, 2);
  const frames = a.frames.slice(0, 4).map((f, i) => ({
    ...f,
    landmarks: f.landmarks.map((p, j) =>
      j === 15
        ? { ...p, x: 0.4, y: 0.8 - i * 0.05 }
        : j === 16
          ? { ...p, x: 0.6, y: 0.8 - i * 0.05 }
          : p,
    ),
  }));
  const t = estimateWristBar({ ...a, frames });
  expect(t.points[0].x).toBe(50);
  expect(wristMetrics(t)?.rise).toBeCloseTo(15);
  expect(wristMetrics(t)?.velocity).toBeCloseTo(75);
  frames[1].landmarks[15].visibility = 0;
  expect(estimateWristBar({ ...a, frames }).points).toHaveLength(3);
  expect(wristMetrics({ ...t, points: [] })).toBeNull();
  expect(bodyMeasurements({ ...a, frames: [] }).meanVisible).toBe(0);
});
