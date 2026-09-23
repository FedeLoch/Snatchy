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
  const set = (index: number, frame: number, evidence: string) => {
    phases[index].start = data[frame].time;
    phases[index].evidence = evidence;
  };
  const setup = data.findIndex(
    (v, i) =>
      sustained(i, (x) => x.wrist.y > x.hipPoint.y + 0.03) && v.knee! < 155,
  );
  const pull =
    setup < 0
      ? -1
      : data.findIndex(
          (v, i) =>
            i > setup &&
            sustained(i, (x) => x.wrist.y < data[setup].wrist.y - 0.035) &&
            v.wrist.y > v.shoulder.y &&
            continuous(setup, i),
        );
  const catchIndex = data.findIndex(
    (v, i) =>
      (pull < 0 || i > pull) &&
      sustained(i, overhead) &&
      v.knee! < 150 &&
      // Require movement into the receiving position or a later overhead rise;
      // a static overhead pose must not earn a movement score.
      (data.slice(0, i).some((x) => x.wrist.y - v.wrist.y > 0.15) ||
        data.some(
          (x, j) =>
            j > i &&
            continuous(i, j) &&
            sustained(j, overhead) &&
            x.knee! > v.knee! + 20,
        )),
  );
  if (pull < 0 && catchIndex < 0) return result;
  if (pull >= 0) {
    set(0, setup, 'Hands below hips before sustained upward movement.');
    set(
      1,
      pull,
      'Wrist rises from the starting position for three consecutive samples. Lift-off is a pose estimate, not bar contact detection.',
    );
  }
  if (catchIndex >= 0)
    set(
      5,
      catchIndex,
      'Extended arm above shoulder for three samples with flexed knees. Estimated receiving position.',
    );
  let extension = -1;
  if (pull >= 0) {
    const limit = catchIndex >= 0 ? catchIndex : data.length;
    for (let i = pull + 1; i < limit; i++) {
      if (!continuous(pull, i)) break;
      if (
        extension < 0 ||
        data[i].hip! + data[i].knee! >
          data[extension].hip! + data[extension].knee!
      )
        extension = i;
    }
    if (
      extension >= 0 &&
      (data[extension].hip! < 155 ||
        data[extension].knee! < 155 ||
        data[extension].knee! - data[pull].knee! < 10)
    )
      extension = -1;
  }
  if (
    extension >= 0 &&
    catchIndex > extension &&
    continuous(extension, catchIndex)
  )
    set(
      4,
      extension,
      'Largest combined hip/knee extension before the overhead receiving position.',
    );
  // Preserve independently recognizable phases; do not invent a missing knee rebend.
  for (
    let i = pull + 1;
    pull >= 0 && extension >= 0 && i < extension - 2;
    i++
  ) {
    if (data[i].knee! < data[i - 1].knee! || data[i].knee! <= data[i + 1].knee!)
      continue;
    let dip = i + 1;
    for (let j = i + 1; j < extension; j++)
      if (data[j].knee! < data[dip].knee!) dip = j;
    if (
      data[i].knee! - data[dip].knee! >= 6 &&
      data[extension].knee! - data[dip].knee! >= 10
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
  if (catchIndex >= 0)
    for (let i = catchIndex; i < data.length && overhead(data[i]); i++) {
      if (!continuous(catchIndex, i)) break;
      if (data[i].knee! < data[bottom].knee!) bottom = i;
    }
  const recovery =
    bottom < 0
      ? -1
      : data.findIndex(
          (v, i) =>
            i > bottom &&
            continuous(bottom, i) &&
            sustained(
              i,
              (x) => overhead(x) && x.knee! > data[bottom].knee! + 12,
            ) &&
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
  const addCheck = (
    name: string,
    value: number,
    target: number,
    time: number,
    detail: string,
  ) => {
    const rounded = Math.round(value);
    result.checks.push({
      name,
      value: rounded,
      target,
      unit: '°',
      passed: rounded >= target,
      time,
      detail,
    });
  };
  // A check is included only if its own phase evidence is available. Unknown
  // phases never contribute zeros and never suppress independent observations.
  const pullEnd =
    extension >= 0
      ? extension
      : phases[2].start === null
        ? -1
        : data.findIndex((v) => v.time === phases[2].start);
  if (pull >= 0 && pullEnd - pull >= 2 && continuous(pull, pullEnd)) {
    const pullFrames = data.slice(pull, pullEnd + 1);
    const armFrame = pullFrames.reduce((min, v) =>
      v.elbow! < min.elbow! ? v : min,
    );
    addCheck(
      'Arms through the pull',
      armFrame.elbow!,
      160,
      armFrame.time,
      'Minimum visible elbow angle over the recognized pull interval. Unrecognized portions of the pull are excluded.',
    );
  }
  if (
    extension >= 0 &&
    (phases[3].start !== null || phases[4].start !== null)
  ) {
    addCheck(
      'Hip extension',
      data[extension].hip!,
      165,
      data[extension].time,
      'Hip angle at the measured end of the recognized pull.',
    );
    addCheck(
      'Knee extension',
      data[extension].knee!,
      165,
      data[extension].time,
      'Knee angle at the measured end of the recognized pull.',
    );
  }
  if (catchIndex >= 0)
    addCheck(
      'Receiving arm extension',
      data[catchIndex].elbow!,
      165,
      data[catchIndex].time,
      'Visible elbow angle at the estimated catch. Inspect the overlay before interpreting a shortfall as a fault.',
    );
  const finish =
    recovery < 0
      ? undefined
      : data
          .slice(recovery)
          .find(
            (v, index) =>
              continuous(recovery, recovery + index) &&
              sustained(recovery + index, overhead) &&
              v.knee! >= 160,
          );
  if (finish)
    addCheck(
      'Standing recovery',
      finish.knee!,
      165,
      finish.time,
      'Knee angle in the recognized overhead recovery. This does not establish a competition-valid lift.',
    );
  result.score = result.checks.length
    ? Math.round(
        (result.checks.filter((c) => c.passed).length / result.checks.length) *
          100,
      )
    : null;
  return result;
}
