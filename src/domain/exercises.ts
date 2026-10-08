import { anglesAt, SIDES, visible, type VisionAnalysis } from './vision';
import { source } from '../i18n';
export interface Exercise {
  id: string;
  name: string;
  family: 'snatch' | 'clean' | 'hinge' | 'row';
  start: 'floor' | 'hang' | 'high-hang';
  receiving: 'squat' | 'power' | 'muscle' | 'none';
}
export const exercises: readonly Exercise[] = [
  {
    id: 'deadlift',
    name: 'Deadlift',
    family: 'hinge',
    start: 'floor',
    receiving: 'none',
  },
  {
    id: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    family: 'hinge',
    start: 'hang',
    receiving: 'none',
  },
  {
    id: 'barbell-row',
    name: 'Bent-over Barbell Row',
    family: 'row',
    start: 'hang',
    receiving: 'none',
  },
  {
    id: 'snatch',
    name: 'Snatch',
    family: 'snatch',
    start: 'floor',
    receiving: 'squat',
  },
  {
    id: 'power-snatch',
    name: 'Power Snatch',
    family: 'snatch',
    start: 'floor',
    receiving: 'power',
  },
  {
    id: 'hang-snatch',
    name: 'Hang Snatch',
    family: 'snatch',
    start: 'hang',
    receiving: 'squat',
  },
  {
    id: 'high-hang-snatch',
    name: 'High-Hang Snatch',
    family: 'snatch',
    start: 'high-hang',
    receiving: 'squat',
  },
  {
    id: 'clean',
    name: 'Clean',
    family: 'clean',
    start: 'floor',
    receiving: 'squat',
  },
  {
    id: 'power-clean',
    name: 'Power Clean',
    family: 'clean',
    start: 'floor',
    receiving: 'power',
  },
  {
    id: 'hang-clean',
    name: 'Hang Clean',
    family: 'clean',
    start: 'hang',
    receiving: 'squat',
  },
  {
    id: 'hang-power-clean',
    name: 'Hang Power Clean',
    family: 'clean',
    start: 'hang',
    receiving: 'power',
  },
  {
    id: 'high-hang-clean',
    name: 'High-Hang Clean',
    family: 'clean',
    start: 'high-hang',
    receiving: 'squat',
  },
  {
    id: 'high-hang-power-clean',
    name: 'High-Hang Power Clean',
    family: 'clean',
    start: 'high-hang',
    receiving: 'power',
  },
  {
    id: 'muscle-clean',
    name: 'Muscle Clean',
    family: 'clean',
    start: 'floor',
    receiving: 'muscle',
  },
];
export const exerciseById = (id?: string): Exercise | undefined =>
  exercises.find((e) => e.id === id);
export interface ExerciseSelection {
  id: string | null;
  source: 'automatic' | 'manual';
  reason: string;
}
export function detectExercise(a: VisionAnalysis): ExerciseSelection {
  const [s, , w, h, k] = SIDES[a.side];
  const data = a.frames
    .filter(
      (f) =>
        f.people === 1 && [s, w, h, k].every((i) => visible(f.landmarks[i])),
    )
    .map((f) => ({
      time: f.time,
      wrist: f.landmarks[w],
      shoulder: f.landmarks[s],
      hipPoint: f.landmarks[h],
      kneePoint: f.landmarks[k],
      ...anglesAt(f, a.side, a.width, a.height),
    }));
  const unknown = {
    id: null,
    source: 'automatic' as const,
    // Stored in the base language, not the device's, so the record reads the
    // same everywhere. The catalog keys sit alongside for a future surface.
    reason: source('exerciseReason.unresolved'),
  };
  if (data.length < 12) return unknown;
  const initial = data[0];
  const moved =
    Math.max(...data.map((v) => v.wrist.y)) -
      Math.min(...data.map((v) => v.wrist.y)) >
    0.12;
  if (!moved) return unknown;
  const sustained = (i: number, predicate: (v: typeof initial) => boolean) =>
    i + 2 < data.length &&
    data[i + 2].time - data[i].time <= 2.1 / a.sampleRate &&
    data.slice(i, i + 3).every(predicate);
  const overhead = data.findIndex((_, i) =>
    sustained(
      i,
      (v) =>
        v.elbow !== null && v.elbow >= 155 && v.wrist.y < v.shoulder.y - 0.06,
    ),
  );
  const rack = data.findIndex((_, i) =>
    sustained(
      i,
      (v) =>
        v.elbow !== null &&
        v.elbow < 120 &&
        Math.abs(v.wrist.y - v.shoulder.y) < 0.1,
    ),
  );
  if (overhead < 0 && rack < 0) return unknown;
  const family = overhead >= 0 ? 'snatch' : 'clean';
  const receiver = overhead >= 0 ? overhead : rack;
  const knees = data
    .slice(receiver)
    .filter((v) => v.time - data[receiver].time < 1.2 && v.knee !== null)
    .map((v) => v.knee!);
  if (!knees.length) return unknown;
  const power = Math.min(...knees) > 130;
  const position = (initial: (typeof data)[number]) =>
    Math.abs(initial.wrist.y - initial.hipPoint.y) <
      Math.max(
        0.055,
        Math.abs(initial.hipPoint.y - initial.shoulder.y) * 0.35,
      ) && (initial.knee ?? 0) > 145
      ? 'high-hang'
      : initial.wrist.y < initial.kneePoint.y - 0.02
        ? 'hang'
        : 'floor';
  // Standing preparation is not the lift's starting position. Require a
  // continuous three-sample position before receiving, and prefer evidence of
  // the lower start over later positions that every floor pull passes through.
  const starts = new Set<string>();
  for (let i = 0; i + 2 < receiver; i++) {
    const candidate = position(data[i]);
    if (sustained(i, (v) => position(v) === candidate)) starts.add(candidate);
  }
  const start = starts.has('floor')
    ? 'floor'
    : starts.has('high-hang') && position(initial) === 'high-hang'
      ? 'high-hang'
      : starts.has('hang')
        ? 'hang'
        : starts.has('high-hang')
          ? 'high-hang'
          : null;
  if (!start) return unknown;
  // Muscle vs power requires more than an image-plane knee angle; leave muscle as a manual choice.
  const match =
    exercises.find(
      (e) =>
        e.family === family &&
        e.start === start &&
        e.receiving === (power ? 'power' : 'squat'),
    ) ??
    exercises.find(
      (e) =>
        e.family === family && e.start === start && e.receiving === 'squat',
    );
  return {
    id: match?.id ?? null,
    source: 'automatic',
    reason: source(
      family === 'snatch'
        ? 'exerciseReason.suggestedOverhead'
        : 'exerciseReason.suggestedRack',
    ),
  };
}

export function strengthExercise(id?: string): boolean {
  const family = exerciseById(id)?.family;
  return family === 'hinge' || family === 'row';
}
export function expectedChecks(id?: string): number {
  return id === 'deadlift' ? 3 : strengthExercise(id) ? 2 : 5;
}
