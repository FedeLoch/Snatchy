import { anglesAt, SIDES, visible, type VisionAnalysis } from './vision';
import type { LiftPhases, PhaseName, MovementCheck } from './lift-phases';
import { source } from '../i18n';
export function strengthPhaseNames(id?: string): readonly PhaseName[] {
  return id === 'romanian-deadlift'
    ? ['Setup', 'Lowering', 'Bottom', 'Lifting', 'Lockout']
    : id === 'barbell-row'
      ? ['Setup', 'Pull', 'Squeeze', 'Lowering', 'Finish']
      : ['Setup', 'Lifting', 'Lockout', 'Lowering', 'Finish'];
}
function rows(a: VisionAnalysis) {
  const [s, , w, h] = SIDES[a.side];
  return a.frames.map((f) => ({
    time: f.time,
    valid: f.people === 1 && [s, w, h].every((i) => visible(f.landmarks[i])),
    wrist: f.landmarks[w]?.y ?? 0,
    hipY: f.landmarks[h]?.y ?? 0,
    shoulderY: f.landmarks[s]?.y ?? 0,
    ...anglesAt(f, a.side, a.width, a.height),
  }));
}
/** Candidate cycles require sustained displacement and a return; static holds are not reps. */
export function strengthWindows(
  a: VisionAnalysis,
): { start: number; end: number }[] {
  const data = rows(a),
    rdl = a.exercise?.id === 'romanian-deadlift';
  const torso = data
    .filter((r) => r.valid)
    .map((r) => Math.abs(r.hipY - r.shoulderY))
    .sort((x, y) => x - y);
  const travel = Math.max(
    0.035,
    (torso[Math.floor(torso.length / 2)] ?? 0.2) * 0.3,
  );
  const windows: { start: number; end: number }[] = [];
  let base = -1,
    extreme = -1,
    turned = false;
  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    if (!r.valid || (i > 0 && r.time - data[i - 1].time > 1.6 / a.sampleRate)) {
      base = extreme = -1;
      turned = false;
      continue;
    }
    if (base < 0) {
      base = extreme = i;
      continue;
    }
    const excursion = rdl
      ? r.wrist - data[base].wrist
      : data[base].wrist - r.wrist;
    if (!turned && excursion < 0) {
      base = extreme = i;
      continue;
    }
    if (rdl ? r.wrist > data[extreme].wrist : r.wrist < data[extreme].wrist)
      extreme = i;
    const peak = rdl
      ? data[extreme].wrist - data[base].wrist
      : data[base].wrist - data[extreme].wrist;
    if (
      peak >= travel &&
      data[extreme].time - data[base].time >= 2 / a.sampleRate
    )
      turned = true;
    if (turned && excursion <= travel * 0.15 && i - extreme >= 2) {
      windows.push({ start: data[base].time, end: r.time });
      base = extreme = i;
      turned = false;
    }
  }
  return windows;
}
export function estimateStrengthPhases(a: VisionAnalysis): LiftPhases {
  const id = a.exercise?.id,
    rdl = id === 'romanian-deadlift',
    row = id === 'barbell-row';
  const result: LiftPhases = {
    version: 1,
    method: 'pose-heuristic',
    score: null,
    checks: [],
    phases: strengthPhaseNames(id ?? undefined).map((name) => ({
      name,
      start: null,
      end: null,
      coverage: null,
      evidence: source('strength.unresolved'),
      evidenceKey: 'strength.unresolved',
    })),
  };
  const data = rows(a);
  if (data.length < 9) return result;
  // Analyze only the first cycle in an unsplit recording; the repetition selector
  // supplies isolated windows for subsequent cycles.
  const window = strengthWindows(a)[0];
  const candidates = data.filter(
    (r) =>
      r.valid && (!window || (r.time >= window.start && r.time <= window.end)),
  );
  if (candidates.length < 9) return result;
  const d = candidates;
  if (d.some((r, i) => i > 0 && r.time - d[i - 1].time > 1.6 / a.sampleRate))
    return result;
  let extreme = 0;
  for (let i = 1; i < d.length; i++)
    if (rdl ? d[i].wrist > d[extreme].wrist : d[i].wrist < d[extreme].wrist)
      extreme = i;
  const travel = Math.abs(d[extreme].wrist - d[0].wrist);
  if (
    travel < Math.max(0.035, Math.abs(d[0].hipY - d[0].shoulderY) * 0.3) ||
    extreme < 2
  )
    return result;
  const onset = d.findIndex(
    (r, i) => i > 0 && Math.abs(r.wrist - d[0].wrist) > travel * 0.1,
  );
  const returning = d.findIndex(
    (r, i) =>
      i > extreme && Math.abs(r.wrist - d[extreme].wrist) > travel * 0.1,
  );
  const finish = d.findIndex(
    (r, i) =>
      i > returning &&
      returning > 0 &&
      Math.abs(r.wrist - d[0].wrist) < travel * 0.2,
  );
  const indices = [0, onset, extreme, returning, finish];
  indices.forEach((idx, i) => {
    if (idx < 0) return;
    const phase = result.phases[i];
    phase.start = d[idx].time;
    phase.estimated = true;
    phase.evidence = source('strength.estimated');
    phase.evidenceKey = 'strength.estimated';
    phase.coverage = 1;
  });
  for (let i = 0; i < result.phases.length; i++) {
    const p = result.phases[i];
    if (p.start !== null) {
      const end =
        result.phases.slice(i + 1).find((q) => q.start !== null)?.start ??
        a.duration;
      p.end = end > p.start ? end : null;
    }
  }
  const top = rdl ? finish : extreme;
  if (top < 0) return result;
  const add = (
    name: MovementCheck['name'],
    value: number | null,
    target: number,
    time: number,
  ) => {
    if (value === null) return;
    const rounded = Math.round(value);
    result.checks.push({
      name,
      value: rounded,
      target,
      time,
      unit: '°',
      passed: rounded >= target,
      detail: source('strength.checkNote'),
    });
  };
  if (row) {
    const hips = d
      .slice(0, extreme + 1)
      .map((r) => r.hip)
      .filter((v): v is number => v !== null);
    if (hips.length === extreme + 1)
      add(
        'Torso consistency',
        180 - (Math.max(...hips) - Math.min(...hips)),
        165,
        d[extreme].time,
      );
    add(
      'Row elbow flexion',
      d[extreme].elbow === null ? null : 180 - d[extreme].elbow!,
      60,
      d[extreme].time,
    );
  } else {
    const arms = d
      .slice(rdl ? extreme : onset, top + 1)
      .filter((r) => r.elbow !== null);
    if (arms.length >= 3) {
      const sorted = arms.toSorted((x, y) => x.elbow! - y.elbow!);
      const mid = sorted[Math.floor(sorted.length / 2)];
      add('Arms through the pull', mid.elbow, 160, mid.time);
    }
    add('Hip extension', d[top].hip, 165, d[top].time);
    if (!rdl) add('Knee extension', d[top].knee, 165, d[top].time);
  }
  result.score = result.checks.length
    ? Math.round(
        (result.checks.filter((c) => c.passed).length / result.checks.length) *
          100,
      )
    : null;
  return result;
}
