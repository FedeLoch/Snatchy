import type { LiftRecord } from '../domain/types';
import type { LiftPhases, CheckName } from '../domain/lift-phases';

export interface CheckDelta {
  name: CheckName;
  deltaPct: number | null;
}

export interface ExerciseComparison {
  overallDeltaPct: number | null;
  previousScore: number | null;
  previousDate: number | null;
  checkDeltas: CheckDelta[];
  isFirstRecord: boolean;
}

function findPreviousRecord(records: LiftRecord[], currentRecord: LiftRecord): LiftRecord | null {
  const previous = records
    .filter(
      (r) =>
        r.source === 'video' &&
        r.analysis.movementId === currentRecord.analysis.movementId &&
        r.createdAt < currentRecord.createdAt,
    )
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  return previous ?? null;
}

function getLiftPhases(record: LiftRecord): LiftPhases | null {
  return (record.analysis as unknown as { lift?: LiftPhases }).lift ?? null;
}

export function compareWithPrevious(
  records: LiftRecord[],
  currentRecord: LiftRecord,
): ExerciseComparison {
  const previous = findPreviousRecord(records, currentRecord);

  if (!previous) {
    return {
      overallDeltaPct: null,
      previousScore: null,
      previousDate: null,
      checkDeltas: [],
      isFirstRecord: true,
    };
  }

  const currentScore = currentRecord.analysis.score;
  const previousScore = previous.analysis.score;
  const overallDeltaPct =
    previousScore > 0 ? ((currentScore - previousScore) / previousScore) * 100 : null;

  const currentLift = getLiftPhases(currentRecord);
  const previousLift = getLiftPhases(previous);

  const checkDeltas: CheckDelta[] = [];

  if (currentLift && previousLift) {
    for (const check of currentLift.checks) {
      const prevCheck = previousLift.checks.find((c) => c.name === check.name);
      if (prevCheck && prevCheck.value > 0) {
        const deltaPct = ((check.value - prevCheck.value) / prevCheck.value) * 100;
        checkDeltas.push({ name: check.name, deltaPct });
      } else {
        checkDeltas.push({ name: check.name, deltaPct: null });
      }
    }
  }

  return {
    overallDeltaPct,
    previousScore,
    previousDate: previous.createdAt,
    checkDeltas,
    isFirstRecord: false,
  };
}

export function getCheckDelta(
  comparison: ExerciseComparison,
  checkName: CheckName,
): number | null {
  const delta = comparison.checkDeltas.find((d) => d.name === checkName);
  return delta?.deltaPct ?? null;
}