import { anglesAt, SIDES, visible, type VisionAnalysis } from './vision';
export interface Exercise {
  id: string;
  name: string;
  family: 'snatch' | 'clean';
  start: 'floor' | 'hang' | 'high-hang';
  receiving: 'squat' | 'power' | 'muscle';
}
export const exercises: readonly Exercise[] = [
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
    reason:
      'Exercise not resolved. Select the movement manually to apply its phase and scoring rules.',
  };
  if (data.length < 12) return unknown;
  const initial = data[0];
  const moved = data.some((v) => initial.wrist.y - v.wrist.y > 0.12);
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
  const start =
    Math.abs(initial.wrist.y - initial.hipPoint.y) < 0.055 &&
    (initial.knee ?? 0) > 145
      ? 'high-hang'
      : initial.wrist.y < initial.kneePoint.y - 0.02
        ? 'hang'
        : 'floor';
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
    reason:
      'Suggested from sustained ' +
      (family === 'snatch' ? 'overhead' : 'front-rack') +
      ' receiving position and initial hand height. Confirm or change it; floor contact and variation are not verified.',
  };
}
