import type { VisionAnalysis } from './vision';
export function partialScore(a: VisionAnalysis): boolean {
  return (
    !!a.lift &&
    (a.lift.checks.length < 5 ||
      a.lift.phases.some(
        (p) => p.applicable !== false && (p.start === null || p.estimated),
      ))
  );
}
export function scoreVerdict(score: number | null | undefined): string {
  return score === null || score === undefined
    ? 'More evidence needed'
    : score >= 85
      ? 'Strong lift'
      : score >= 70
        ? 'Good lift'
        : score >= 50
          ? 'Building consistency'
          : 'Let’s refine';
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
