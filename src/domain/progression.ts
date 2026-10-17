import { historyScore } from './score-summary';
import type { VisionRecord } from './vision';

export interface ProgressPoint {
  id: string;
  time: number;
  score: number;
  partial: boolean;
}
export interface ProgressSeries {
  /** Exercise id the scores belong to. */
  exerciseId: string;
  points: ProgressPoint[];
  latest: number;
  best: number;
  /** Latest minus first score, in points. Null with a single recording. */
  change: number | null;
  /** Mean of the last three scores minus the mean of the three before them.
   * Null until six scored recordings exist. */
  recentTrend: number | null;
}

const exerciseOf = (r: VisionRecord) =>
  (r.analysis.repetitions?.[0]?.exercise ?? r.analysis.exercise)?.id ?? null;

/** Score progression per exercise. Checks and targets differ between
 * exercises, so scores are only compared within the same exercise, oldest
 * first. Recordings without a score are left out rather than drawn as zero. */
export function progression(records: VisionRecord[]): ProgressSeries[] {
  const groups = new Map<string, ProgressPoint[]>();
  for (const r of records) {
    const exerciseId = exerciseOf(r);
    const score = historyScore(r.analysis);
    if (!exerciseId || score.value === null) continue;
    const points = groups.get(exerciseId) ?? [];
    points.push({
      id: r.id,
      time: r.createdAt,
      score: score.value,
      partial: score.partial,
    });
    groups.set(exerciseId, points);
  }
  const mean = (xs: ProgressPoint[]) =>
    xs.reduce((sum, p) => sum + p.score, 0) / xs.length;
  return [...groups]
    .map(([exerciseId, points]) => {
      points.sort((a, b) => a.time - b.time);
      const latest = points.at(-1)!.score;
      return {
        exerciseId,
        points,
        latest,
        best: Math.max(...points.map((p) => p.score)),
        change: points.length > 1 ? latest - points[0].score : null,
        recentTrend:
          points.length >= 6
            ? Math.round(mean(points.slice(-3)) - mean(points.slice(-6, -3)))
            : null,
      };
    })
    .sort((a, b) => b.points.at(-1)!.time - a.points.at(-1)!.time);
}
