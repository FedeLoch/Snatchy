import { exerciseById } from './exercises';
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
  estimated?: boolean;
  applicable?: boolean;
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
    evidence:
      name === 'Transition'
        ? 'No distinct knee rebend was resolved. It may be obscured by the view or absent as a separate phase in this variation.'
        : 'Not resolved from the available pose evidence.',
    coverage: null,
  }));
  const result: LiftPhases = {
    version: 1,
    method: 'pose-heuristic',
    phases,
    checks: [],
    score: null,
  };
  if (a.exercise && a.exercise.id === null) return result;
  const exercise = exerciseById(a.exercise?.id ?? 'snatch');
  const clean = exercise?.family === 'clean';
  const highHang = exercise?.start === 'high-hang';
  const power = exercise?.receiving === 'power';
  const muscle = exercise?.receiving === 'muscle';
  if (highHang)
    for (const i of [1, 2]) {
      phases[i].applicable = false;
      phases[i].evidence =
        'Not applicable to a high-hang start. Analysis begins with the upper pull.';
    }
  const [shoulder, , wrist, hip] = SIDES[a.side];
  const data = a.frames
    .map((f) => {
      const angles = anglesAt(f, a.side, a.width, a.height);
      return {
        time: f.time,
        people: f.people,
        ...angles,
        wrist: f.landmarks[wrist],
        shoulder: f.landmarks[shoulder],
        hipPoint: f.landmarks[hip],
      };
    })
    .filter(
      (v) =>
        v.people === 1 &&
        visible(v.wrist) &&
        visible(v.shoulder) &&
        visible(v.hipPoint),
    );
  if (data.length < 12) return result;
  const continuous = (start: number, end: number) =>
    data
      .slice(start + 1, end + 1)
      .every((v, i) => v.time - data[start + i].time <= 2.1 / a.sampleRate) &&
    !a.frames.some(
      (f) =>
        f.people > 1 && f.time > data[start].time && f.time < data[end].time,
    );
  const sustained = (
    i: number,
    predicate: (v: (typeof data)[number]) => boolean,
  ) =>
    i + 2 < data.length &&
    continuous(i, i + 2) &&
    data.slice(i, i + 3).every(predicate);
  const overhead = (v: (typeof data)[number]) =>
    clean
      ? v.elbow !== null &&
        v.elbow < 120 &&
        Math.abs(v.wrist.y - v.shoulder.y) < 0.1
      : v.elbow! >= 155 && v.wrist.y < v.shoulder.y - 0.06;
  const set = (
    index: number,
    frame: number,
    evidence: string,
    estimated = false,
  ) => {
    phases[index].start = data[frame].time;
    phases[index].evidence = evidence;
    if (estimated) phases[index].estimated = true;
  };
  const setup = data.findIndex(
    (v, i) =>
      sustained(
        i,
        (x) => x.wrist.y > x.hipPoint.y + (highHang ? -0.04 : 0.03),
      ) &&
      ((v.knee !== null && v.knee < 155) || (v.hip !== null && v.hip < 165)),
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
      v.knee !== null &&
      (muscle || v.knee < (power ? 178 : 150)) &&
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
    set(
      0,
      setup,
      'Hands below hips with flexed knees or a hip hinge before upward movement. A hang start is allowed; floor contact is not established.',
    );
    set(
      1,
      pull,
      'Wrist rises from the starting position for three observed samples. Lift-off is a pose estimate, not bar contact detection.',
    );
  }
  if (catchIndex >= 0)
    set(
      5,
      catchIndex,
      clean
        ? 'Hands near shoulders with flexed elbows for three observed samples. Estimated front-rack receiving position.'
        : 'Extended arm above shoulder for three samples with flexed knees. Estimated receiving position.',
    );
  let extension = -1;
  if (pull >= 0) {
    const limit = catchIndex >= 0 ? catchIndex : data.length;
    for (let i = pull + 1; i < limit; i++) {
      if (!continuous(pull, i)) break;
      if (data[i].hip === null || data[i].knee === null) continue;
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
        !(
          (data[pull].knee !== null &&
            data[extension].knee! - data[pull].knee! >= 10) ||
          (data[pull].hip !== null &&
            data[extension].hip! - data[pull].hip! >= 10)
        ))
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
      'Largest combined hip/knee extension before the receiving position.',
    );
  // Preserve independently recognizable phases; do not invent a missing knee rebend.
  for (
    let i = pull + 1;
    !highHang && pull >= 0 && extension >= 0 && i < extension - 2;
    i++
  ) {
    if (
      [data[i].knee, data[i - 1].knee, data[i + 1].knee].some((v) => v === null)
    )
      continue;
    if (data[i].knee! < data[i - 1].knee! || data[i].knee! <= data[i + 1].knee!)
      continue;
    let dip = i + 1;
    for (let j = i + 1; j < extension; j++)
      if (data[j].knee !== null && data[j].knee! < data[dip].knee!) dip = j;
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
  // A visible knee rebend is not required to identify an upper pull. Use
  // independent hip-level hand position and measured extension, and disclose
  // that this is a timing estimate rather than a confirmed rebend boundary.
  if (phases[3].start === null && pull >= 0 && extension > pull + 1) {
    const upperPull = data.findIndex(
      (v, i) =>
        i > pull &&
        i < extension &&
        continuous(pull, i) &&
        v.hip !== null &&
        data[pull].hip !== null &&
        v.hip >= data[pull].hip! + 5 &&
        v.wrist.y <= v.hipPoint.y + 0.03 &&
        v.wrist.y > v.shoulder.y &&
        data[extension].wrist.y < v.wrist.y - 0.015,
    );
    if (upperPull >= 0)
      set(
        3,
        upperPull,
        'Timing estimate: hands approach hip level during measured hip extension before turnover. A separate knee rebend was not resolved; this is not a bar-contact measurement.',
        true,
      );
  }
  let bottom = catchIndex;
  if (catchIndex >= 0)
    for (let i = catchIndex; i < data.length && overhead(data[i]); i++) {
      if (!continuous(catchIndex, i)) break;
      if (data[i].knee !== null && data[i].knee! < data[bottom].knee!)
        bottom = i;
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
              (x) =>
                overhead(x) &&
                x.knee! >
                  (muscle ? 159 : data[bottom].knee! + (power ? 5 : 12)),
            ) &&
            v.knee! > (muscle ? 159 : data[bottom].knee! + (power ? 5 : 12)),
        );
  if (recovery >= 0)
    set(
      6,
      recovery,
      clean
        ? 'Standing recovery while the hands remain in the front-rack region.'
        : 'Knees extend from the receiving position while the arm remains overhead.',
    );
  if (highHang && pull >= 0) {
    phases[1].start = null;
    phases[1].evidence =
      'Not applicable to a high-hang start; no floor-to-knee first pull is assumed.';
    set(
      3,
      pull,
      'Upper-pull onset from the selected high-hang starting position.',
      true,
    );
  }
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
      if (phase.coverage !== null && phase.coverage < 1) {
        phase.estimated = true;
        phase.evidence +=
          ' Some joint measurements are unavailable in this interval; timing uses the remaining observed samples.';
      }
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
    const pullFrames = data
      .slice(pull, pullEnd + 1)
      .filter((v) => v.elbow !== null);
    if (pullFrames.length >= 3) {
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
      clean ? 'Front-rack arm flexion' : 'Receiving arm extension',
      clean ? 180 - data[catchIndex].elbow! : data[catchIndex].elbow!,
      clean ? 60 : 165,
      data[catchIndex].time,
      clean
        ? 'Elbow flexion (180° minus elbow angle) at the estimated front rack. This checks a receiving-position cue, not shoulder contact or competition validity.'
        : 'Visible elbow angle at the estimated catch. Inspect the overlay before interpreting a shortfall as a fault.',
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
      'Knee angle in the recognized receiving-position recovery. This does not establish a competition-valid lift.',
    );
  result.score = result.checks.length
    ? Math.round(
        (result.checks.filter((c) => c.passed).length / result.checks.length) *
          100,
      )
    : null;
  return result;
}
