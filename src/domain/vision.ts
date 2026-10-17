import { reliablePoseFrames, reliableSide } from './pose-quality';
import { bodyMeasurements, type BodyMeasurements } from './body-measurements';
import {
  estimateWristBar,
  reliableBarPoints,
  type WristBar,
  type WristBarPoint,
} from './wrist-bar';
import { detectExercise, type ExerciseSelection } from './exercises';
import type { AutomaticBar } from './automatic-bar';
import { estimatePhases, type LiftPhases } from './lift-phases';
import type { BarTrack } from './bar-track';
import { source } from '../i18n';
import { wristBend } from './hands';
export interface Landmark {
  x: number;
  y: number;
  visibility: number;
}
export interface PoseSample {
  time: number;
  people: number;
  landmarks: Landmark[];
  /** Unfiltered source points, session-only; never stored in history. */
  rawLandmarks?: Landmark[];
  /** Normalized pixel-detected shaft candidate; absent when ambiguous. */
  barShaft?: WristBarPoint;
  /** Model 3D landmarks in meters around the hips, session-only. Used for
   * joints whose limbs point toward or away from the camera. */
  world?: WorldPoint[];
  /** 21-point hand landmarks per athlete side, session-only. */
  hands?: Partial<Record<Side, Landmark[]>>;
}
export interface WorldPoint {
  x: number;
  y: number;
  z: number;
}
export interface FrameAngles {
  elbow: number | null;
  hip: number | null;
  knee: number | null;
}
export interface MotionEvent {
  id: string;
  time: number;
  title: string;
  /**
   * The rendered English `detail`, kept so a record written by an older build
   * still reads correctly. `values` carries the numbers that were interpolated
   * into it, which lets the UI rebuild the sentence in the active language
   * without the analysis having to be recomputed.
   */
  detail: string;
  values?: number[];
  kind: 'measurement' | 'hypothesis';
}
export interface AngleRange {
  min: number;
  max: number;
  minTime: number;
  maxTime: number;
}
export interface VisionAnalysis {
  version: 1;
  kind: 'measured-pose';
  simulated: false;
  engine: 'MediaPipe Pose Landmarker Lite' | 'MediaPipe Pose Landmarker Full';
  duration: number;
  width: number;
  height: number;
  sampleRate: number;
  sampledFrames: number;
  usableFrames: number;
  coverage: number;
  side: Side;
  status: 'tracked' | 'insufficient';
  ranges: {
    elbow: AngleRange | null;
    hip: AngleRange | null;
    knee: AngleRange | null;
  };
  events: MotionEvent[];
  frames: PoseSample[];
  exercise?: ExerciseSelection;
  wristBar?: WristBar;
  shaftBar?: WristBar;
  body?: BodyMeasurements;
  lift?: LiftPhases;
  bar?: BarTrack;
  automaticBar?: AutomaticBar;
  interval?: { start: number; end: number };
  repetitions?: VisionAnalysis[];
}
export interface VisionRecord {
  id: string;
  createdAt: number;
  analysis: VisionAnalysis;
}
export const SIDES = {
  left: [11, 13, 15, 23, 25, 27],
  right: [12, 14, 16, 24, 26, 28],
} as const;
/** Which side of the athlete was measured. Persisted, so keep the values. */
export type Side = keyof typeof SIDES;
export const VISIBILITY = 0.65;
/** Analysis rules were tuned on 15 Hz samples. At a higher rate they keep the
 * same time spans by counting this many samples per 15 Hz step, so "three
 * consecutive samples" still means about 0.13 s rather than half of it. */
export const BASE_SAMPLE_RATE = 15;
export const stride = (sampleRate: number): number =>
  Math.max(1, Math.round(sampleRate / BASE_SAMPLE_RATE));
export function visible(point: Landmark | undefined): point is Landmark {
  return (
    !!point &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1 &&
    Number.isFinite(point.visibility) &&
    point.visibility >= VISIBILITY
  );
}
/** Angles use pixel coordinates, not distorted width/height-normalized coordinates. */
export function jointAngle(
  a: Landmark | undefined,
  b: Landmark | undefined,
  c: Landmark | undefined,
  width: number,
  height: number,
): number | null {
  if (!visible(a) || !visible(b) || !visible(c) || width <= 0 || height <= 0)
    return null;
  const u = [(a.x - b.x) * width, (a.y - b.y) * height],
    v = [(c.x - b.x) * width, (c.y - b.y) * height];
  const d = Math.hypot(...u) * Math.hypot(...v);
  if (d < 1e-6) return null;
  return (
    (Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / d))) *
      180) /
    Math.PI
  );
}
/** Out-of-plane share of a 3D segment: 0 lies in the image plane, 1 points
 * straight at or away from the camera. */
function depthShare(p: WorldPoint, q: WorldPoint): number {
  const length = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
  return length < 1e-6 ? 0 : Math.abs(p.z - q.z) / length;
}
/** Beyond about 35–40° out of the image plane a projected angle is distorted
 * enough that the model's 3D estimate is the better measurement. Closer to
 * the plane, the 2D pixel angle is more precise than noisy depth. Between
 * these shares the two are blended, so a limb hovering near the boundary
 * does not flip between measurements from one sample to the next. */
const BLEND_FROM = 0.35,
  BLEND_TO = 0.65;
export function worldAngle(
  a: WorldPoint,
  b: WorldPoint,
  c: WorldPoint,
): number | null {
  const u = [a.x - b.x, a.y - b.y, a.z - b.z],
    v = [c.x - b.x, c.y - b.y, c.z - b.z];
  const d = Math.hypot(...u) * Math.hypot(...v);
  if (d < 1e-9) return null;
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  return (Math.acos(Math.max(-1, Math.min(1, dot / d))) * 180) / Math.PI;
}
/** Joint angle that stays valid when the camera is not side-on: 2D pixel
 * angle for limbs near the image plane, 3D model angle for foreshortened
 * ones. Visibility gating always uses the 2D landmarks. */
export function measuredAngle(
  frame: PoseSample,
  ids: readonly [number, number, number],
  width: number,
  height: number,
): number | null {
  const [i, j, k] = ids;
  const flat = jointAngle(
    frame.landmarks[i],
    frame.landmarks[j],
    frame.landmarks[k],
    width,
    height,
  );
  const w = frame.world;
  if (flat === null || !w || !w[i] || !w[j] || !w[k]) return flat;
  const share = Math.max(depthShare(w[i], w[j]), depthShare(w[k], w[j]));
  if (share <= BLEND_FROM) return flat;
  const deep = worldAngle(w[i], w[j], w[k]);
  if (deep === null) return flat;
  const t = Math.min(1, (share - BLEND_FROM) / (BLEND_TO - BLEND_FROM));
  const weight = t * t * (3 - 2 * t);
  return flat + (deep - flat) * weight;
}
export function anglesAt(
  frame: PoseSample,
  side: 'left' | 'right',
  width: number,
  height: number,
): FrameAngles {
  if (frame.people !== 1) return { elbow: null, hip: null, knee: null };
  const [s, e, w, h, k, a] = SIDES[side];
  return {
    elbow: measuredAngle(frame, [s, e, w], width, height),
    hip: measuredAngle(frame, [s, h, k], width, height),
    knee: measuredAngle(frame, [h, k, a], width, height),
  };
}
export function nearestSample(
  frames: PoseSample[],
  time: number,
  maxGap = 0.1,
): PoseSample | null {
  if (!frames.length || !Number.isFinite(time)) return null;
  let low = 0,
    high = frames.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (frames[mid].time < time) low = mid + 1;
    else high = mid;
  }
  const next = frames[low],
    before = frames[Math.max(0, low - 1)];
  const found =
    Math.abs(before.time - time) < Math.abs(next.time - time) ? before : next;
  return Math.abs(found.time - time) <= maxGap ? found : null;
}
function range(points: { time: number; value: number }[]): AngleRange | null {
  if (points.length < 3) return null;
  const sorted = points.toSorted((a, b) => a.value - b.value);
  // Reject single-frame outliers with a 5th–95th percentile range.
  const min = sorted[Math.floor((sorted.length - 1) * 0.05)],
    max = sorted[Math.ceil((sorted.length - 1) * 0.95)];
  return {
    min: Math.round(min.value),
    max: Math.round(max.value),
    minTime: min.time,
    maxTime: max.time,
  };
}
export function analyzePoseSamples(
  frames: PoseSample[],
  width: number,
  height: number,
  duration: number,
  sampleRate = 15,
  exerciseId = 'snatch',
): VisionAnalysis {
  frames = reliablePoseFrames(frames, width, height, sampleRate);
  const step = stride(sampleRate);
  const side = reliableSide(frames, width, height);
  const values = frames.map((frame) => ({
    frame,
    angles: anglesAt(frame, side, width, height),
  }));
  const usable = values.filter((v) =>
    Object.values(v.angles).every((a) => a !== null),
  );
  const coverage = frames.length ? usable.length / frames.length : 0;
  const status =
    coverage >= 0.6 && usable.length >= 12 * step ? 'tracked' : 'insufficient';
  const ranges = {
    elbow: null,
    hip: null,
    knee: null,
  } as VisionAnalysis['ranges'];
  const events: MotionEvent[] = [];
  if (status === 'tracked') {
    for (const key of ['elbow', 'hip', 'knee'] as const)
      ranges[key] = range(
        usable.map((v) => ({ time: v.frame.time, value: v.angles[key]! })),
      );
    const hip = ranges.hip!,
      knee = ranges.knee!,
      elbow = ranges.elbow!;
    if (hip.max - hip.min >= 15)
      events.push({
        id: 'extension',
        time: hip.maxTime,
        title: 'Greatest observed hip extension',
        detail: `Projected hip angle ${hip.max}°. This is a measured image-plane angle, not proof of full extension.`,
        values: [hip.max],
        kind: 'measurement',
      });
    if (knee.max - knee.min >= 15)
      events.push({
        id: 'knee-flexion',
        time: knee.minTime,
        title: 'Deepest observed knee flexion',
        detail: `Projected knee angle ${knee.min}°. Inspect this frame to locate the receiving position.`,
        values: [knee.min],
        kind: 'measurement',
      });
    if (elbow.max - elbow.min >= 15)
      events.push({
        id: 'elbow-flexion',
        time: elbow.minTime,
        title: 'Greatest observed elbow flexion',
        detail: `Projected elbow angle ${elbow.min}°. Occlusion and camera perspective can affect this estimate.`,
        values: [elbow.min],
        kind: 'measurement',
      });
    const overhead = usable.find((v, index) => {
      const consecutive = usable.slice(index, index + 2 * step + 1);
      return (
        consecutive.length === 2 * step + 1 &&
        consecutive.at(-1)!.frame.time - v.frame.time <=
          (3 * step) / sampleRate &&
        consecutive.every((x) => {
          const s = x.frame.landmarks[SIDES[side][0]],
            w = x.frame.landmarks[SIDES[side][2]];
          return w.y < s.y - 0.08 && x.angles.elbow! > 155;
        })
      );
    });
    if (overhead)
      events.push({
        id: 'overhead',
        time: overhead.frame.time,
        title: 'Extended arm above shoulder',
        detail:
          'The visible wrist stays above the shoulder with an extended elbow for three samples. This alone does not verify an overhead catch or a Snatch.',
        values: [],
        kind: 'measurement',
      });
    // A hypothesis needs meaningful hip extension, a later overhead position, and 3 sustained samples.
    if (
      hip.max >= 165 &&
      hip.max - hip.min >= 25 &&
      overhead &&
      overhead.frame.time > hip.maxTime
    ) {
      const early = usable.find((v, index) => {
        const group = usable.slice(index, index + 2 * step + 1);
        return (
          group.length === 2 * step + 1 &&
          group.at(-1)!.frame.time - v.frame.time <= (3 * step) / sampleRate &&
          group.every(
            (x) =>
              x.frame.time < hip.maxTime - 0.1 &&
              x.frame.time > hip.maxTime - 0.6 &&
              x.angles.elbow! < 160 &&
              x.angles.hip! < 160,
          )
        );
      });
      if (early)
        events.push({
          id: 'possible-early-bend',
          time: early.frame.time,
          title: 'Possible arm bend before extension',
          detail: `Elbow flexion was visible approximately ${Math.round((hip.maxTime - early.frame.time) * 1000)} ms before the largest observed hip angle. Experimental rule; review the frames before changing technique.`,
          values: [Math.round((hip.maxTime - early.frame.time) * 1000)],
          kind: 'hypothesis',
        });
    }
  }
  const analysis: VisionAnalysis = {
    version: 1,
    kind: 'measured-pose',
    simulated: false,
    engine: 'MediaPipe Pose Landmarker Lite',
    duration,
    width,
    height,
    sampleRate,
    sampledFrames: frames.length,
    usableFrames: usable.length,
    coverage,
    side,
    status,
    ranges,
    events: events.sort((a, b) => a.time - b.time),
    frames,
  };
  analysis.exercise =
    exerciseId !== 'auto'
      ? {
          id: exerciseId,
          source: 'manual',
          reason: source('exerciseReason.manual'),
        }
      : detectExercise(analysis);
  analysis.wristBar = estimateWristBar(analysis);
  const shaftCandidates = frames.flatMap((f) =>
    f.barShaft
      ? [
          {
            time: f.time,
            left: {
              x: f.barShaft.left.x * width,
              y: f.barShaft.left.y * height,
            },
            right: {
              x: f.barShaft.right.x * width,
              y: f.barShaft.right.y * height,
            },
            x: f.barShaft.x * width,
            y: f.barShaft.y * height,
          },
        ]
      : [],
  );
  const shaftPoints = reliableBarPoints(
    shaftCandidates,
    width,
    height,
    sampleRate,
  );
  if (shaftPoints.length >= 6 && shaftPoints.length / frames.length >= 0.3)
    analysis.shaftBar = {
      method: 'bar-shaft',
      width,
      height,
      coverage: shaftPoints.length / frames.length,
      points: shaftPoints,
    };

  if (
    ['pull-up', 'chin-up', 'back-squat'].includes(analysis.exercise?.id ?? '')
  ) {
    delete analysis.wristBar;
    delete analysis.shaftBar;
    analysis.events = analysis.events.filter(
      (event) => event.kind !== 'hypothesis' && event.id !== 'overhead',
    );
  }
  analysis.body = bodyMeasurements(analysis);
  analysis.lift = estimatePhases(analysis);
  const wrist = receivingWristBend(analysis);
  if (wrist) {
    analysis.events.push(wrist);
    analysis.events.sort((a, b) => a.time - b.time);
  }
  return analysis;
}

/** Median projected wrist bend while receiving overhead or in the rack,
 * measured from the hand model's wrist and middle knuckle. Requires three
 * hand-tracked samples inside the Catch phase. */
export function receivingWristBend(a: VisionAnalysis): MotionEvent | null {
  const p = a.lift?.phases.find((x) => x.name === 'Catch');
  if (!p || p.start === null || p.end === null) return null;
  const rows = a.frames
    .filter((f) => f.people === 1 && f.time >= p.start! && f.time <= p.end!)
    .map((f) => ({
      time: f.time,
      value: wristBend(f, a.side, a.width, a.height),
    }))
    .filter((r): r is { time: number; value: number } => r.value !== null);
  if (rows.length < 3 * stride(a.sampleRate)) return null;
  const sorted = rows.toSorted((x, y) => x.value - y.value);
  const mid = sorted[Math.floor(sorted.length / 2)];
  const angle = Math.round(mid.value);
  return {
    id: 'wrist-bend',
    time: mid.time,
    title: 'Wrist bend while receiving',
    detail: `Projected wrist bend ${angle}° between forearm and hand while receiving, from hand tracking. Camera angle affects this estimate.`,
    values: [angle],
    kind: 'measurement',
  };
}
