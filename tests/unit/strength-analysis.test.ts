import { expect, it } from 'vitest';
import { strengthFrames } from '../fixtures/strength-pose';
import { analyzePoseSamples } from '../../src/domain/vision';
import { analyzeRepetitions } from '../../src/domain/repetitions';
import { expectedChecks } from '../../src/domain/exercises';
import { partialScore } from '../../src/domain/score-summary';
import {
  isVisionRecord,
  saveVisionHistory,
  loadVisionHistory,
} from '../../src/services/vision-history';
import { barPanel } from '../../src/ui/lift-analysis';
it.each([
  'deadlift',
  'romanian-deadlift',
  'barbell-row',
  'pull-up',
  'chin-up',
  'back-squat',
])('%s uses its own phases and checks and survives history reload', (id) => {
  const frames = strengthFrames(id);
  const a = analyzePoseSamples(frames, 100, 100, 2, 15, id);
  expect(a.lift!.phases).toHaveLength(5);
  expect(
    a.lift!.phases.some((p) => p.name === 'Catch' || p.name === 'Turnover'),
  ).toBe(false);
  expect(a.lift!.score).not.toBeNull();
  expect(a.lift!.checks.length).toBe(expectedChecks(id));
  expect(partialScore(a)).toBe(false);
  expect(
    a.lift!.checks.some(
      (c) => c.name.includes('rack') || c.name.includes('Receiving'),
    ),
  ).toBe(false);
  const record = { id: 'strength', createdAt: 1, analysis: a };
  expect(isVisionRecord(record)).toBe(true);
  saveVisionHistory(localStorage, [record]);
  expect(loadVisionHistory(localStorage)[0].analysis.exercise?.id).toBe(id);
  if (['pull-up', 'chin-up', 'back-squat'].includes(id))
    expect(barPanel(a)).not.toContain('class="measured-bar-path"');
  else expect(barPanel(a)).toContain('class="measured-bar-path"');
  const staticFrames = frames.map((_, i) => ({ ...frames[0], time: i / 15 }));
  expect(
    analyzePoseSamples(staticFrames, 100, 100, 2, 15, id).lift!.score,
  ).toBeNull();
});
it.each([
  'deadlift',
  'romanian-deadlift',
  'barbell-row',
  'pull-up',
  'chin-up',
  'back-squat',
])('%s separates two cycles', (id) => {
  const first = strengthFrames(id);
  const frames = [
    ...first,
    ...first.map((f) => ({ ...f, time: f.time + 25 / 15 })),
  ];
  const reps = analyzeRepetitions(
    analyzePoseSamples(frames, 100, 100, 4, 15, id),
  );
  expect(reps).toHaveLength(2);
  expect(reps.every((r) => r.exercise?.id === id)).toBe(true);
  expect(reps.every((r) => r.lift!.score !== null)).toBe(true);
});
it('does not bridge missing-body samples into a complete cycle', () => {
  const frames = strengthFrames('deadlift');
  frames[12] = { ...frames[12], people: 0, landmarks: [] };
  expect(
    analyzePoseSamples(frames, 100, 100, 2, 15, 'deadlift').lift!.score,
  ).toBeNull();
});
