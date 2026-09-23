import { anglesAt, SIDES, visible, type VisionAnalysis } from './vision';
export const PHASE_NAMES = [
  'Setup',
  'First pull',
  'Transition',
  'Second pull',
  'Turnover',
  'Catch',
  'Recovery',
] as const;
export interface MeasuredPhase {
  name: (typeof PHASE_NAMES)[number];
  start: number | null;
  end: number | null;
  evidence: string;
  coverage: number | null;
}
export interface MovementCheck {
  name: string;
  value: number;
  target: number;
  unit: string;
  passed: boolean;
  time: number;
  detail: string;
}
export interface LiftPhases {
  version: 1;
  method: 'pose-heuristic';
  phases: MeasuredPhase[];
  checks: MovementCheck[];
  score: number | null;
}
export function estimatePhases(a: VisionAnalysis): LiftPhases {
  const phases: MeasuredPhase[] = PHASE_NAMES.map((name) => ({
    name,
    start: null,
    end: null,
    evidence: 'Not resolved from the available pose evidence.',
    coverage: null,
  }));
  const result: LiftPhases = {
    version: 1,
    method: 'pose-heuristic',
    phases,
    checks: [],
    score: null,
  };
  if (a.status !== 'tracked') return result;
  const [shoulder, , wrist, hip] = SIDES[a.side];
  const data = a.frames
    .map((f) => {
      const angles = anglesAt(f, a.side, a.width, a.height);
      return {
        time: f.time,
        ...angles,
        wrist: f.landmarks[wrist],
        shoulder: f.landmarks[shoulder],
        hipPoint: f.landmarks[hip],
      };
    })
    .filter(
      (v) =>
        v.elbow !== null &&
        v.hip !== null &&
        v.knee !== null &&
        visible(v.wrist) &&
        visible(v.shoulder) &&
        visible(v.hipPoint),
    );
  if (data.length < 12) return result;
  const continuous = (start: number, end: number) =>
    data
      .slice(start + 1, end + 1)
      .every((v, i) => v.time - data[start + i].time <= 1.6 / a.sampleRate);
  const sustained = (
    i: number,
    predicate: (v: (typeof data)[number]) => boolean,
  ) =>
    i + 2 < data.length &&
    continuous(i, i + 2) &&
    data.slice(i, i + 3).every(predicate);
  const overhead = (v: (typeof data)[number]) =>
    v.elbow! >= 155 && v.wrist.y < v.shoulder.y - 0.06;
  const setup = data.findIndex(
    (v, i) =>
      sustained(i, (x) => x.wrist.y > x.hipPoint.y + 0.03) && v.knee! < 155,
  );
  if (setup < 0) return result;
  const initial = data[setup];
  const pull = data.findIndex(
    (v, i) =>
      i > setup &&
      sustained(i, (x) => x.wrist.y < initial.wrist.y - 0.035) &&
      v.wrist.y > v.shoulder.y,
  );
  if (pull < 0 || !continuous(setup, pull)) return result;
  const catchIndex = data.findIndex(
    (v, i) =>
      i > pull &&
      sustained(i, overhead) &&
      v.knee! < 150 &&
      initial.wrist.y - v.wrist.y > 0.15,
  );
  // Do not call generic hand motion a lift: require a later supported overhead receiving position.
  if (catchIndex < 0 || !continuous(pull, catchIndex)) return result;
  const set = (index: number, frame: number, evidence: string) => {
    phases[index].start = data[frame].time;
    phases[index].evidence = evidence;
  };
  set(0, setup, 'Hands below hips before sustained upward movement.');
  set(
    1,
    pull,
    'Wrist rises from the starting position for three consecutive samples. Lift-off is a pose estimate, not bar contact detection.',
  );
  set(
    5,
    catchIndex,
    'Extended arm above shoulder for three samples with flexed knees. Estimated receiving position.',
  );
  let extension = pull;
  for (let i = pull + 1; i < catchIndex; i++)
    if (
      data[i].hip! + data[i].knee! >
      data[extension].hip! + data[extension].knee!
    )
      extension = i;
  if (
    extension > pull &&
    data[extension].hip! >= 155 &&
    data[extension].knee! >= 155
  )
    set(
      4,
      extension,
      'Largest combined hip/knee extension before the overhead receiving position.',
    );
  // A visible extend–rebend–extend pattern is required; never divide the clip into equal phases.
  for (let i = pull + 1; i < extension - 2; i++) {
    if (data[i].knee! < data[i - 1].knee! || data[i].knee! <= data[i + 1].knee!)
      continue;
    let dip = i + 1;
    for (let j = i + 1; j < extension; j++)
      if (data[j].knee! < data[dip].knee!) dip = j;
    if (
      data[i].knee! - data[dip].knee! >= 6 &&
      data[extension].knee! - data[dip].knee! >= 10 &&
      dip < extension
    ) {
      set(
        2,
        i,
        'First local knee-extension peak before a measurable knee rebend.',
      );
      set(3, dip, 'Knee rebend minimum followed by renewed extension.');
      break;
    }
  }
  let bottom = catchIndex;
  for (let i = catchIndex; i < data.length && overhead(data[i]); i++) {
    if (!continuous(catchIndex, i)) break;
    if (data[i].knee! < data[bottom].knee!) bottom = i;
  }
  const recovery = data.findIndex(
    (v, i) =>
      i > bottom &&
      continuous(bottom, i) &&
      sustained(i, (x) => overhead(x) && x.knee! > data[bottom].knee! + 12) &&
      v.knee! > data[bottom].knee! + 12,
  );
  if (recovery >= 0)
    set(
      6,
      recovery,
      'Knees extend from the receiving position while the arm remains overhead.',
    );
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    if (phase.start === null) continue;
    phase.end = i === 6 ? a.duration : phases[i + 1].start;
    if (phase.end !== null) {
      const frames = a.frames.filter(
        (f) => f.time >= phase.start! && f.time < phase.end!,
      );
      phase.coverage = frames.length
        ? frames.filter((f) =>
            Object.values(anglesAt(f, a.side, a.width, a.height)).every(
              (v) => v !== null,
            ),
          ).length / frames.length
        : null;
    }
  }
  if (
    phases.some((p) => p.start === null) ||
    recovery < 0 ||
    !continuous(setup, recovery)
  )
    return result;
  const pullFrames = data.filter(
    (v) => v.time >= data[pull].time && v.time <= data[extension].time,
  );
  const armMin = Math.min(...pullFrames.map((v) => v.elbow!));
  const armFrame = pullFrames.find((v) => v.elbow === armMin)!;
  const finish = data
    .slice(recovery)
    .find((v) => overhead(v) && v.knee! >= 160);
  if (!finish) return result;
  result.checks = [
    {
      name: 'Arms through the pull',
      value: Math.round(armMin),
      target: 160,
      unit: '°',
      passed: Math.round(armMin) >= 160,
      time: armFrame.time,
      detail:
        'Minimum visible elbow angle before the estimated turnover. Review early flexion; perspective and individual technique matter.',
    },
    {
      name: 'Hip extension',
      value: Math.round(data[extension].hip!),
      target: 165,
      unit: '°',
      passed: Math.round(data[extension].hip!) >= 165,
      time: data[extension].time,
      detail: 'Hip angle at the estimated end of the second pull.',
    },
    {
      name: 'Knee extension',
      value: Math.round(data[extension].knee!),
      target: 165,
      unit: '°',
      passed: Math.round(data[extension].knee!) >= 165,
      time: data[extension].time,
      detail: 'Knee angle at the estimated end of the second pull.',
    },
    {
      name: 'Receiving arm extension',
      value: Math.round(data[catchIndex].elbow!),
      target: 165,
      unit: '°',
      passed: Math.round(data[catchIndex].elbow!) >= 165,
      time: data[catchIndex].time,
      detail:
        'Visible elbow angle at the estimated catch. Inspect the footage before interpreting a shortfall as a fault.',
    },
    {
      name: 'Standing recovery',
      value: Math.round(finish.knee!),
      target: 165,
      unit: '°',
      passed: Math.round(finish.knee!) >= 165,
      time: finish.time,
      detail:
        'Knee angle in the overhead recovery. This does not establish a competition-valid lift.',
    },
  ];
  result.score = Math.round(
    (result.checks.filter((c) => c.passed).length / result.checks.length) * 100,
  );
  return result;
}
