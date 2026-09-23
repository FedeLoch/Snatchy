import { estimatePhases, type LiftPhases } from './lift-phases';
import type { BarTrack } from './bar-track';
export interface Landmark {
  x: number;
  y: number;
  visibility: number;
}
export interface PoseSample {
  time: number;
  people: number;
  landmarks: Landmark[];
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
  detail: string;
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
  engine: 'MediaPipe Pose Landmarker Lite';
  duration: number;
  width: number;
  height: number;
  sampleRate: number;
  sampledFrames: number;
  usableFrames: number;
  coverage: number;
  side: 'left' | 'right';
  status: 'tracked' | 'insufficient';
  ranges: {
    elbow: AngleRange | null;
    hip: AngleRange | null;
    knee: AngleRange | null;
  };
  events: MotionEvent[];
  frames: PoseSample[];
  lift?: LiftPhases;
  bar?: BarTrack;
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
export const VISIBILITY = 0.65;
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
export function anglesAt(
  frame: PoseSample,
  side: 'left' | 'right',
  width: number,
  height: number,
): FrameAngles {
  if (frame.people !== 1) return { elbow: null, hip: null, knee: null };
  const [s, e, w, h, k, a] = SIDES[side].map((i) => frame.landmarks[i]);
  return {
    elbow: jointAngle(s, e, w, width, height),
    hip: jointAngle(s, h, k, width, height),
    knee: jointAngle(h, k, a, width, height),
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
): VisionAnalysis {
  const sideScores = (side: 'left' | 'right') =>
    frames.reduce(
      (total, f) =>
        total +
        (f.people === 1
          ? SIDES[side].reduce(
              (sum, i) =>
                sum + (visible(f.landmarks[i]) ? f.landmarks[i].visibility : 0),
              0,
            )
          : 0),
      0,
    );
  const side = sideScores('left') >= sideScores('right') ? 'left' : 'right';
  const values = frames.map((frame) => ({
    frame,
    angles: anglesAt(frame, side, width, height),
  }));
  const usable = values.filter((v) =>
    Object.values(v.angles).every((a) => a !== null),
  );
  const coverage = frames.length ? usable.length / frames.length : 0;
  const status =
    coverage >= 0.6 && usable.length >= 12 ? 'tracked' : 'insufficient';
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
        kind: 'measurement',
      });
    if (knee.max - knee.min >= 15)
      events.push({
        id: 'knee-flexion',
        time: knee.minTime,
        title: 'Deepest observed knee flexion',
        detail: `Projected knee angle ${knee.min}°. Inspect this frame to locate the receiving position.`,
        kind: 'measurement',
      });
    if (elbow.max - elbow.min >= 15)
      events.push({
        id: 'elbow-flexion',
        time: elbow.minTime,
        title: 'Greatest observed elbow flexion',
        detail: `Projected elbow angle ${elbow.min}°. Occlusion and camera perspective can affect this estimate.`,
        kind: 'measurement',
      });
    const overhead = usable.find((v, index) => {
      const consecutive = usable.slice(index, index + 3);
      return (
        consecutive.length === 3 &&
        consecutive[2].frame.time - v.frame.time <= 3 / sampleRate &&
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
        const group = usable.slice(index, index + 3);
        return (
          group.length === 3 &&
          group[2].frame.time - v.frame.time <= 3 / sampleRate &&
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
  analysis.lift = estimatePhases(analysis);
  return analysis;
}
