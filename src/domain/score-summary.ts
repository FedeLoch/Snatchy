import type { VisionAnalysis } from './vision';
export function partialScore(a: VisionAnalysis): boolean {
  // Phase boundaries describe timing, not the availability of the five checks.
  return !!a.lift && a.lift.checks.length < 5;
}
/**
 * The score band, as a stable identifier rather than a sentence. Returning the
 * English wording would pin the UI to one language and make the band untestable
 * once translations land, so the caller maps this through the catalog.
 */
export type ScoreBand =
  'insufficient' | 'strong' | 'good' | 'consistency' | 'refine';

export function scoreBand(score: number | null | undefined): ScoreBand {
  if (score === null || score === undefined) return 'insufficient';
  if (score >= 85) return 'strong';
  if (score >= 70) return 'good';
  if (score >= 50) return 'consistency';
  return 'refine';
}
export function historyScore(a: VisionAnalysis) {
  const reps = a.repetitions?.length ? a.repetitions : [a];
  const scores = reps.filter(
    (r) => r.lift?.score !== null && r.lift?.score !== undefined,
  );
  return {
    value: scores.length
      ? Math.round(
          scores.reduce((sum, r) => sum + r.lift!.score!, 0) / scores.length,
        )
      : null,
    partial: scores.length < reps.length || scores.some(partialScore),
    count: reps.length,
  };
}
