import { expect, it } from 'vitest';
import { progression } from '../../src/domain/progression';
import type { VisionAnalysis, VisionRecord } from '../../src/domain/vision';

const record = (
  id: string,
  createdAt: number,
  exerciseId: string,
  score: number | null,
): VisionRecord => ({
  id,
  createdAt,
  analysis: {
    exercise: { id: exerciseId, source: 'manual', reason: '' },
    lift: {
      version: 1,
      method: 'pose-heuristic',
      phases: [],
      checks: Array.from({ length: 5 }, () => ({})),
      score,
    },
  } as unknown as VisionAnalysis,
});

it('tracks score progress per exercise, oldest first, skipping unscored', () => {
  const series = progression([
    record('c1', 5, 'clean', 80),
    record('s3', 3, 'snatch', 100),
    record('s1', 1, 'snatch', 60),
    record('s2', 2, 'snatch', null),
  ]);
  expect(series.map((s) => s.exerciseId)).toEqual(['clean', 'snatch']);
  const snatch = series[1];
  expect(snatch.points.map((p) => p.id)).toEqual(['s1', 's3']);
  expect(snatch).toMatchObject({ latest: 100, best: 100, change: 40 });
  expect(series[0].change).toBeNull();
});

it('reports a recent trend only with six scored recordings', () => {
  const scores = [40, 40, 40, 60, 80, 100];
  const series = progression(
    scores.map((s, i) => record(`r${i}`, i, 'snatch', s)),
  )[0];
  expect(series.recentTrend).toBe(40);
  expect(
    progression(
      scores.slice(1).map((s, i) => record(`r${i}`, i, 'snatch', s)),
    )[0].recentTrend,
  ).toBeNull();
});
